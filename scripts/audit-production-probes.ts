/** Audit-only reproduction. Run with NODE_ENV=test; uses only TEST_DATABASE_URL. */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { config } from '../server/config'
import { executeRows } from '../server/db/connection'
import { usersRepository } from '../server/modules/users/users.repository'
import { coinsRepository } from '../server/modules/coins/coins.repository'
import { dailyRepository } from '../server/modules/daily/daily.repository'
import { progressRepository } from '../server/modules/progress/progress.repository'
import { COINS_PER_CORRECT_ANSWER } from '../shared/shop-items'
import { getShopItem } from '../shared/shop-items'
import { getDailyTask } from '../shared/daily-tasks'
import { tashkentDate } from '../server/utils/date'

if (config.env !== 'test' || !config.db.testUrl || config.db.url !== config.db.testUrl || config.db.testUrl === config.db.productionUrl) {
  throw new Error('Audit probes require a distinct TEST_DATABASE_URL and NODE_ENV=test')
}
const ids: string[] = []
const blocker = postgres(config.db.url, { max: 1, connect_timeout: 10 })
async function concurrentWithBalanceLock<T>(id: string, operation: () => Promise<T>): Promise<T[]> {
  let pending: Promise<T[]> | undefined
  await blocker.begin(async tx => {
    await tx`SELECT user_id FROM user_coins WHERE user_id = ${id} FOR UPDATE`
    pending = Promise.all(Array.from({ length: 8 }, operation))
    // Hold the write target so the requests establish overlapping snapshots.
    await new Promise(resolve => setTimeout(resolve, 5000))
  })
  return pending!
}
async function fixture(balance: number) {
  const id = `audit_${randomUUID()}`
  ids.push(id)
  await usersRepository.initAtomic({ id, firstName: 'Audit', lastName: 'Disposable', username: '', photoUrl: '' })
  await executeRows(sql`INSERT INTO user_coins (user_id, balance) VALUES (${id}, ${balance}) ON CONFLICT (user_id) DO UPDATE SET balance = ${balance}`)
  return id
}
const date = tashkentDate()
try {
  const task = getDailyTask('answers-20')!
  const user = await fixture(0)
  await executeRows(sql`INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed) VALUES (${user}, ${date}, 'yhq', 20, 0, 0)`)
  const claims = await concurrentWithBalanceLock(user, () => coinsRepository.claimTask(user, task.id, date))
  const state = await coinsRepository.getEconomyState(user)
  const ledger = await coinsRepository.getHistory(user)
  console.log(JSON.stringify({ probe: 'parallel-daily-claim', expectedBalance: task.reward, actualBalance: state.coins, ledgerTotal: ledger.reduce((s, r) => s + r.delta, 0), statuses: claims.map(r => r.status) }))

  const item = getShopItem('premium-days-1')!
  const buyer = await fixture(item.price)
  const purchases = await concurrentWithBalanceLock(buyer, () => coinsRepository.purchase(buyer, item.id, randomUUID()))
  const premium = await executeRows<{ days: number }>(sql`SELECT EXTRACT(EPOCH FROM (premium_until - now())) / 86400 AS days FROM users WHERE id = ${buyer}`)
  const purchaseLedger = await coinsRepository.getHistory(buyer)
  console.log(JSON.stringify({ probe: 'parallel-distinct-purchases', initialBalance: item.price, expectedMaxPremiumDays: item.days, actualPremiumDays: Number(premium[0]?.days), actualBalance: (await coinsRepository.getEconomyState(buyer)).coins, ledgerTotal: purchaseLedger.reduce((s,r) => s+r.delta, 0), statuses: purchases.map(r => r.status) }))

  const fixer = await fixture(0)
  for (let i = 0; i < 5; i++) await dailyRepository.addFixed(fixer, date, 'yhq')
  const fixClaim = await coinsRepository.claimTask(fixer, 'fix-5', date)
  console.log(JSON.stringify({ probe: 'unverified-daily-fix', submittedAnswers: 0, claimStatus: fixClaim.status, actualBalance: (await coinsRepository.getEconomyState(fixer)).coins }))

  const learner = await fixture(0)
  const answers = await concurrentWithBalanceLock(learner, () => progressRepository.recordAnswer({ userId: learner, questionId: 1, subjectId: 'yhq', date, correct: true, clientToken: randomUUID() }))
  console.log(JSON.stringify({ probe: 'parallel-same-correct-answer', expectedBalance: COINS_PER_CORRECT_ANSWER, actualBalance: (await coinsRepository.getEconomyState(learner)).coins, creditedRequests: answers.filter(r => !r.duplicate).length }))
} finally {
  for (const id of ids) await executeRows(sql`DELETE FROM users WHERE id = ${id}`)
  await blocker.end()
  console.log('Disposable audit users cleaned up')
}
