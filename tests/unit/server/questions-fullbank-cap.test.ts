/**
 * Audit content-protection regression: /api/questions butun bankni FAQAT authed
 * user oladi + kunlik per-user FULL_BANK tortish limiti (massa-yig'ish signal).
 * Limit oshganda 429 + audit_logs 'questions_fullbank_abuse' yozuvi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import * as questionsSModule from '../../../server/modules/questions/questions.router'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import * as providers from '../../../server/providers'

const h = vi.hoisted(() => ({ count: 1 }))

vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  isAuthEnforced: () => true,
}))
vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  // FULL_BANK_DAILY_CAP = 5 → count > 5 bo'lsa 429 sinaymiz
  dbRateConsumeWindow: vi.fn(async (_key: string, max: number) => ({
    allowed: h.count <= max,
    count: h.count,
  })),
}))

const router = (questionsSModule as unknown as { default: express.Router }).default

function buildApp(userId: string | null): express.Express {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    if (userId !== null) (req as { userId?: string }).userId = userId
    next()
  })
  app.use('/api', router)
  return app
}

const emptyProvider = {
  getAllQuestions: vi.fn().mockResolvedValue([]),
  getQuestionsByTopic: vi.fn().mockResolvedValue([]),
  getTopics: vi.fn().mockResolvedValue([]),
  getQuestionById: vi.fn().mockResolvedValue(null),
}

describe('GET /api/questions — full-bank kunlik cap (audit content protection)', () => {
  beforeEach(() => {
    h.count = 1
    vi.spyOn(providers, 'getProvider').mockReturnValue(emptyProvider as never)
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue(undefined as never)
  })

  it('cap ichida (count=3) → 200', async () => {
    h.count = 3
    const res = await request(buildApp('u1')).get('/api/questions')
    expect(res.status).toBe(200)
    // Auth-only kontent: CDN public cache ZIYO
    expect(res.headers['cache-control']).toContain('private')
  })

  it('cap oshgan (count=6) → 429 + abuse audit log yoziladi', async () => {
    h.count = 6
    const res = await request(buildApp('u1')).get('/api/questions')
    expect(res.status).toBe(429)
    expect(res.body.error).toBe('too_many_requests')
    expect(authRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', action: 'questions_fullbank_abuse' }),
    )
    // Provider chaqirilmaydi — massa-yig'ishga DB resursi ketmaydi
    expect(emptyProvider.getAllQuestions).not.toHaveBeenCalled()
  })

  it('topicId BILAN so\'rov cap hisoblanmaydi (oddiy foydalanish yo\'li)', async () => {
    h.count = 99
    const res = await request(buildApp('u1')).get('/api/questions?topicId=1')
    expect(res.status).toBe(200)
    expect(emptyProvider.getQuestionsByTopic).toHaveBeenCalled()
  })

  it('dev muhit (enforce EMAS) — cap o\'tkaziladi', async () => {
    h.count = 99
    // isAuthEnforced mock'ini vaqtincha false qilib qayta yozish o'rniga —
    // userId YO'Q holatda ham cap ishlamasligi tekshiriladi (anonim = middleware bloklaydi
    // prod'da; bu yerda faqat cap logikasi tekshiriladi).
    const res = await request(buildApp(null)).get('/api/questions')
    expect(res.status).toBe(200) // userId yo'q → cap tekshiruvi o'tkaziladi
  })
})
