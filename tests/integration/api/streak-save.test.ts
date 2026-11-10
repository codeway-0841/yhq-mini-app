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

/** Streak qatorini aniq holatga qo'yadi (oxirgi faollik sanasi + seriya + zaryad) */
async function seedStreak(userId: string, lastDate: string, streak: number, charges = 0) {
  await db.insert(dailyStreaks)
    .values({ userId, subjectId: SUBJ, streak, charges, lastDailyDate: lastDate, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [dailyStreaks.userId, dailyStreaks.subjectId],
      set: { streak, charges, lastDailyDate: lastDate, updatedAt: new Date() },
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

describe("streak charge + coin-save — faollik (touchActivity) yo'li", () => {
  it('zaryad 0 + 1 kun uzilish + balans yetarli → coin yechiladi, seriya saqlanadi (o\'smaydi)', async () => {
    await seedStreak(U_FREE_RICH, '2026-08-10', 5, 0)
    await seedCoins(U_FREE_RICH, 200)

    const res = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-12', SUBJ, 15, 10)

    expect(res.coinSaved).toBe(true)
    expect(res.chargeSaved).toBe(false)
    expect(res.dailyStreak).toBe(5)
    expect(await balanceOf(U_FREE_RICH)).toBe(200 - STREAK_SAVE_COST)
  })

  it("bir kunda takroriy faollik coin'ni IKKI marta yechmaydi (idempotent)", async () => {
    await seedStreak(U_FREE_RICH, '2026-08-20', 5, 0)
    await seedCoins(U_FREE_RICH, 200)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 15, 10)
    const afterFirst = await balanceOf(U_FREE_RICH)
    const second = await dailyRepository.touchActivity(U_FREE_RICH, '2026-08-22', SUBJ, 1, 1)

    expect(second.coinSaved).toBe(false)
    expect(await balanceOf(U_FREE_RICH)).toBe(afterFirst)
  })

  it('zaryad 0 + balans yetmaydi → seriya 1 ga tushadi, coin tegilmaydi', async () => {
    await seedStreak(U_FREE_POOR, '2026-08-10', 9, 0)
    await seedCoins(U_FREE_POOR, STREAK_SAVE_COST - 1)

    const res = await dailyRepository.touchActivity(U_FREE_POOR, '2026-08-12', SUBJ, 15, 5)

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_FREE_POOR)).toBe(STREAK_SAVE_COST - 1)
  })

  it('zaryad bor (charges=1) + 1 kun uzilish → zaryad sarflanadi, seriya SAQLANADI (coin tegilmaydi)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-10', 7, 1)
    await seedCoins(U_PREMIUM, 200)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-12', SUBJ, 15, 10)

    expect(res.chargeSaved).toBe(true)
    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(7)
    expect(res.streakCharges).toBe(0)
    expect(await balanceOf(U_PREMIUM)).toBe(200)
  })

  it('2+ kun uzilish → zaryad ham, coin ham ishlamaydi (reset)', async () => {
    await seedStreak(U_PREMIUM, '2026-08-01', 20, 2)
    await seedCoins(U_PREMIUM, 10_000)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-06', SUBJ, 15, 10)

    expect(res.coinSaved).toBe(false)
    expect(res.chargeSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(res.streakCharges).toBe(2)
    expect(await balanceOf(U_PREMIUM)).toBe(10_000)
  })

  it('7-kunlik faol seriyada +1 zaryad beriladi (max 2)', async () => {
    await seedStreak(U_FREE_RICH, '2026-05-10', 6, 0)
    const res = await dailyRepository.touchActivity(U_FREE_RICH, '2026-05-11', SUBJ, 15, 10)

    expect(res.dailyStreak).toBe(7)
    expect(res.chargeEarned).toBe(true)
    expect(res.streakCharges).toBe(1)
  })

  it('coin yechilganda ledgerga streak_save qatori yoziladi', async () => {
    await seedStreak(U_FREE_RICH, '2026-07-10', 3, 0)
    await seedCoins(U_FREE_RICH, 500)

    await dailyRepository.touchActivity(U_FREE_RICH, '2026-07-12', SUBJ, 15, 10)

    const rows = await db.select({ delta: coinTransactions.delta, refId: coinTransactions.refId })
      .from(coinTransactions)
      .where(and(eq(coinTransactions.userId, U_FREE_RICH), eq(coinTransactions.reason, 'streak_save')))

    const hit = rows.find((r) => r.refId === `${SUBJ}:2026-07-12`)
    expect(hit).toBeDefined()
    expect(hit!.delta).toBe(-STREAK_SAVE_COST)
  })
})

describe("streak coin-save — javob (recordAnswer) yo'li", () => {
  it("1 ta javob (< 15 va streakQualified=false) streak yozmaydi; streakQualified=true da NET delta saqlanadi", async () => {
    await seedStreak(U_FREE_RICH, '2026-06-10', 4, 0)
    await seedCoins(U_FREE_RICH, 500)

    const singleAns = await progressRepository.recordAnswer({
      userId: U_FREE_RICH, correct: true, questionId: 987654,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-single-${Date.now()}`,
    })
    expect(singleAns.dailyStreak).toBeNull()
    expect(singleAns.coinSaved).toBe(false)
    expect(await balanceOf(U_FREE_RICH)).toBe(500 + COINS_PER_CORRECT_ANSWER)

    const qualified = await progressRepository.recordAnswer({
      userId: U_FREE_RICH, correct: true, questionId: 987656,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-net-${Date.now()}`,
      streakQualified: true,
    })
    expect(qualified.coinSaved).toBe(true)
    expect(qualified.dailyStreak).toBe(4)
    expect(await balanceOf(U_FREE_RICH)).toBe(500 + COINS_PER_CORRECT_ANSWER * 2 - STREAK_SAVE_COST)
  })

  it('javob yo\'lida balans yetmasa — seriya reset, coin tegilmaydi (mint baribir bo\'ladi)', async () => {
    await seedStreak(U_FREE_POOR, '2026-06-10', 8, 0)
    await seedCoins(U_FREE_POOR, STREAK_SAVE_COST - 1)

    const res = await progressRepository.recordAnswer({
      userId: U_FREE_POOR, correct: true, questionId: 987655,
      date: '2026-06-12', subjectId: SUBJ, clientToken: `streak-poor-${Date.now()}`,
      streakQualified: true,
    })

    expect(res.coinSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(await balanceOf(U_FREE_POOR)).toBe(STREAK_SAVE_COST - 1 + COINS_PER_CORRECT_ANSWER)
  })
})
