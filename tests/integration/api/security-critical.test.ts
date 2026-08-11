import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { answerTokens, dailyRecords, payments, progress, questions, users } from '../../../server/schema'
import { paymentRepository } from '../../../server/modules/payments/payment.repository'
import { tashkentDate } from '../../../server/utils/date'

const app = createApp()
// user_id TEXT (0023+) — string id'lar shart (Postgres'ta text = bigint operatori yo'q)
const PROGRESS_ID = '998877660001'
const TRIAL_ID = '998877660002'
const PAYMENT_ID = '998877660003'
const IDS = [PROGRESS_ID, TRIAL_ID, PAYMENT_ID]

async function cleanup() {
  for (const id of IDS) {
    await db.delete(answerTokens).where(eq(answerTokens.userId, id))
    await db.delete(payments).where(eq(payments.userId, id))
    await db.delete(users).where(eq(users.id, id))
  }
}

beforeAll(async () => {
  await cleanup()
  await request(app).post('/api/init').send({
    id: String(PROGRESS_ID), first_name: 'Progress', last_name: 'Test', username: 'progress_test',
  }).expect(200)
  await request(app).post('/api/init').send({
    id: String(TRIAL_ID), first_name: 'Trial', last_name: 'Test', username: 'trial_test',
  }).expect(200)
  await db.insert(users).values({
    id: PAYMENT_ID, firstName: 'Payment', lastName: 'Test', username: 'payment_test', photoUrl: '',
  })
})

afterAll(cleanup)

describe('server-authoritative progress', () => {
  it('selectedAnswer asosida score va daily counterlarni server hisoblaydi', async () => {
    const [question] = await db.select().from(questions).limit(1)
    expect(question).toBeDefined()
    const wrongAnswer = Object.keys(question.optionsUz).find((key) => key !== question.correctAnswer) ?? '__wrong__'

    const wrong = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: wrongAnswer, subjectId: 'yhq', correct: true })
      .expect(200)
    expect(wrong.body.correct).toBe(false)

    // Multi-fan identity: xato composite kalitda ('yhq:<id>') yoziladi
    const [progWrong] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(progWrong.wrongByTicket[`yhq:${question.id}`]).toBe(1)

    const correct = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', correct: false })
      .expect(200)
    expect(correct.body.correct).toBe(true)

    const [prog] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(prog.totalAnswered).toBe(2)
    expect(prog.totalCorrect).toBe(1)
    expect(prog.totalWrong).toBe(1)
    // To'g'ri javobdan keyin kompozit kalit o'chirilgan
    expect(prog.wrongByTicket[`yhq:${question.id}`]).toBeUndefined()
    expect(prog.wrongByTicket[String(question.id)]).toBeUndefined() // tekis kalit ishlatilmaydi

    const [daily] = await db.select().from(dailyRecords).where(and(
      eq(dailyRecords.userId, PROGRESS_ID),
      eq(dailyRecords.date, tashkentDate()),
      eq(dailyRecords.subjectId, 'yhq'),
    ))
    expect(daily.answered).toBe(2)
    expect(daily.correct).toBe(1)
  })

  it('javob bilan birga correctAnswer POST-ANSWER REVEAL qilinadi (feedback uchun)', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const res = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq' })
      .expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.correct).toBe(true)
    expect(res.body.correctAnswer).toBe(question.correctAnswer)
    expect(typeof res.body.dailyStreak).toBe('number')
    expect(res.body.duplicate).toBeUndefined()
  })

  it('clientToken idempotency: replay counterlarni ikki marta oshirmaydi', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const [before] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    const token = `integration-token-${Date.now()}-uniq`

    const first = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: token })
      .expect(200)
    expect(first.body.duplicate).toBeUndefined()

    // XUDDI SHU token bilan replay (javob yo'qolgan outbox scenariysi)
    const replay = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: token })
      .expect(200)
    expect(replay.body.duplicate).toBe(true)
    expect(replay.body.dailyStreak).toBeNull()
    // DUPLICATE REVEAL YO'Q (scoring himoyasi): replay kalitni qayta ochmaydi —
    // aks holda bitta token aylanuvchib bepul answer-key yig'ish mumkin edi.
    expect(replay.body.correctAnswer).toBeNull()
    expect(replay.body.correct).toBeNull()

    const [after] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(after.totalAnswered).toBe(before.totalAnswered + 1)   // FAQAT 1 marta
    expect(after.totalCorrect).toBe(before.totalCorrect + 1)

    const tokens = await db.select().from(answerTokens).where(eq(answerTokens.token, token))
    expect(tokens).toHaveLength(1)
  })

  it('answer-key farming: bir token bilan qayta-qayta hisobsiz reveal olib bo\'lmaydi', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const token = `farming-token-${Date.now()}-uniq`

    const first = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: null, subjectId: 'yhq', clientToken: token })
      .expect(200)
    expect(first.body.correctAnswer).toBe(question.correctAnswer)  // birinchi — haqiqiy reveal

    // Har bir KEYINGI replay hech narsa ochmaydi (kalit yig'ish imkonsiz)
    for (let i = 0; i < 3; i++) {
      const replay = await request(app)
        .post(`/api/progress/${PROGRESS_ID}/result`)
        .send({ questionId: question.id, selectedAnswer: null, subjectId: 'yhq', clientToken: token })
        .expect(200)
      expect(replay.body.duplicate).toBe(true)
      expect(replay.body.correctAnswer).toBeNull()
      expect(replay.body.correct).toBeNull()
      expect(replay.body.dailyStreak).toBeNull()
    }
  })

  it('clientToken boshqa user tokenini qayta ishlatolmaydi (user-scoped)', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const token = `integration-cross-${Date.now()}-uniq`
    // PROGRESS_ID token yaratadi
    await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: token })
      .expect(200)
    // TRIAL_ID XUDDI SHU token bilan kelsa — token PK bo'lgani uchun
    // ON CONFLICT DO NOTHING → duplicate (u EMAS, lekin token band)
    const res = await request(app)
      .post(`/api/progress/${TRIAL_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: token })
      .expect(200)
    expect(res.body.duplicate).toBe(true)
  })

  it('fanlar orasida xatolar izolyatsiya qilingan (bir xil questionId, turli subject)', async () => {
    const [question] = await db.select().from(questions).limit(1)
    const wrongAnswer = Object.keys(question.optionsUz).find((key) => key !== question.correctAnswer) ?? '__wrong__'

    await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: wrongAnswer, subjectId: 'fizika' })
      .expect(200)

    const [prog] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(prog.wrongByTicket[`fizika:${question.id}`]).toBe(1)
    expect(prog.wrongByTicket[`yhq:${question.id}`]).toBeUndefined()
  })
})

describe('public questions payload — correctAnswer yashiringan', () => {
  it('GET /api/questions correctAnswer QAYTARMAYDI (scoring trust boundary)', async () => {
    const res = await request(app).get('/api/questions').expect(200)
    expect(res.body.length).toBeGreaterThan(0)
    for (const row of res.body.slice(0, 10)) {
      expect(row.correctAnswer).toBeUndefined()
      expect(row.questionUz).toBeDefined()
      expect(row.optionsUz).toBeDefined()
    }
  })

  it('topicId filtrli ham correctAnswer QAYTARMAYDI', async () => {
    const [q] = await db.select().from(questions).limit(1)
    if (!q.topicId) return
    const res = await request(app).get(`/api/questions?topicId=${q.topicId}`).expect(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0].correctAnswer).toBeUndefined()
  })
})

describe('trial race protection', () => {
  it('parallel requestlardan faqat bittasiga trial beradi', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      request(app).post(`/api/users/${TRIAL_ID}/trial`).send({}),
    ))
    expect(responses.filter((res) => res.body.granted === true)).toHaveLength(1)
    expect(responses.filter((res) => res.body.reason === 'already_used')).toHaveLength(7)
  })
})

describe('payment idempotency', () => {
  it('bir charge ID uchun premiumni faqat bir marta uzaytiradi', async () => {
    const input = {
      telegramChargeId: 'integration-charge-998877660003',
      providerChargeId: 'provider-charge-998877660003',
      userId: PAYMENT_ID,
      plan: 'month' as const,
      days: 30,
      amount: 99,
      currency: 'XTR',
      payload: `premium_month_${PAYMENT_ID}`,
      rawUpdate: { integration: true },
    }

    await expect(paymentRepository.complete(input)).resolves.toBe('activated')
    const [afterFirst] = await db.select({ premiumUntil: users.premiumUntil })
      .from(users).where(eq(users.id, PAYMENT_ID))
    await expect(paymentRepository.complete(input)).resolves.toBe('duplicate')
    const [afterSecond] = await db.select({ premiumUntil: users.premiumUntil })
      .from(users).where(eq(users.id, PAYMENT_ID))

    expect(afterFirst.premiumUntil).not.toBeNull()
    expect(afterSecond.premiumUntil?.getTime()).toBe(afterFirst.premiumUntil?.getTime())
    const rows = await db.select().from(payments).where(eq(payments.userId, PAYMENT_ID))
    expect(rows).toHaveLength(1)
  })
})
