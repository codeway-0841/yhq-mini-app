import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { answerTokens, dailyRecords, payments, progress, questions, questionBanks, topics, users } from '../../../server/schema'
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
  await db.delete(questions).where(eq(questions.id, 999111))
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
    // Anti-farm gate: oldingi test birinchi savolni TO'G'RI yechgan —
    // yangi (yechilmagan) savol uchun progressni reset qilamiz.
    await request(app).delete(`/api/progress/${PROGRESS_ID}`).expect(200)
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
    // Anti-farm gate: birinchi savol oldingi testlarda TO'G'RI yechilgan — reset.
    await request(app).delete(`/api/progress/${PROGRESS_ID}`).expect(200)
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
    // DUPLICATE REVEAL YO'Q (scoring himoyasi): replay kalitni qayta ochmaydi
    expect(replay.body.correctAnswer).toBeNull()
    expect(replay.body.correct).toBeNull()

    const [after] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(after.totalAnswered).toBe(before.totalAnswered + 1)
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
    expect(first.body.correctAnswer).toBe(question.correctAnswer)

    // Har bir KEYINGI replay hech narsa ochmaydi
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
    // TRIAL_ID XUDDI SHU token bilan kelsa — duplicate
    const res = await request(app)
      .post(`/api/progress/${TRIAL_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: token })
      .expect(200)
    expect(res.body.duplicate).toBe(true)
  })

  it('fanlar orasida xatolar izolyatsiya qilingan (bir xil questionId, turli subject)', async () => {
    // Rus tili banki va savolini bazaga kiritish (russian_db dataSourceId bilan)
    await db.insert(questionBanks).values({ id: 'russian_db', name: 'Rus tili' }).onConflictDoNothing()
    const [t] = await db.insert(topics).values({
      nameUz: 'Rus tili mavzu', nameRu: 'Тема по русскому', bankId: 'russian_db', slug: 'rustili-mavzu-uniq',
    }).onConflictDoNothing().returning()
    const tId = t?.id ?? (await db.select({ id: topics.id }).from(topics).where(eq(topics.bankId, 'russian_db')))[0]?.id ?? null

    await db.insert(questions).values({
      id: 999111,
      bankId: 'russian_db',
      externalId: 'rustili_999111',
      questionUz: 'Rus tili savol?',
      questionRu: 'Русский вопрос?',
      optionsUz: { a: '1', b: '2' },
      optionsRu: { a: '1', b: '2' },
      correctAnswer: 'a',
      topicId: tId,
    }).onConflictDoNothing()

    await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: 999111, selectedAnswer: 'b', subjectId: 'rustili' })
      .expect(200)

    const [prog] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(prog.wrongByTicket[`rustili:999111`]).toBe(1)
    expect(prog.wrongByTicket[`yhq:999111`]).toBeUndefined()
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
  beforeEach(async () => {
    await db.delete(users).where(eq(users.id, TRIAL_ID))
    await request(app).post('/api/init').send({
      id: String(TRIAL_ID), first_name: 'Trial', last_name: 'Test', username: 'trial_test',
    }).expect(200)
  })

  it('parallel requestlardan faqat bittasiga trial beradi', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      request(app).post(`/api/users/${TRIAL_ID}/trial`).send({}),
    ))
    expect(responses.filter((res) => res.body.granted === true)).toHaveLength(1)
    expect(responses.filter((res) => res.body.reason === 'already_used')).toHaveLength(7)
  })
})

describe('payment idempotency', () => {
  beforeEach(async () => {
    await db.delete(payments).where(eq(payments.userId, PAYMENT_ID))
    await db.delete(users).where(eq(users.id, PAYMENT_ID))
    await db.insert(users).values({
      id: PAYMENT_ID, firstName: 'Payment', lastName: 'Test', username: 'payment_test', photoUrl: '',
    }).onConflictDoNothing()
  })

  it('bir charge ID uchun premiumni faqat bir marta uzaytiradi', async () => {
    const chargeId = `charge_${Date.now()}_test`
    const input = {
      telegramChargeId: chargeId,
      providerChargeId: `prov_${chargeId}`,
      userId: PAYMENT_ID,
      plan: 'month' as const,
      days: 30,
      amount: 99,
      currency: 'XTR',
      payload: `premium_month_${PAYMENT_ID}`,
      rawUpdate: { integration: true },
    }

    await expect(paymentRepository.complete(input)).resolves.toBe('activated')
    const [afterFirst] = await db.select({ premiumUntil: users.premiumUntil, tariff: users.tariff })
      .from(users).where(eq(users.id, PAYMENT_ID))
    // C-1 (audit CRITICAL): muddatli (days=30) xarid SAQLANGAN tariff'ni
    // 'premium'ga o'tirirmaydi — entitlement premium_until > now() orqali.
    // Umrbod xaridgina tariff='premium' sentinel bo'ladi.
    expect(afterFirst.tariff).toBe('free')
    expect(afterFirst.premiumUntil).toBeTruthy()
    expect(afterFirst.premiumUntil!.getTime()).toBeGreaterThan(Date.now())

    // Ikkinchi marta — replay / Telegram retry
    await expect(paymentRepository.complete(input)).resolves.toBe('duplicate')
    const [afterSecond] = await db.select({ premiumUntil: users.premiumUntil, tariff: users.tariff })
      .from(users).where(eq(users.id, PAYMENT_ID))
    expect(afterSecond.premiumUntil?.getTime()).toBe(afterFirst.premiumUntil?.getTime())
    const rows = await db.select().from(payments).where(eq(payments.userId, PAYMENT_ID))
    expect(rows).toHaveLength(1)
  })
})

describe('progress anti-farm: post-answer reveal replay (audit fix)', () => {
  it('yechilgan savolga yangi clientToken bilan qayta TO\'G\'RI javob counterlarni oshirmaydi', async () => {
    // Farm senaryysi: xato javob → reveal'dan correctAnswer'ni ol → boshqa token bilan
    // qayta to\'g\'ri javob ber. Allaqachon yechilgan savol → idempotent "duplicate".
    await request(app).delete(`/api/progress/${PROGRESS_ID}`).expect(200)

    const [question] = await db.select().from(questions).limit(1)
    const wrongAnswer = Object.keys(question.optionsUz).find((key) => key !== question.correctAnswer) ?? '__wrong__'

    await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: wrongAnswer, subjectId: 'yhq', clientToken: `farm-wrong-${Date.now()}` })
      .expect(200)

    const correct = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: `farm-correct-${Date.now()}` })
      .expect(200)
    expect(correct.body.correct).toBe(true)
    expect(correct.body.correctAnswer).toBe(question.correctAnswer)

    const [afterFirst] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(afterFirst.totalCorrect).toBe(1)
    expect(afterFirst.totalAnswered).toBe(2)

    // FARM URINISHI: yangi token, to\'g\'ri javob — COUNTERLARGA yozilmaydi,
    // lekin user FRESH javob bergan → feedback beriladi ('gate' duplicate;
    // aks holda client buni "offline" deb talqin qilib yakunda unanswered qilardi).
    // Anti-farm himoyasi counter'larnida — reveal'da EMAS (u birinchi javobda
    // correctAnswer'ni allaqachon olgan bo'lardi, reveal yangi ma'lumot bermaydi).
    const replay = await request(app)
      .post(`/api/progress/${PROGRESS_ID}/result`)
      .send({ questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq', clientToken: `farm-replay-${Date.now()}` })
      .expect(200)
    expect(replay.body.duplicate).toBe(true)
    expect(replay.body.correct).toBe(true)
    expect(replay.body.correctAnswer).toBe(question.correctAnswer)
    expect(replay.body.dailyStreak).toBeNull()

    const [afterReplay] = await db.select().from(progress).where(eq(progress.userId, PROGRESS_ID))
    expect(afterReplay.totalCorrect).toBe(1)      // oshmadi
    expect(afterReplay.totalAnswered).toBe(2)     // oshmadi
    expect(afterReplay.streak).toBe(1)            // oshmadi
  })
})

const H3_ID = '998877660004'

describe('H-3 anti-farm: kunlik javob krediti (DAILY_ANSWER_CREDIT)', () => {
  beforeAll(async () => {
    await db.delete(answerTokens).where(eq(answerTokens.userId, H3_ID))
    await db.delete(users).where(eq(users.id, H3_ID))
    await request(app).post('/api/init').send({
      id: H3_ID, first_name: 'Farm', last_name: 'Cap', username: 'farm_cap_test',
    }).expect(200)
  })
  afterAll(async () => {
    await db.delete(answerTokens).where(eq(answerTokens.userId, H3_ID))
    await db.delete(dailyRecords).where(eq(dailyRecords.userId, H3_ID))
    await db.delete(users).where(eq(users.id, H3_ID))
  })

  it('kunlik kredit to\'lgandan KEYINGI javoblar jimgina no-op (counterlar o\'smaydi)', async () => {
    const { DAILY_ANSWER_CREDIT } = await import('../../../server/modules/progress/progress.repository')
    const today = tashkentDate()
    // Bugungi kredit to'ldi (farming seansi tasvirlanadi)
    await db.insert(dailyRecords).values({
      userId: H3_ID, date: today, subjectId: 'yhq',
      answered: DAILY_ANSWER_CREDIT, correct: DAILY_ANSWER_CREDIT, fixed: 0,
    }).onConflictDoNothing()

    const [progBefore] = await db.select().from(progress).where(eq(progress.userId, H3_ID))
    const [question] = await db.select().from(questions).limit(1)

    const res = await request(app)
      .post(`/api/progress/${H3_ID}/result`)
      .send({
        questionId: question.id, selectedAnswer: question.correctAnswer, subjectId: 'yhq',
        clientToken: `h3-capped-${Date.now()}`,
      })
      .expect(200)
    expect(res.body.duplicate).toBe(true)   // jimgina cap — xato YO'Q
    expect(res.body.correct).toBe(true)     // 'gate' duplicate: fresh javob feedback'i
    expect(res.body.correctAnswer).toBe(question.correctAnswer)

    const [progAfter] = await db.select().from(progress).where(eq(progress.userId, H3_ID))
    expect(progAfter.totalAnswered).toBe(progBefore.totalAnswered)   // o'smadi
    expect(progAfter.totalCorrect).toBe(progBefore.totalCorrect)     // o'smadi
    const [daily] = await db.select().from(dailyRecords)
      .where(and(eq(dailyRecords.userId, H3_ID), eq(dailyRecords.date, today)))
    expect(daily.answered).toBe(DAILY_ANSWER_CREDIT)                 // o'smadi
  })

  it('kredit to\'lmaganda javob oddiy yoziladi (regressiya yo\'q)', async () => {
    // Kredit qatorini kamaytiramiz
    const today = tashkentDate()
    await db.update(dailyRecords).set({ answered: 5, correct: 5 })
      .where(and(eq(dailyRecords.userId, H3_ID), eq(dailyRecords.date, today)))

    const [progBefore] = await db.select().from(progress).where(eq(progress.userId, H3_ID))
    const [question] = await db.select().from(questions).limit(1)
    const wrongAnswer = Object.keys(question.optionsUz).find((key) => key !== question.correctAnswer) ?? '__wrong__'
    const res = await request(app)
      .post(`/api/progress/${H3_ID}/result`)
      .send({
        questionId: question.id, selectedAnswer: wrongAnswer, subjectId: 'yhq',
        clientToken: `h3-ok-${Date.now()}`,
      })
      .expect(200)
    expect(Boolean(res.body.duplicate)).toBe(false)   // duplicate kaliti success javobida bo'lmasligi mumkin

    const [progAfter] = await db.select().from(progress).where(eq(progress.userId, H3_ID))
    expect(progAfter.totalAnswered).toBe(progBefore.totalAnswered + 1)
  })
})
