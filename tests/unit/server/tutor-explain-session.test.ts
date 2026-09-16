import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

/**
 * POST /api/tutor/explain — V2 sessiya-pozitsiya varianti.
 * Master question ID client'ga chiqmaydi: session row'dan server ichida
 * resolve qilinadi (resolvePositionQuestion), keyin MAVJUD audited oqim
 * (premium → user/global kvota → fetch → stream) o'zgarishsiz yuradi.
 * Legacy {questionId} body ham ishlashda qolishi shart (regression).
 */

vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  dbRateLimit: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))
vi.mock('../../../server/config', () => ({
  config: {
    ai: { geminiApiKey: 'test-key' },
    sentry: {},
    testSessions: { proofSecret: '0123456789abcdef0123456789abcdef', bufferSize: 6, ttlMinutes: 180, marathonTtlMinutes: 300 },
  },
}))

const selectMock = vi.fn()
vi.mock('../../../server/db/connection', () => ({
  db: { select: (...args: unknown[]) => selectMock(...args) },
}))
vi.mock('../../../server/modules/tutor/tutor.repository', () => ({
  tutorUsageRepository: {
    tryConsume: vi.fn().mockResolvedValue(true),
    getUserQuotaStatus: vi.fn(),
    getCount: vi.fn(),
  },
  TUTOR_DAILY_USER_LIMIT: 10,
  TUTOR_DAILY_GLOBAL_LIMIT: 1000,
  TUTOR_GLOBAL_USER_ID: '0',
}))

import { testSessionsService } from '../../../server/modules/test-sessions/test-sessions.service'
import tutorRouter from '../../../server/modules/tutor/tutor.router'
import { AppError, errorHandler } from '../../../server/middleware/error-handler'

function makeApp() {
  const app = express()
  app.use(express.json())
  // Global telegramAuth o'rniga: test user (canonical TG id)
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as { userId?: string }).userId = '12345'
    next()
  })
  app.use('/api', tutorRouter)
  app.use(errorHandler)
  return app
}

const SESSION_BODY = {
  sessionPosition: {
    sessionId: '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa',
    position: 0,
    deliveryToken: 'v1.delivery-token-for-position-zero',
    expiresAt: '2027-09-08T12:00:00.000Z',
  },
  lang: 'uz',
  answeredCorrect: false,
}

describe('tutor explain — session-position variant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // isPremium (users) → premium; question fetch → 1 qator
    selectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ tariff: 'premium', premiumUntil: null }]) }) })
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{
            id: 101,
            questionUz: 'Qaysi javob?',
            questionRu: 'Какой ответ?',
            optionsUz: { F1: 'A', F2: 'B' },
            optionsRu: { F1: 'А', F2: 'Б' },
            correctAnswer: 'F1',
          }]),
        }),
      })
    vi.spyOn(testSessionsService, 'resolvePositionQuestion').mockResolvedValue({
      subjectId: 'yhq',
      bankId: 'traffic_rules_db',
      questionId: 101,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('data: {"candidates":[{"content":{"parts":[{"text":"AI izoh"}]}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })))
  })

  it('resolves the master id server-side and streams (client sees no questionId)', async () => {
    const res = await request(makeApp()).post('/api/tutor/explain').send(SESSION_BODY).expect(200)
    expect(res.text).toContain('AI izoh')
    expect(testSessionsService.resolvePositionQuestion).toHaveBeenCalledWith(
      '12345',
      SESSION_BODY.sessionPosition.sessionId,
      {
        position: 0,
        deliveryToken: 'v1.delivery-token-for-position-zero',
        expiresAt: '2027-09-08T12:00:00.000Z',
      },
    )
    expect(res.text).not.toContain('101')
  })

  it('legacy {questionId} body still works', async () => {
    const res = await request(makeApp())
      .post('/api/tutor/explain')
      .send({ questionId: 101, lang: 'uz', answeredCorrect: true })
      .expect(200)
    expect(res.text).toContain('AI izoh')
    expect(testSessionsService.resolvePositionQuestion).not.toHaveBeenCalled()
  })

  it('rejects forged session proofs without touching Gemini', async () => {
    vi.mocked(testSessionsService.resolvePositionQuestion).mockRejectedValue(
      new AppError(403, 'invalid_delivery_proof'),
    )
    const fetchMock = vi.mocked(fetch)
    await request(makeApp()).post('/api/tutor/explain').send(SESSION_BODY).expect(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates the session body (400 on bad shape)', async () => {
    await request(makeApp())
      .post('/api/tutor/explain')
      .send({ sessionPosition: { position: -1 } })
      .expect(400)
  })
})
