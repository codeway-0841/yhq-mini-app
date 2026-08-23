/**
 * Javob vaqtini yozish — POST /api/progress/:userId/result `elapsedMs` maydoni.
 *
 * Nima uchun: savollarga qo'lda "oson/qiyin" bahosi qo'yilmaydi; buning o'rniga
 * javob vaqti yig'iladi va qiyinlik keyinchalik MA'LUMOTDAN chiqariladi.
 * Hozircha bu qiymat hech qanday ball/XP/coin'ga ta'sir qilmaydi — faqat
 * `progress_questions.first_ms` / `last_ms` ustunlariga yoziladi.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { answerTokens, progress, progressQuestions, questions, users } from '../../../server/schema'

const app = createApp()
const UID = '998877670001'

async function cleanup() {
  await db.delete(answerTokens).where(eq(answerTokens.userId, UID))
  await db.delete(users).where(eq(users.id, UID))   // cascade: progress, progress_questions
}

/** Shu foydalanuvchining berilgan savol bo'yicha yozuvi */
async function row(questionId: number) {
  const rows = await db.select().from(progressQuestions).where(and(
    eq(progressQuestions.userId, UID),
    eq(progressQuestions.subjectId, 'yhq'),
    eq(progressQuestions.questionId, questionId),
  ))
  return rows[0]
}

/** Savol + ATAYIN NOTO'G'RI variant: xato javob anti-farm gate'ini bosmaydi,
 *  shuning uchun takroriy javoblar ham yoziladi (vaqt to'g'rilikka bog'liq emas). */
let bank: { id: number; wrong: string }[]

beforeAll(async () => {
  await cleanup()
  await request(app).post('/api/init').send({
    id: UID, first_name: 'Timing', last_name: 'Test', username: 'timing_test',
  }).expect(200)

  // CI bazasida atigi 3 ta seed savol bor — testlar shundan ortig'iga
  // TAYANMAYDI: har test oldidan foydalanuvchi savol tarixi tozalanadi,
  // shuning uchun bir xil savol qayta ishlatilaveradi.
  const rows = await db.select().from(questions)
    .where(eq(questions.bankId, 'traffic_rules_db'))
    .limit(10)
  expect(rows.length).toBeGreaterThanOrEqual(2)
  bank = rows.map((q) => ({
    id: q.id,
    wrong: Object.keys(q.optionsUz).find((k) => k !== q.correctAnswer) ?? '__wrong__',
  }))
})

/** Har test toza tarix bilan boshlanadi (savollar soni cheklangani uchun) */
beforeEach(async () => {
  await db.delete(progressQuestions).where(eq(progressQuestions.userId, UID))
})

afterAll(cleanup)

const answer = (q: { id: number; wrong: string }, body: Record<string, unknown>) =>
  request(app).post(`/api/progress/${UID}/result`)
    .send({ questionId: q.id, selectedAnswer: q.wrong, subjectId: 'yhq', ...body })

describe('POST /result — elapsedMs', () => {
  it('javob vaqti first_ms va last_ms ga yoziladi', async () => {
    const q = bank[0]!
    await answer(q, { elapsedMs: 4200 }).expect(200)

    const r = await row(q.id)
    expect(r?.firstMs).toBe(4200)
    expect(r?.lastMs).toBe(4200)
  })

  it('takroriy javobda first_ms O\'ZGARMAYDI, last_ms yangilanadi', async () => {
    const q = bank[0]!
    await answer(q, { elapsedMs: 3000 }).expect(200)
    await answer(q, { elapsedMs: 900 }).expect(200)

    const r = await row(q.id)
    expect(r?.firstMs).toBe(3000)   // birinchi urinish saqlanadi
    expect(r?.lastMs).toBe(900)     // tezlashgani ko'rinadi
  })

  it('elapsedMs yuborilmasa qatorlar buzilmaydi (eski clientlar)', async () => {
    const q = bank[1]!
    await answer(q, {}).expect(200)

    const r = await row(q.id)
    expect(r).toBeDefined()
    expect(r?.firstMs).toBeNull()
    expect(r?.lastMs).toBeNull()
  })

  it('eski client vaqtsiz javob bersa — mavjud first_ms o\'chib ketmaydi', async () => {
    const q = bank[0]!
    await answer(q, { elapsedMs: 5500 }).expect(200)
    await answer(q, {}).expect(200)   // vaqtsiz takror

    const r = await row(q.id)
    expect(r?.firstMs).toBe(5500)
    expect(r?.lastMs).toBe(5500)
  })

  it('yaroqsiz qiymat rad etiladi (manfiy, kasr, 10 daqiqadan uzun)', async () => {
    const q = bank[0]!
    await answer(q, { elapsedMs: -1 }).expect(400)
    await answer(q, { elapsedMs: 12.5 }).expect(400)
    await answer(q, { elapsedMs: 600_001 }).expect(400)
  })

  it('vaqt ball/coin hisobiga TA\'SIR QILMAYDI', async () => {
    const [before] = await db.select().from(progress).where(eq(progress.userId, UID))
    const q = bank[0]!
    await answer(q, { elapsedMs: 599_000 }).expect(200)   // juda sekin javob
    const [after] = await db.select().from(progress).where(eq(progress.userId, UID))

    // Javob hisoblandi (answered oshdi), lekin sekinligi uchun jarima yo'q
    expect(after!.totalAnswered).toBe(before!.totalAnswered + 1)
  })
})
