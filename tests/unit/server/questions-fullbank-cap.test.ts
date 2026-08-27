/**
 * /api/questions PUBLIC (CDN cache), butun bankni tortish esa KUZATILADI —
 * lekin BLOKLANMAYDI.
 *
 * Cap ilgari 429 + retryAfterSeconds 86400 qaytarardi va IP bo'yicha
 * kalitlanardi. Mobil operatorlar CGNAT ishlatgani uchun bitta public IP
 * ortidagi hamma foydalanuvchi kuniga jami 20 ta sovuq ochishni ULASHARDI,
 * so'ng butun ilova ular uchun 24 soatga o'lardi — hech kim qoidabuzarlik
 * qilmasa ham. Himoyalanayotgan narsa maxfiy ham emas: `toPublic()`
 * `correctAnswer` ni olib tashlaydi.
 *
 * Endi signal (audit log + Sentry) saqlanadi, javob esa 200 bo'lib qolaveradi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import * as questionsSModule from '../../../server/modules/questions/questions.router'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import * as providers from '../../../server/providers'

const h = vi.hoisted(() => ({ count: 1 }))

// Prod-semantika: cap faqat auth enforce rejimda ishlaydi
vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  isAuthEnforced: () => true,
}))
vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  // FULL_BANK_DAILY_CAP = 20 → count > 20 bo'lsa 429 sinaymiz.
  // (24h va 7d oyna ikkalasi ham shu mock'dan o'tadi — abuse-oynasi uchun
  // count=3 bo'lganda repeatOffender=false deb hisoblaymiz: 3 <= 3 allowed)
  dbRateConsumeWindow: vi.fn(async (_key: string, max: number) => ({
    allowed: h.count <= max,
    count: h.count,
  })),
}))

const router = (questionsSModule as unknown as { default: express.Router }).default

function buildApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  return app
}

const emptyProvider = {
  getAllQuestions: vi.fn().mockResolvedValue([]),
  getQuestionsByTopic: vi.fn().mockResolvedValue([]),
  getTopics: vi.fn().mockResolvedValue([]),
  getQuestionById: vi.fn().mockResolvedValue(null),
}

describe('GET /api/questions — full-bank cap KUZATUV rejimida', () => {
  beforeEach(() => {
    h.count = 1
    vi.restoreAllMocks()
    vi.spyOn(providers, 'getProvider').mockReturnValue(emptyProvider as never)
    vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue(undefined as never)
  })

  it('cap ichida → 200 + PUBLIC CDN cache qaytarilgan (edge hit)', async () => {
    h.count = 3
    const res = await request(buildApp()).get('/api/questions')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('public')
    expect(res.headers['cache-control']).toContain('max-age=300')
  })

  it('cap oshgan (count=21) → 200 BERILADI, lekin audit log yoziladi', async () => {
    h.count = 21
    const res = await request(buildApp()).get('/api/questions')
    // Bloklash YO'Q — aks holda bitta CGNAT shlyuzidagi begona odamlar
    // bir-birini kun bo'yi ilovadan mahrum qilardi.
    expect(res.status).toBe(200)
    expect(emptyProvider.getAllQuestions).toHaveBeenCalled()
    // Signal esa saqlanadi — suiiste'mol ko'rinsa qaror qabul qilish uchun
    expect(authRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'questions_fullbank_abuse',
        changes: expect.objectContaining({ enforced: false }),
      }),
    )
  })

  it('limiter DB\'si yiqilsa kontent BLOKLANMAYDI (fail-open)', async () => {
    const limiter = await import('../../../server/middleware/db-rate-limiter')
    // Spy ATAYLAB shu test ichida tiklanadi: `vi.restoreAllMocks()`
    // `vi.mock()` bilan almashtirilgan modul eksportini qaytara olmaydi,
    // shuning uchun rad etish keyingi testlarga oqib ketardi.
    const spy = vi.spyOn(limiter, 'dbRateConsumeWindow').mockRejectedValue(new Error('db down'))
    try {
      const res = await request(buildApp()).get('/api/questions')
      // Ilgari xato yuqoriga otilib 500 qaytarardi — DB uzilishi savollarni
      // butunlay o'chirardi.
      expect(res.status).toBe(200)
    } finally {
      spy.mockRestore()
    }
  })

  it("topicId BILAN so'rov cap hisoblanmaydi (oddiy foydalanish yo'li)", async () => {
    h.count = 99
    const res = await request(buildApp()).get('/api/questions?topicId=1')
    expect(res.status).toBe(200)
    expect(emptyProvider.getQuestionsByTopic).toHaveBeenCalled()
  })

  it('anonim so\'rov ham sanaladi — kalit IP\'ga qaytadi', async () => {
    h.count = 21
    const res = await request(buildApp()).get('/api/questions')
    expect(res.status).toBe(200)
    expect(authRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'questions_fullbank_abuse', userId: undefined }),
    )
  })
})
