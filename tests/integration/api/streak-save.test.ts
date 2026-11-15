/**
 * Brilliant 1:1 Streak Charge (Zaryad) — integration (real test DB).
 *
 * Qamrov:
 *   - Har 3 ta tugallangan dars/test birligi -> +1 zaryad (max 2, kuymaydi)
 *   - Kuniga ko'pi bilan 1 ta batareya (`lastChargeEarnedDate < today`)
 *   - Barcha fanlar bo'yicha global qoida (rus-tili + yhq/fizika birga hisoblanadi; Free == Premium)
 *   - Sessiyasiz 20 ta savol marrasi (+1 birlik)
 *   - Uzilish (`gapDays >= 1`): `charges >= gapDays` -> sarflanib seriya saqlanadi, coin yechilmaydi;
 *     `charges < gapDays` -> seriya 1 ga tushadi, mavjud zaryadlar kuymaydi
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, dailyStreaks, userCoins } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { dailyRepository } from '../../../server/modules/daily/daily.repository'
import { progressRepository } from '../../../server/modules/progress/progress.repository'
import { COINS_PER_CORRECT_ANSWER } from '../../../shared/shop-items'
import { STREAK_CHARGE_DAILY_MIN_ANSWERS } from '../../../shared/streak-save'

const U_FREE    = '990000007001'
const U_GLOBAL  = '990000007002'
const U_PREMIUM = '990000007003'
const IDS = [U_FREE, U_GLOBAL, U_PREMIUM]

const SUBJ = 'yhq'

async function cleanup() {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
}

async function seedStreak(
  userId: string,
  lastDate: string,
  streak: number,
  charges = 0,
  chargeProgress = 0,
  lastChargeEarnedDate: string | null = null,
) {
  await db.insert(dailyStreaks)
    .values({
      userId, subjectId: SUBJ, streak, charges, chargeProgress, lastChargeEarnedDate,
      lastDailyDate: lastDate, updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [dailyStreaks.userId, dailyStreaks.subjectId],
      set: { streak, charges, chargeProgress, lastChargeEarnedDate, lastDailyDate: lastDate, updatedAt: new Date() },
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

describe("Brilliant 1:1 Streak Charge — sarflash va saqlash (coin yechilmaydi)", () => {
  it("zaryad 0 + 1 kun uzilish (balans katta bo'lsa ham) → coin yechilmaydi, seriya 1 ga reset", async () => {
    await seedStreak(U_FREE, '2026-08-10', 9, 0)
    await seedCoins(U_FREE, 500)

    const res = await dailyRepository.touchActivity(U_FREE, '2026-08-12', SUBJ, 15, 10)

    expect(res.chargeSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(res.streakCharges).toBe(0)
    expect(await balanceOf(U_FREE)).toBe(500)
  })

  it('zaryad 1 + 1 kun uzilish → 1 ta zaryad sarflanadi, seriya SAQLANADI (o‘smaydi), coin tegilmaydi', async () => {
    await seedStreak(U_FREE, '2026-08-20', 7, 1)
    await seedCoins(U_FREE, 200)

    const res = await dailyRepository.touchActivity(U_FREE, '2026-08-22', SUBJ, 15, 10)

    expect(res.chargeSaved).toBe(true)
    expect(res.dailyStreak).toBe(7)
    expect(res.streakCharges).toBe(0)
    expect(await balanceOf(U_FREE)).toBe(200)
  })

  it('zaryad 2 + ketma-ket 2 kun uzilish → 2 ta zaryad sarflanib seriya SAQLANADI', async () => {
    await seedStreak(U_PREMIUM, '2026-08-01', 12, 2)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-04', SUBJ, 15, 10)

    expect(res.chargeSaved).toBe(true)
    expect(res.dailyStreak).toBe(12)
    expect(res.streakCharges).toBe(0)
  })

  it('zaryad 1 + ketma-ket 2 kun uzilish → yetarli zaryad yo‘q (reset), lekin mavjud 1 ta zaryad kuymaydi', async () => {
    await seedStreak(U_PREMIUM, '2026-08-10', 20, 1)

    const res = await dailyRepository.touchActivity(U_PREMIUM, '2026-08-13', SUBJ, 15, 10)

    expect(res.chargeSaved).toBe(false)
    expect(res.dailyStreak).toBe(1)
    expect(res.streakCharges).toBe(1)
  })
})

describe("Brilliant 1:1 Streak Charge — global yig‘ish qoidasi (3 birlik = +1, kuniga max 1)", () => {
  it("bir kunda 3 ta dars/sessiya = +1 batareya; o‘sha kuni yana 3 ta dars qo‘shimcha batareya bermaydi", async () => {
    await seedStreak(U_FREE, '2026-05-10', 4, 0, 0, null)

    const u1 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    expect(u1.chargeEarned).toBe(false)
    expect(u1.streakCharges).toBe(0)

    const u2 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    expect(u2.chargeEarned).toBe(false)
    expect(u2.streakCharges).toBe(0)

    const u3 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    expect(u3.chargeEarned).toBe(true)
    expect(u3.streakCharges).toBe(1)

    // Shu kunning o'zida 4, 5, 6-darslar: kunlik limit = 1 batareya
    const u4 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    const u5 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    const u6 = await dailyRepository.touchActivity(U_FREE, '2026-05-11', SUBJ, 6, 6, undefined, true)
    expect(u4.chargeEarned).toBe(false)
    expect(u5.chargeEarned).toBe(false)
    expect(u6.chargeEarned).toBe(false)
    expect(u6.streakCharges).toBe(1)

    // Ertasi kuni yana 3 ta birlik -> 2-batareya beriladi
    await dailyRepository.touchActivity(U_FREE, '2026-05-12', SUBJ, 6, 6, undefined, true)
    await dailyRepository.touchActivity(U_FREE, '2026-05-12', SUBJ, 6, 6, undefined, true)
    const d2 = await dailyRepository.touchActivity(U_FREE, '2026-05-12', SUBJ, 6, 6, undefined, true)
    expect(d2.chargeEarned).toBe(true)
    expect(d2.streakCharges).toBe(2)
  })

  it('turli fanlardagi birliklar global tarzda qo‘shiladi (yhq + rustili + fizika)', async () => {
    await seedStreak(U_GLOBAL, '2026-06-01', 2, 0, 0, null)

    const a = await dailyRepository.touchActivity(U_GLOBAL, '2026-06-02', 'yhq', 6, 6, undefined, true)
    const b = await dailyRepository.touchActivity(U_GLOBAL, '2026-06-02', 'rustili', 6, 6, undefined, true)
    const c = await dailyRepository.touchActivity(U_GLOBAL, '2026-06-02', 'fizika', 6, 6, undefined, true)

    expect(a.chargeEarned).toBe(false)
    expect(b.chargeEarned).toBe(false)
    expect(c.chargeEarned).toBe(true)
    expect(c.streakCharges).toBe(1)
  })

  it('kuniga 20 ta test savoli yechilganda (0 progressdan ham) darhol +1 batareya beriladi (kuniga max 1)', async () => {
    await seedStreak(U_GLOBAL, '2026-07-01', 5, 0, 0, null)
    await seedCoins(U_GLOBAL, 100)

    const baseQ = 980_000
    for (let i = 1; i < STREAK_CHARGE_DAILY_MIN_ANSWERS; i++) {
      const r = await progressRepository.recordAnswer({
        userId: U_GLOBAL, correct: true, questionId: baseQ + i,
        date: '2026-07-02', subjectId: SUBJ, clientToken: `q20-${Date.now()}-${i}`,
      })
      expect(r.chargeEarned).toBe(false)
    }

    const r20 = await progressRepository.recordAnswer({
      userId: U_GLOBAL, correct: true, questionId: baseQ + STREAK_CHARGE_DAILY_MIN_ANSWERS,
      date: '2026-07-02', subjectId: SUBJ, clientToken: `q20-${Date.now()}-20`,
    })
    expect(r20.chargeEarned).toBe(true)
    expect(r20.streakCharges).toBe(1)

    // Shu kunning o'zida 21..25 savollar qo'shimcha batareya bermaydi (kuniga max 1)
    const r25 = await progressRepository.recordAnswer({
      userId: U_GLOBAL, correct: true, questionId: baseQ + 25,
      date: '2026-07-02', subjectId: SUBJ, clientToken: `q20-${Date.now()}-25`,
    })
    expect(r25.chargeEarned).toBe(false)
    expect(r25.streakCharges).toBe(1)
    expect(await balanceOf(U_GLOBAL)).toBe(100 + COINS_PER_CORRECT_ANSWER * (STREAK_CHARGE_DAILY_MIN_ANSWERS + 1))
  })
})
