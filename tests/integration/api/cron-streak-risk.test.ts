/**
 * cronRepository.streakSaveRiskForUsers — integration (real test DB).
 *
 * daily-reminder cron shu funksiya orqali "bugun ham o'tkazib yuborsa
 * ertaga nima bo'ladi" (gapDaysTomorrow) + joriy zaryad (`charges`) holatini oladi —
 * `shared/streak-save.ts` `decideStreakOutcome`ga uzatiladi.
 * Bot API chaqiruvi (`sendMessage`) shu qatlamda yo'q — repository darajasida sinaladi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, dailyStreaks } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { cronRepository } from '../../../server/modules/cron/cron.repository'

const U_YESTERDAY  = '990000008001'   // kecha faol — ertaga gapDays=1
const U_2DAYS_AGO  = '990000008002'   // 2 kun oldin faol — ertaga gapDays=2
const U_NO_STREAK  = '990000008003'   // umuman daily_streaks qatori yo'q
const IDS = [U_YESTERDAY, U_2DAYS_AGO, U_NO_STREAK]

const TODAY = '2026-08-20'

async function cleanup() {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'Risk', lastName: id.slice(-4), username: '', photoUrl: '' })
  }

  await db.insert(dailyStreaks).values({ userId: U_YESTERDAY, subjectId: 'yhq', streak: 5, charges: 0, lastDailyDate: '2026-08-19' })
  await db.insert(dailyStreaks).values({ userId: U_2DAYS_AGO, subjectId: 'yhq', streak: 8, charges: 2, lastDailyDate: '2026-08-18' })
})

afterAll(cleanup)

describe('streakSaveRiskForUsers', () => {
  it("kecha faol bo'lgan user uchun gapDaysTomorrow=1", async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    const r = risk.get(U_YESTERDAY)
    expect(r).toBeDefined()
    expect(r!.gapDaysTomorrow).toBe(1)
    expect(r!.charges).toBe(0)
  })

  it("2 kun oldin faol bo'lgan zaryadli user uchun gapDaysTomorrow=2 va charges=2", async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    const r = risk.get(U_2DAYS_AGO)
    expect(r).toBeDefined()
    expect(r!.gapDaysTomorrow).toBe(2)
    expect(r!.charges).toBe(2)
  })

  it("daily_streaks qatori yo'q user natijada umuman yo'q", async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    expect(risk.has(U_NO_STREAK)).toBe(false)
  })

  it("bo'sh ro'yxat uchun bo'sh Map", async () => {
    const risk = await cronRepository.streakSaveRiskForUsers([], TODAY)
    expect(risk.size).toBe(0)
  })
})
