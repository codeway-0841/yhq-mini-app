/**
 * Leaderboard — integration testlar (real test DB).
 *
 * Qamrov:
 *  - topN: totalCorrect DESC, streak DESC tartib; rank 1-based; isYou flag
 *  - progress qatorisiz user (bot invoice upsert yo'li) topN'da KO'RINMAYDI
 *    (audit fix: FROM users LEFT JOIN progress → FROM progress INNER JOIN
 *    users — bu userlar totalCorrect=0 bo'lgani uchun bu qasddan xulq).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../../server/db/connection'
import { users, progress, dailyRecords } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import {
  leaderboardRepository, todayTashkent, monthStartTashkent,
} from '../../../server/modules/leaderboard/leaderboard.repository'

const U1 = '990000006001'   // totalCorrect 30
const U2 = '990000006002'   // totalCorrect 20
const U3 = '990000006003'   // progress'siz (upsert yo'li — bot invoice holati)
const U4 = '990000006004'   // bugungi dailyRecords 15 (kunlik/oylik'da top)
const U5 = '990000006005'   // bugungi dailyRecords 10
const U6 = '990000006006'   // shu oyning boshida (monthStart) dailyRecords 8 — kunlikda YO'Q, oylikda BOR
const U7 = '990000006007'   // o'tgan oy dailyRecords 100 — kunlikda ham oylikda ham YO'Q
const IDS = [U1, U2, U3, U4, U5, U6, U7]

/** 'YYYY-MM-DD' → shu sanadan 1 kun oldingi 'YYYY-MM-DD' (UTC kalendar, faqat test uchun) */
function prevDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function seedDaily(userId: string, date: string, correct: number) {
  await db.insert(dailyRecords).values({ userId, date, subjectId: 'yhq', answered: correct, correct })
    .onConflictDoUpdate({
      target: [dailyRecords.userId, dailyRecords.date, dailyRecords.subjectId],
      set: { answered: correct, correct },
    })
}

async function cleanup() {
  for (const id of IDS) {
    await db.delete(users).where(eq(users.id, id))   // FK cascade: progress + dailyRecords
  }
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: U1, firstName: 'Lead', lastName: 'One', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U2, firstName: 'Lead', lastName: 'Two', username: '', photoUrl: '' })
  // U3: progress'siz — real "bot invoice" stub-user holatini simulyatsiya qiladi
  await usersRepository.upsert({ id: U3, firstName: 'Lead', lastName: 'Three', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U4, firstName: 'Lead', lastName: 'Four', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U5, firstName: 'Lead', lastName: 'Five', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U6, firstName: 'Lead', lastName: 'Six', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: U7, firstName: 'Lead', lastName: 'Seven', username: '', photoUrl: '' })

  await db.update(progress).set({ totalCorrect: 30, totalAnswered: 30, streak: 5 }).where(eq(progress.userId, U1))
  await db.update(progress).set({ totalCorrect: 20, totalAnswered: 20, streak: 2 }).where(eq(progress.userId, U2))

  const today      = todayTashkent()
  const monthStart = monthStartTashkent()
  await seedDaily(U4, today, 15)
  await seedDaily(U5, today, 10)
  await seedDaily(U6, monthStart, 8)          // shu oyning ichida, lekin bugun emas
  await seedDaily(U7, prevDay(monthStart), 100)   // o'tgan oy — har ikkala reytingdan tashqarida
})

afterAll(cleanup)

describe('leaderboard — topN', () => {
  it('totalCorrect DESC tartibda qaytaradi; isYou callerUserId bo\'yicha to\'g\'ri', async () => {
    const rows = await leaderboardRepository.topN(100, U2)
    const r1 = rows.find((r) => r.userId === U1)!
    const r2 = rows.find((r) => r.userId === U2)!
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()
    expect(r1.score).toBe(30)
    expect(r2.score).toBe(20)
    expect(r1.rank).toBeLessThan(r2.rank)
    expect(r2.isYou).toBe(true)
    expect(r1.isYou).toBe(false)
  })

  it('progress qatorisiz user (upsert yo\'li) topN natijasida yo\'q', async () => {
    const rows = await leaderboardRepository.topN(100, null)
    expect(rows.find((r) => r.userId === U3)).toBeUndefined()
  })
})

describe('leaderboard — dailyTop', () => {
  it('faqat BUGUNGI dailyRecords SUM(correct) bo\'yicha, kamayish tartibida; isYou to\'g\'ri', async () => {
    const rows = await leaderboardRepository.dailyTop(100, U5)
    const r4 = rows.find((r) => r.userId === U4)!
    const r5 = rows.find((r) => r.userId === U5)!
    expect(r4).toBeDefined()
    expect(r5).toBeDefined()
    expect(r4.score).toBe(15)
    expect(r5.score).toBe(10)
    expect(r4.rank).toBeLessThan(r5.rank)
    expect(r5.isYou).toBe(true)
    expect(r4.isYou).toBe(false)
  })

  it('bugun dailyRecords qatori yo\'q user (o\'tgan oy) dailyTop\'da ko\'rinmaydi', async () => {
    const rows = await leaderboardRepository.dailyTop(100, null)
    expect(rows.find((r) => r.userId === U7)).toBeUndefined()
    // faqat bugun oy boshi bo'lmasa tekshiramiz — aks holda U6 sanasi bugungiga teng bo'lib qoladi
    if (monthStartTashkent() !== todayTashkent()) {
      expect(rows.find((r) => r.userId === U6)).toBeUndefined()
    }
  })
})

describe('leaderboard — monthlyTop', () => {
  it('joriy oy boshidan buyon SUM(correct) qaytaradi — bugungi va oy boshidagi qator ikkalasi ham kiradi', async () => {
    const rows = await leaderboardRepository.monthlyTop(100, null)
    const r4 = rows.find((r) => r.userId === U4)!
    const r6 = rows.find((r) => r.userId === U6)!
    expect(r4).toBeDefined()
    expect(r4.score).toBe(15)
    expect(r6).toBeDefined()
    expect(r6.score).toBe(8)
  })

  it('o\'tgan oy dailyRecords qatori monthlyTop\'da ko\'rinmaydi', async () => {
    const rows = await leaderboardRepository.monthlyTop(100, null)
    expect(rows.find((r) => r.userId === U7)).toBeUndefined()
  })
})
