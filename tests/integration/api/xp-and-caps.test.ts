/**
 * XP va kunlik shiftlar — POST /api/progress/:userId/result.
 *
 * XP endi `totalCorrect`ning ko'paytmasi EMAS: o'rganish hodisasiga qarab
 * beriladi (yangi savol / xatoni tuzatish), kuniga esa shift bor. Coin ham
 * javoblardan kuniga cheklangan.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq, sql } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import {
  answerTokens, dailyLimits, dailyRecords, progress, progressQuestions, questions, userCoins, users,
} from '../../../server/schema'
import { tashkentDate } from '../../../server/utils/date'
import {
  XP_FIRST_CORRECT, XP_MISTAKE_FIXED, XP_DAILY_CAP, COINS_DAILY_ANSWER_CAP,
} from '../../../shared/xp'
import { COINS_PER_CORRECT_ANSWER } from '../../../shared/shop-items'

const app = createApp()
const UID = '998877680001'

let bank: { id: number; correctAnswer: string; wrongAnswer: string }[]

async function cleanup() {
  await db.delete(answerTokens).where(eq(answerTokens.userId, UID))
  await db.delete(users).where(eq(users.id, UID))   // cascade: progress, daily_limits, ...
}

/** Foydalanuvchini toza holatga qaytaradi (savol tarixi va shiftlar ham) */
async function resetUser() {
  await db.delete(progressQuestions).where(eq(progressQuestions.userId, UID))
  await db.delete(dailyLimits).where(eq(dailyLimits.userId, UID))
  await db.delete(dailyRecords).where(eq(dailyRecords.userId, UID))
  await db.delete(userCoins).where(eq(userCoins.userId, UID))
  await db.update(progress)
    .set({ xp: 0, totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, wrongByTicket: {} })
    .where(eq(progress.userId, UID))
}

const answer = (q: { id: number }, selectedAnswer: string) =>
  request(app).post(`/api/progress/${UID}/result`)
    .send({ questionId: q.id, selectedAnswer, subjectId: 'yhq' })

const xpOf = async () => {
  const [row] = await db.select({ xp: progress.xp }).from(progress).where(eq(progress.userId, UID))
  return row?.xp ?? 0
}

const limitsRow = async () => {
  const [row] = await db.select().from(dailyLimits)
    .where(and(eq(dailyLimits.userId, UID), eq(dailyLimits.date, tashkentDate())))
  return row
}

beforeAll(async () => {
  await cleanup()
  await request(app).post('/api/init').send({
    id: UID, first_name: 'Xp', last_name: 'Test', username: 'xp_test',
  }).expect(200)

  // FAQAT YHQ bankidagi savollar — boshqa bank savoli 'yhq' fanida 404 beradi.
  // CI bazasida atigi 3 ta seed savol bor (tests/integration/seed-db.ts),
  // shuning uchun testlar 3 tadan ortiq savolga TAYANMAYDI — har test oldidan
  // foydalanuvchi tarixi tozalanadi va o'sha savollar qayta ishlatiladi.
  const rows = await db.select().from(questions)
    .where(eq(questions.bankId, 'traffic_rules_db'))
    .limit(20)
  expect(rows.length).toBeGreaterThanOrEqual(3)
  bank = rows.map((q) => ({
    id: q.id,
    correctAnswer: q.correctAnswer,
    wrongAnswer: Object.keys(q.optionsUz).find((k) => k !== q.correctAnswer) ?? '__wrong__',
  }))
})

beforeEach(resetUser)
afterAll(cleanup)

describe('XP — o\'rganish hodisasiga qarab', () => {
  it('birinchi marta to\'g\'ri yechilgan savol XP beradi', async () => {
    const q = bank[0]!
    const res = await answer(q, q.correctAnswer).expect(200)

    expect(res.body.xpEarned).toBe(XP_FIRST_CORRECT)
    expect(res.body.xp).toBe(XP_FIRST_CORRECT)
    expect(await xpOf()).toBe(XP_FIRST_CORRECT)
  })

  it('xato javob XP bermaydi (lekin jarima ham yo\'q)', async () => {
    const q = bank[1]!
    const res = await answer(q, q.wrongAnswer).expect(200)

    expect(res.body.xpEarned).toBe(0)
    expect(await xpOf()).toBe(0)
  })

  it('avval xato qilingan savol tuzatilsa KO\'PROQ XP beradi', async () => {
    const q = bank[2]!
    await answer(q, q.wrongAnswer).expect(200)
    const fixed = await answer(q, q.correctAnswer).expect(200)

    expect(fixed.body.xpEarned).toBe(XP_MISTAKE_FIXED)
    expect(XP_MISTAKE_FIXED).toBeGreaterThan(XP_FIRST_CORRECT)
    expect(await xpOf()).toBe(XP_MISTAKE_FIXED)
  })

  it('allaqachon to\'g\'ri yechilgan savolni qayta bosish XP bermaydi', async () => {
    const q = bank[0]!
    await answer(q, q.correctAnswer).expect(200)
    const again = await answer(q, q.correctAnswer).expect(200)

    expect(again.body.duplicate).toBe(true)   // anti-farm gate
    expect(await xpOf()).toBe(XP_FIRST_CORRECT)   // o'zgarmadi
  })
})

describe('Kunlik XP shifti', () => {
  it('shift to\'lgach XP berilmaydi, lekin javob HISOBLANADI', async () => {
    // Shiftni deyarli to'ldirib qo'yamiz — 1 ta javoblik joy qoldiramiz
    await db.insert(dailyLimits).values({
      userId: UID, date: tashkentDate(), xpEarned: XP_DAILY_CAP - 4, coinsEarned: 0,
    })

    const q1 = bank[0]!
    const partial = await answer(q1, q1.correctAnswer).expect(200)
    expect(partial.body.xpEarned).toBe(4)          // qolgan joy qadar kesildi
    expect(await xpOf()).toBe(4)

    const q2 = bank[1]!
    const capped = await answer(q2, q2.correctAnswer).expect(200)
    expect(capped.body.xpEarned).toBe(0)           // shift to'ldi
    expect(await xpOf()).toBe(4)

    // Javobning o'zi baribir hisoblanadi (mashq to'xtamaydi)
    const [prog] = await db.select().from(progress).where(eq(progress.userId, UID))
    expect(prog!.totalCorrect).toBe(2)
    expect(prog!.totalAnswered).toBe(2)
  })

  it('shift kun bo\'yicha yuritiladi (kechagi hisob bugungisiga qo\'shilmaydi)', async () => {
    await db.insert(dailyLimits).values({
      userId: UID, date: '2020-01-01', xpEarned: XP_DAILY_CAP, coinsEarned: COINS_DAILY_ANSWER_CAP,
    })

    const q = bank[0]!
    const res = await answer(q, q.correctAnswer).expect(200)
    expect(res.body.xpEarned).toBe(XP_FIRST_CORRECT)   // bugun shift bo'sh
  })
})

describe('Kunlik coin shifti', () => {
  it('shift to\'lgach coin mint qilinmaydi', async () => {
    await db.insert(dailyLimits).values({
      userId: UID, date: tashkentDate(), xpEarned: 0, coinsEarned: COINS_DAILY_ANSWER_CAP,
    })
    await db.insert(userCoins).values({ userId: UID, balance: 100 }).onConflictDoNothing()

    const q = bank[0]!
    const res = await answer(q, q.correctAnswer).expect(200)

    expect(res.body.coinsEarned).toBe(0)
    const [coins] = await db.select().from(userCoins).where(eq(userCoins.userId, UID))
    expect(coins!.balance).toBe(100)      // o'zgarmadi

    // XP esa berilishi kerak — ikki shift bir-biriga bog'liq emas
    expect(res.body.xpEarned).toBe(XP_FIRST_CORRECT)
  })

  it('shift ichida coin oddiy mint bo\'ladi va hisob yuritiladi', async () => {
    const q = bank[1]!
    const res = await answer(q, q.correctAnswer).expect(200)

    expect(res.body.coinsEarned).toBe(COINS_PER_CORRECT_ANSWER)
    const row = await limitsRow()
    expect(row?.coinsEarned).toBe(COINS_PER_CORRECT_ANSWER)
    expect(row?.xpEarned).toBe(XP_FIRST_CORRECT)
  })
})

describe('daily_limits hisobi', () => {
  it('bir necha javobdan keyin yig\'indi to\'g\'ri', async () => {
    const used = bank.slice(0, 3)
    for (const q of used) {
      await answer(q, q.correctAnswer).expect(200)
    }

    const row = await limitsRow()
    expect(row?.xpEarned).toBe(used.length * XP_FIRST_CORRECT)
    expect(row?.coinsEarned).toBe(used.length * COINS_PER_CORRECT_ANSWER)
    expect(await xpOf()).toBe(used.length * XP_FIRST_CORRECT)
  })

  it('XP manfiy bo\'lmaydi (DB constraint)', async () => {
    await expect(
      db.execute(sql`UPDATE progress SET xp = -1 WHERE user_id = ${UID}`),
    ).rejects.toThrow()
  })
})
