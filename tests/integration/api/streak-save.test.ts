/**
 * Streak coin-save — integration (real test DB).
 *
 * Qamrov: bosqichlar (premium bepul kun / coin kun / reset), balans yetmasligi,
 * idempotentlik (kuniga 1 marta), ledger yozuvi, javob yo'lida NET delta
 * (mint + save bitta user_coins yozuvida — mint yo'qolmasligi shart).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, dailyStreaks, userCoins, coinTransactions } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { dailyRepository } from '../../../server/modules/daily/daily.repository'
import { progressRepository } from '../../../server/modules/progress/progress.repository'
import { STREAK_SAVE_COST } from '../../../shared/streak-save'
import { COINS_PER_CORRECT_ANSWER } from '../../../shared/shop-items'

const U_FREE_RICH = '990000007001'   // premium emas, balans yetarli
const U_FREE_POOR = '990000007002'   // premium emas, balans yetmaydi
const U_PREMIUM   = '990000007003'   // premium
const IDS = [U_FREE_RICH, U_FREE_POOR, U_PREMIUM]

const SUBJ = 'yhq'

async function cleanup() {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
}

/** Streak qatorini aniq holatga qo'yadi (oxirgi faollik sanasi + seriya) */
async function seedStreak(userId: string, lastDate: string, streak: number) {
  await db.insert(dailyStreaks)
    .values({ userId, subjectId: SUBJ, streak, lastDailyDate: lastDate, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [dailyStreaks.userId, dailyStreaks.subjectId],
      set: { streak, lastDailyDate: lastDate, updatedAt: new Date() },
    })
}

async function seedCoins(userId: string, balance: number) {
  await db.insert(userCoins).values({ userId, balance, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userCoins.userId, set: { balance, updatedAt: new Date() } })
}

async function balanceOf(userId: string): Promise<number> {
  const [row] = await db.select({ b: userCoins.balance }).from(userCoins).where(eq(userCoins.userId, userId))
  return row?.b ?? 0
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'Streak', lastName: id.slice(-4), username: '', photoUrl: '' })
  }
  await db.update(users).set({ tariff: 'premium' }).where(eq(users.id, U_PREMIUM))
})

afterAll(cleanup)

describe("streak coin-save — faollik (touchActivity) yo'li", () => {
  it('premium EMAS + 1 kun uzilish + balans yetarli → coin yechiladi, seriya davom etadi', async () => {
    await seedStreak(U_FREE_RICH, '2026-08-10', 5)
    await seedCoins(U_FREE_RICH, 200)

    // 2026-08-12: oxirgi faollik + 2 kun → gapDays = 1
    const res = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(true)
    expect(res.dailyStreak).toBe(6)
    expect(await balanceOf(U_FREE_RICH)).toBe(200 - STREAK_SAVE_COST)
  })

  it("bir kunda takroriy faollik coin'ni IKKI marta yechmaydi (idempotent)", async () => {
    await seedStreak(U_FREE_RICH, '2026-08-20', 5)
    await seedCoins(U_FREE_RICH, 200)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 1, 1)
    const afterFirst = await balanceOf(U_FREE_RICH)
    const second = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 1, 1)

    expect(second.coinSaved).toBe(false)
    expect(await balanceOf(U_FREE_RICH)).toBe(afterFirst)
  })

  it('premium EMAS + balans yetmaydi → seriya 1 ga tushadi, coin tegilmaydi', async () => {
    await seedStreak(U_FREE_POOR, '2026-08-10', 9)
    await seedCoins(U_FREE_POOR, STREAK_SAVE_COST - 1)

    const res = await dailyRepository.touchActivity(U_FREE_POOR, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_FREE_POOR)).toBe(STREAK_SAVE_COST - 1)
  })

  it('premium + 1 kun uzilish → BEPUL saqlanadi (coin yechilmaydi)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-10', 7)
    await seedCoins(U_PREMIUM, 200)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-12', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(8)
    expect(await balanceOf(U_PREMIUM)).toBe(200)
  })

  it('premium + 2 kun uzilish → coin yechiladi (bepul kun ishlatilgan)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-14', 7)
    await seedCoins(U_PREMIUM, 200)

    // 2026-08-17: oxirgi + 3 kun → gapDays = 2
    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-17', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(true)
    expect(res.dailyStreak).toBe(8)
    expect(await balanceOf(U_PREMIUM)).toBe(200 - STREAK_SAVE_COST)
  })

  it('3+ kun uzilish → hech qanday holatda saqlanmaydi', async () => {
    await seedStreak(U_PREMIUM, '2026-08-01', 20)
    await seedCoins(U_PREMIUM, 10_000)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-06', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_PREMIUM)).toBe(10_000)
  })

  it('uzluksiz kun (gapDays=0) — coin tegilmaydi, seriya +1', async () => {
    await seedStreak(U_FREE_RICH, '2026-05-10', 4)
    await seedCoins(U_FREE_RICH, 500)

    const res = await dailyRepository.touchActivity(U_FREE_RICH, '2026-05-11', SUBJ, 1, 1)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(5)
    expect(await balanceOf(U_FREE_RICH)).toBe(500)
  })

  it('coin yechilganda ledgerga streak_save qatori yoziladi', async () => {
    await seedStreak(U_FREE_RICH, '2026-07-10', 3)
    await seedCoins(U_FREE_RICH, 500)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-07-12', SUBJ, 1, 1)

    const rows = await db.select({ delta: coinTransactions.delta, refId: coinTransactions.refId })
      .from(coinTransactions)
      .where(and(eq(coinTransactions.userId, U_FREE_RICH), eq(coinTransactions.reason, 'streak_save')))

    const hit = rows.find((r) => r.refId === `${SUBJ}:2026-07-12`)
    expect(hit).toBeDefined()
    expect(hit!.delta).toBe(-STREAK_SAVE_COST)
  })
})

describe("streak coin-save — javob (recordAnswer) yo'li", () => {
  it("to'g'ri javob + coin-save bir vaqtda → mint YO'QOLMAYDI (net delta)", async () => {
    await seedStreak(U_FREE_RICH, '2026-06-10', 4)
    await seedCoins(U_FREE_RICH, 500)

    // gapDays = 1 → coin-save; javob to'g'ri → mint
    const res = await progressRepository.recordAnswer({
      userId: U_FREE_RICH, correct: true, questionId: 987654,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-net-${Date.now()}`,
    })

    expect(res.coinSaved).toBe(true)
    expect(res.dailyStreak).toBe(5)
    expect(await balanceOf(U_FREE_RICH)).toBe(500 + COINS_PER_CORRECT_ANSWER - STREAK_SAVE_COST)
  })

  it('javob yo\'lida balans yetmasa — seriya reset, coin tegilmaydi (mint baribir bo\'ladi)', async () => {
    await seedStreak(U_FREE_POOR, '2026-06-10', 8)
    await seedCoins(U_FREE_POOR, STREAK_SAVE_COST - 1)

    const res = await progressRepository.recordAnswer({
      userId: U_FREE_POOR, correct: true, questionId: 987655,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-poor-${Date.now()}`,
    })

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_FREE_POOR)).toBe(STREAK_SAVE_COST - 1 + COINS_PER_CORRECT_ANSWER)
  })
})
