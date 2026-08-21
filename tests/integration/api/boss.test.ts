/**
 * BOSS BATTLE (haftalik jamoaviy jang) — integration testlar (real test DB).
 *
 * Qamrov:
 *  - GET /api/boss/state: auth guard + lazy yaratish + response shakli
 *  - Damage hook: fresh to'g'ri javob (/result) — boss HP + mening zararam
 *  - applyDamage atomikligi: HP 0'dan pastga tushmaydi, 'defeated' BITTA marta
 *  - weeklyRollover: active→escaped; defeated → mukofotlar ATOMIK
 *    (ishtirok + top-3, threshold gate, retry idempotent, re-call no-op)
 *
 * NOTE: haqiqiy JORIY period boss'iga teguvchi testlar delta-based (parallel
 * run'larda ham izchII); deterministik rollback testlari SOXTA period'larda
 * ('1999-01-04') — cleanup'da o'sha qatorlar o'chiriladi.
 */

process.env.CRON_SECRET ||= 'integration-test-cron-secret'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// DIQQAT (cron.test.ts pattern): config startup snapshot — DYNAMIC import shart;
// static import ENV tayinlashdan OLDIN yuklanardi (503 rate_limiter_unavailable sababi).
const { createApp } = await import('../../../server/app')
const { db, executeRows } = await import('../../../server/db/connection')
const { bossBattles, questions, jobRuns, users } = await import('../../../server/schema')
const { usersRepository } = await import('../../../server/modules/users/users.repository')
const { authRepository } = await import('../../../server/modules/auth/auth.repository')
const { bossRepository } = await import('../../../server/modules/boss/boss.repository')
const { coinsRepository } = await import('../../../server/modules/coins/coins.repository')
const { BOSS_DAMAGE_PER_CORRECT, BOSS_REWARDS, bossPeriodKey, bossForPeriod } = await import('../../../shared/boss-battle')
const request = (await import('supertest')).default

const app = createApp()

// Canonical id formati (parseUserId: \d{1,20}) — coins.test bilan to'qnashmaydi
const U1 = '990000005001'
const U2 = '990000005002'
const U3 = '990000005003'
const IDS = [U1, U2, U3]

/** Deterministik SOXTA period'lar (haqiqiy period'ga tegmaydi) */
const P_FAKE_ROLL = '1999-01-04'
const P_FAKE_ESC  = '1999-01-11'
const FAKE_PERIODS = [P_FAKE_ROLL, P_FAKE_ESC]

async function cleanup() {
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id))   // FK cascade: boss_damage, coins
  }
  await db.delete(bossBattles).where(inArray(bossBattles.periodKey, FAKE_PERIODS))
  await db.delete(jobRuns).where(eq(jobRuns.jobName, 'boss-rollover'))
}

async function createUserWithSession(id: string): Promise<string> {
  await usersRepository.initAtomic({ id, firstName: 'Boss', lastName: 'Test', username: '', photoUrl: '' })
  await authRepository.ensureIdentity('telegram', id, id)
  const token = randomBytes(32).toString('hex')
  await authRepository.createSession({
    token, userId: id, provider: 'telegram',
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return token
}

let tokenA: string

beforeAll(async () => {
  await cleanup()
  tokenA = await createUserWithSession(U1)
  await createUserWithSession(U2)
  await createUserWithSession(U3)
})

afterAll(cleanup)

describe('boss — GET /api/boss/state', () => {
  it('auth\'siz 401; sessiya bilan lazy yaratish + to\'liq shakl', async () => {
    await request(app).get('/api/boss/state').expect(401)

    const res = await request(app).get('/api/boss/state')
      .set('Authorization', `Bearer ${tokenA}`).expect(200)
    const periodKey = bossPeriodKey()
    expect(res.body.periodKey).toBe(periodKey)
    expect(res.body.bossKey).toBe(bossForPeriod(periodKey).id)   // DETERMINISTIK roster
    expect(res.body.hpTotal).toBeGreaterThan(0)
    expect(res.body.hpLeft).toBeGreaterThanOrEqual(0)
    expect(res.body.hpLeft).toBeLessThanOrEqual(res.body.hpTotal)
    expect(['active', 'defeated', 'escaped']).toContain(res.body.status)
    expect(Array.isArray(res.body.top)).toBe(true)
    expect(res.body).toHaveProperty('myDamage')

    // Idempotent: qayta GET xuddi shu boss_id (yangi yaratilmaydi)
    const res2 = await request(app).get('/api/boss/state')
      .set('Authorization', `Bearer ${tokenA}`).expect(200)
    expect(res2.body.bossId).toBe(res.body.bossId)
  })
})

describe('boss — damage hook (/result)', () => {
  it('fresh to\'g\'ri javob boss\'ga zarar beradi; xato javob bermaydi (delta-based)', async () => {
    const periodKey = bossPeriodKey()
    const [q] = await db.select().from(questions).limit(1)
    expect(q).toBeDefined()
    const wrongOpt = Object.keys(q.optionsUz).find((k) => k !== q.correctAnswer) ?? '__x__'

    const before = (await bossRepository.getState(U1, periodKey))!.myDamage

    // XATO javob — zarar 0
    await request(app).post(`/api/progress/${U1}/result`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ questionId: q.id, selectedAnswer: wrongOpt, subjectId: 'yhq', clientToken: randomBytes(16).toString('hex') })
      .expect(200)
    const afterWrong = (await bossRepository.getState(U1, periodKey))!.myDamage
    expect(afterWrong).toBe(before)

    // TO'G'RI javob — aynan +DAMAGE_PER_CORRECT (fresh user: gate o'tadi)
    await request(app).post(`/api/progress/${U1}/result`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ questionId: q.id, selectedAnswer: q.correctAnswer, subjectId: 'yhq', clientToken: randomBytes(16).toString('hex') })
      .expect(200)
    const afterOk = (await bossRepository.getState(U1, periodKey))!.myDamage
    expect(afterOk).toBe(before + BOSS_DAMAGE_PER_CORRECT)
  })
})

describe('boss — applyDamage atomikligi + rollover (soxta period)', () => {
  it('HP 0 dan pastga tushmaydi; faqat BITTA zarar "defeated" qiladi; rollover mukofot IDEMPOTENT', async () => {
    // Ishtirokchilar: U1 — 60 zarar (top1), U2 — 15 (top2), U3 — 5 (threshold'dan PAST)
    await bossRepository.applyDamage(U1, P_FAKE_ROLL, 60)
    await bossRepository.applyDamage(U2, P_FAKE_ROLL, 15)
    await bossRepository.applyDamage(U3, P_FAKE_ROLL, 5)

    // Hunter zarba: HP'ni deyarli 0 holatiga keltirib, bir zarba bilan yengamiz
    await executeRows(sql`
      UPDATE boss_battles SET hp_left = ${BOSS_DAMAGE_PER_CORRECT} WHERE period_key = ${P_FAKE_ROLL}
    `)
    const kill = await bossRepository.applyDamage(U1, P_FAKE_ROLL, BOSS_DAMAGE_PER_CORRECT)
    expect(kill?.defeated).toBe(true)

    // O'lgandan keyin zarar: defeated QAYTA emas, HP 0'da qotilgan
    const after = await bossRepository.applyDamage(U2, P_FAKE_ROLL, BOSS_DAMAGE_PER_CORRECT)
    expect(after?.defeated).toBe(false)
    const [row] = await db.select().from(bossBattles).where(eq(bossBattles.periodKey, P_FAKE_ROLL))
    expect(row.hpLeft).toBe(0)
    expect(row.status).toBe('defeated')

    // Balans snapshot (mukofot DELTA'lari uchun)
    const bal1 = (await coinsRepository.getEconomyState(U1)).coins
    const bal2 = (await coinsRepository.getEconomyState(U2)).coins
    const bal3 = (await coinsRepository.getEconomyState(U3)).coins

    // ROLLOVER: distributed + to'g'ri summalar (U1: 25+100, U2: 25+60, U3: 0)
    const roll = await bossRepository.weeklyRollover(P_FAKE_ROLL)
    expect(roll.distributed).toBe(true)
    expect(roll.awarded).toBe(2)
    expect((await coinsRepository.getEconomyState(U1)).coins).toBe(bal1 + BOSS_REWARDS.participationCoins + BOSS_REWARDS.topCoins[0])
    expect((await coinsRepository.getEconomyState(U2)).coins).toBe(bal2 + BOSS_REWARDS.participationCoins + BOSS_REWARDS.topCoins[1])
    expect((await coinsRepository.getEconomyState(U3)).coins).toBe(bal3)   // threshold'dan past — YO'Q

    // Ledger: har winner uchun BITTA 'boss_reward' qatori
    const hist1 = (await coinsRepository.getHistory(U1, 100)).filter((h) => h.reason === 'boss_reward')
    expect(hist1.length).toBe(1)
    expect(hist1[0].delta).toBe(BOSS_REWARDS.participationCoins + BOSS_REWARDS.topCoins[0])

    // RETRY: flags — qayta mukofot YO'Q (balans o'zgarmaydi)
    const roll2 = await bossRepository.weeklyRollover(P_FAKE_ROLL)
    expect(roll2.distributed).toBe(false)
    expect((await coinsRepository.getEconomyState(U1)).coins).toBe(bal1 + BOSS_REWARDS.participationCoins + BOSS_REWARDS.topCoins[0])
  })

  it('rollover: "active" boss "escaped"ga aylanadi (mukofotsiz); yangi boss idempotent ensure', async () => {
    await bossRepository.ensureActiveBoss(P_FAKE_ESC)   // yangi, hech kim zararsiz
    const roll = await bossRepository.weeklyRollover(P_FAKE_ESC)
    expect(roll.escaped).toBe(true)
    expect(roll.distributed).toBe(false)
    const [row] = await db.select().from(bossBattles).where(eq(bossBattles.periodKey, P_FAKE_ESC))
    expect(row.status).toBe('escaped')

    // ensure idempotent: periodKey UNIQUE — takror chaqiruv xato bermaydi
    await bossRepository.ensureActiveBoss(P_FAKE_ESC)
    await bossRepository.ensureActiveBoss(P_FAKE_ESC)
    const cnt = await db.select().from(bossBattles).where(eq(bossBattles.periodKey, P_FAKE_ESC))
    expect(cnt.length).toBe(1)
  })
})

describe('boss — cron endpoint', () => {
  it('noto\'g\'ri secret → 401; to\'g\'ri → 200 (real prevPeriod idempotent)', async () => {
    await request(app).get('/api/cron/boss-rollover')
      .set('Authorization', 'Bearer xato-secret').expect(401)
    const res = await request(app).get('/api/cron/boss-rollover')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`).expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body).toHaveProperty('prevPeriod')
    // Qayta chaqiruv: jobRuns guard — skipped
    const res2 = await request(app).get('/api/cron/boss-rollover')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`).expect(200)
    expect(res2.body.skipped ?? res2.body.ok).toBeTruthy()
  })
})
