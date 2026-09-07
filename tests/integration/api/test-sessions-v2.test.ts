/**
 * Real-DB proof: session lock + canonical attempt + progress yon ta'siri
 * bitta ACID transactionda va parallel retry aynan bir marta ishlaydi.
 * Test DB 0059–0061 migrationlar bilan migrate qilingan bo'lishi shart.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { and, eq, inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import {
  progress,
  questionBanks,
  questions,
  savedQuestions,
  testAttempts,
  testSessions,
  users,
} from '../../../server/schema'
import { adminRepository } from '../../../server/modules/admin/admin.repository'

const app = createApp()
const OWNER = '998877679901'
const OTHER = '998877679902'
const IDS = Array.from({ length: 20 }, (_, index) => 1_900_001_000 + index)

function initData(userId: string): string {
  return `query_id=TEST&user=${encodeURIComponent(JSON.stringify({ id: Number(userId), first_name: 'V2' }))}&auth_date=1723000000&hash=dev`
}

function auth(userId: string) {
  return { 'x-telegram-init-data': initData(userId) }
}

async function cleanup() {
  await db.delete(users).where(inArray(users.id, [OWNER, OTHER]))
  await db.delete(questions).where(inArray(questions.id, IDS))
}

beforeAll(async () => {
  await cleanup()
  await db.insert(questionBanks).values({ id: 'traffic_rules_db', name: 'Traffic rules' }).onConflictDoNothing()
  await db.insert(questions).values(IDS.map((id, index) => ({
    id,
    bankId: 'traffic_rules_db',
    externalId: `integration-v2-${id}`,
    questionUz: `V2 savol ${index + 1}`,
    questionRu: `V2 вопрос ${index + 1}`,
    optionsUz: { F1: 'To‘g‘ri', F2: 'Noto‘g‘ri' },
    optionsRu: { F1: 'Верно', F2: 'Неверно' },
    correctAnswer: 'F1',
    image: null,
    topicId: null,
  })))
  // Bu suite users bootstrap'ini emas, test-session ACID invariantlarini
  // tekshiradi. Masofaviy Neon'da /init ko'p parallel read qilgani uchun
  // fixture'ni minimal, deterministik qatorlar bilan yaratamiz.
  await db.insert(users).values([
    { id: OWNER, firstName: 'V2 Owner' },
    { id: OTHER, firstName: 'V2 Other' },
  ])
  await db.insert(progress).values([
    { userId: OWNER, wrongByTicket: { [`yhq:${IDS[1]}`]: 2 } },
    { userId: OTHER },
  ])
  await db.insert(savedQuestions).values({
    userId: OWNER, subjectId: 'yhq', questionId: IDS[0]!,
  })
}, 90_000)

afterAll(cleanup, 60_000)

async function createSession() {
  return request(app)
    .post('/api/test-sessions')
    .set(auth(OWNER))
    .send({ subjectId: 'yhq', selector: { type: 'random', count: 20 }, language: 'uz' })
    .expect(201)
}

describe('test-sessions v2 — real database', () => {
  it('returns only a bounded unanswered buffer with no master IDs or answer keys', async () => {
    const response = await createSession()
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.body.questions).toHaveLength(6)
    for (const question of response.body.questions) {
      expect(question).not.toHaveProperty('id')
      expect(question).not.toHaveProperty('questionId')
      expect(question).not.toHaveProperty('correctAnswer')
      expect(question).not.toHaveProperty('bankId')
    }
  }, 45_000)

  it('rejects cross-user access and delivery-proof tampering', async () => {
    const created = await createSession()
    const sessionId = created.body.session.id as string
    const question = created.body.questions[0]

    await request(app).get(`/api/test-sessions/${sessionId}`).set(auth(OTHER)).expect(404)
    await request(app).post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send({
      position: question.position,
      deliveryToken: `${question.deliveryToken}x`,
      expiresAt: question.expiresAt,
      selectedOptionId: 'F2',
      clientToken: 'integration-tamper-token',
    }).expect(403)
  }, 60_000)

  it('resolves saved practice from the owner only and never accepts bookmark IDs', async () => {
    const owner = await request(app)
      .post('/api/test-sessions')
      .set(auth(OWNER))
      .send({ subjectId: 'yhq', selector: { type: 'saved' }, language: 'uz' })
      .expect(201)
    expect(owner.body.session).toMatchObject({ mode: 'saved', total: 1 })
    expect(owner.body.questions).toHaveLength(1)
    expect(owner.body.questions[0]).not.toHaveProperty('questionId')

    await request(app)
      .post('/api/test-sessions')
      .set(auth(OTHER))
      .send({ subjectId: 'yhq', selector: { type: 'saved' }, language: 'uz' })
      .expect(404)
  }, 60_000)

  it('resolves unresolved mistakes from server progress for the owner only', async () => {
    const owner = await request(app)
      .post('/api/test-sessions')
      .set(auth(OWNER))
      .send({ subjectId: 'yhq', selector: { type: 'mistakes' }, language: 'uz' })
      .expect(201)
    expect(owner.body.session).toMatchObject({ mode: 'mistakes', total: 1 })
    expect(owner.body.questions).toHaveLength(1)
    expect(owner.body.questions[0]).not.toHaveProperty('questionId')

    await request(app)
      .post('/api/test-sessions')
      .set(auth(OTHER))
      .send({ subjectId: 'yhq', selector: { type: 'mistakes' }, language: 'uz' })
      .expect(404)
  }, 60_000)

  it('serializes parallel exact retries and applies progress exactly once', async () => {
    const created = await createSession()
    const sessionId = created.body.session.id as string
    const question = created.body.questions[0]
    const selectedOptionId = question.options[0].id as string
    const payload = {
      position: question.position,
      deliveryToken: question.deliveryToken,
      expiresAt: question.expiresAt,
      selectedOptionId,
      clientToken: `integration-${sessionId}`,
      elapsedMs: 1200,
    }
    const [before] = await db.select().from(progress).where(eq(progress.userId, OWNER))
    const [first, retry] = await Promise.all([
      request(app).post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send(payload),
      request(app).post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send(payload),
    ])

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)
    expect(first.body).toEqual(retry.body)
    expect(typeof first.body.attempt.correct).toBe('boolean')
    expect(typeof first.body.attempt.correctOptionId).toBe('string')

    const [after] = await db.select().from(progress).where(eq(progress.userId, OWNER))
    expect(after!.totalAnswered).toBe(before!.totalAnswered + 1)
    const attempts = await db.select().from(testAttempts).where(and(
      eq(testAttempts.sessionId, sessionId), eq(testAttempts.position, question.position),
    ))
    expect(attempts).toHaveLength(1)
    const [stored] = await db.select().from(testSessions).where(eq(testSessions.id, sessionId))
    expect(stored?.answeredCount).toBe(1)

    await request(app).post(`/api/test-sessions/${sessionId}/finish`).set(auth(OWNER))
      .send({ status: 'completed' }).expect(200)
    const afterFinishRetry = await request(app)
      .post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send(payload).expect(200)
    expect(afterFinishRetry.body).toEqual(first.body)

    await request(app).post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send({
      ...payload,
      selectedOptionId: question.options.find((option: { id: string }) => option.id !== selectedOptionId)?.id,
    }).expect(409)
  }, 120_000)

  it('invalidates a session when admin mutates its question bank', async () => {
    const created = await createSession()
    const sessionId = created.body.session.id as string
    const question = created.body.questions[0]
    await adminRepository.updateQuestion(IDS[0]!, { questionUz: 'V2 versiya yangilandi' })

    await request(app).post(`/api/test-sessions/${sessionId}/answers`).set(auth(OWNER)).send({
      position: question.position,
      deliveryToken: question.deliveryToken,
      expiresAt: question.expiresAt,
      selectedOptionId: question.options[0].id,
      clientToken: `bank-change-${sessionId}`,
    }).expect(409).expect(({ body }) => {
      expect(body.error).toBe('test_session_bank_changed')
    })
  }, 60_000)
})
