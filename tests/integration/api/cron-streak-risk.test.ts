/**
 * cronRepository.streakSaveRiskForUsers — integration (real test DB).
 *
 * daily-reminder cron shu funksiya orqali "bugun ham o'tkazib yuborsa
 * ertaga nima bo'ladi" (gapDaysTomorrow) + premium/balans holatini oladi —
 * `shared/streak-save.ts` `decideStreakOutcome`ga uzatiladi (coin-save
 * ogohlantirishi uchun). Bot API chaqiruvi (`sendMessage`) shu qatlamda
 * yo'q — repository darajasida sinaladi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, dailyStreaks, userCoins } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { cronRepository } from '../../../server/modules/cron/cron.repository'

const U_YESTERDAY  = '990000008001'   // kecha faol — ertaga gapDays=1
const U_2DAYS_AGO  = '990000008002'   // 2 kun oldin faol — ertaga gapDays=2
const U_NO_STREAK  = '990000008003'   // umuman daily_streaks qatori yo'q
const U_NO_COINS   = '990000008004'   // streak bor, user_coins qatori YO'Q — balans 0ga tushishi shart
const IDS = [U_YESTERDAY, U_2DAYS_AGO, U_NO_STREAK, U_NO_COINS]

const TODAY = '2026-08-20'

async function cleanup() {
  for (const id of IDS) await db.delete(users).where(eq(users.id, id))
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'Risk', lastName: id.slice(-4), username: '', photoUrl: '' })
  }
  await db.update(users).set({ tariff: 'premium' }).where(eq(users.id, U_2DAYS_AGO))

  await db.insert(dailyStreaks).values({ userId: U_YESTERDAY, subjectId: 'yhq', streak: 5, lastDailyDate: '2026-08-19' })
  await db.insert(dailyStreaks).values({ userId: U_2DAYS_AGO, subjectId: 'yhq', streak: 8, lastDailyDate: '2026-08-18' })
  await db.insert(dailyStreaks).values({ userId: U_NO_COINS,  subjectId: 'yhq', streak: 3, lastDailyDate: '2026-08-19' })

  await db.insert(userCoins).values({ userId: U_YESTERDAY, balance: 200 })
  await db.insert(userCoins).values({ userId: U_2DAYS_AGO, balance: 30 })
  // U_NO_COINS uchun user_coins qatori QASDDAN yaratilmaydi (yangi user hali
  // birorta ham to'g'ri javob bermagan holatni simulyatsiya qiladi)
})

afterAll(cleanup)

describe('streakSaveRiskForUsers', () => {
  it('kecha faol bo\'lgan user uchun gapDaysTomorrow=1', async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    const r = risk.get(U_YESTERDAY)
    expect(r).toBeDefined()
    expect(r!.gapDaysTomorrow).toBe(1)
    expect(r!.premium).toBe(false)
    expect(r!.balance).toBe(200)
  })

  it('2 kun oldin faol bo\'lgan premium user uchun gapDaysTomorrow=2', async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    const r = risk.get(U_2DAYS_AGO)
    expect(r).toBeDefined()
    expect(r!.gapDaysTomorrow).toBe(2)
    expect(r!.premium).toBe(true)
    expect(r!.balance).toBe(30)
  })

  it('user_coins qatori yo\'q user uchun balans 0ga tushadi', async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    const r = risk.get(U_NO_COINS)
    expect(r).toBeDefined()
    expect(r!.balance).toBe(0)
  })

  it('daily_streaks qatori yo\'q user natijada umuman yo\'q', async () => {
    const risk = await cronRepository.streakSaveRiskForUsers(IDS, TODAY)
    expect(risk.has(U_NO_STREAK)).toBe(false)
  })

  it('bo\'sh ro\'yxat uchun bo\'sh Map', async () => {
    const risk = await cronRepository.streakSaveRiskForUsers([], TODAY)
    expect(risk.size).toBe(0)
  })
})
