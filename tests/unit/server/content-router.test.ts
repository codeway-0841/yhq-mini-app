/**
 * POST /api/content/token — R2 kontent tokeni endpoint'i.
 *
 * Invariantlar:
 *  - flag o'chiq → 404 (client legacy yo'lda qoladi);
 *  - auth'siz → 401 (anonim token YO'Q — anti-scrape);
 *  - fizika'dan boshqa fan → 403 (phase 1);
 *  - publish yo'q (marker null) → 503 content_not_published;
 *  - kunlik kvota oshsa → 429 + abuse audit (xom token log'lanmaydi);
 *  - muvaffaqiyat: {token, expiresAt, version} — token published versiya +
 *    'physics' segmenti bilan imzolanadi; javob no-store.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../server/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../server/config')>()
  return {
    ...original,
    config: {
      ...original.config,
      qbank: {
        ...original.config.qbank,
        enabled: true,
        tokenSecret: 'router-test-secret-0123456789abcdef0123456789abcdef',
        tokenTtlSeconds: 600,
        tokenDailyCap: 3,
      },
    },
  }
})

vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  dbRateConsumeWindow: vi.fn(async (_key: string, max: number) => {
    const count = (globalThis as { __dtCount?: number }).__dtCount ?? 1
    return { allowed: count <= max, count }
  }),
}))

const h = vi.hoisted(() => ({ published: 12 as number | null }))
vi.mock('../../../server/modules/content/qbank-publish', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/modules/content/qbank-publish')>()),
  getPublishedVersion: vi.fn(async () => h.published),
}))

import contentRouter from '../../../server/modules/content/content.router'
import { errorHandler } from '../../../server/middleware/error-handler'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { verifyContentToken } from '../../../server/modules/content/content-token'

function buildApp(userId?: string): express.Express {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    if (userId) (req as { userId?: string }).userId = userId
    next()
  })
  app.use('/api', contentRouter)
  app.use(errorHandler)
  return app
}

const SECRET = 'router-test-secret-0123456789abcdef0123456789abcdef'

beforeEach(() => {
  vi.restoreAllMocks()
  h.published = 12
  ;(globalThis as { __dtCount?: number }).__dtCount = 1
})

describe('POST /api/content/token', () => {
  it('auth\'siz → 401 AUTH_REQUIRED', async () => {
    const res = await request(buildApp()).post('/api/content/token').send({ subjectId: 'fizika' }).expect(401)
    expect(res.body.error).toBe('AUTH_REQUIRED')
  })

  it('QBANK\'da yo\'q fan → 403 subject_not_supported', async () => {
    const res = await request(buildApp('u1')).post('/api/content/token').send({ subjectId: 'musiqa' }).expect(403)
    expect(res.body.error).toBe('subject_not_supported')
  })

  it('barcha QBANK fanlari token oladi (faqat fizika emas)', async () => {
    // In-memory test limiter: 5/min per user — har fan uchun ALOHIDA user
    const subjects = ['yhq', 'matematika', 'adabiyot']
    for (let i = 0; i < subjects.length; i += 1) {
      const res = await request(buildApp(`u-multi-${i}`)).post('/api/content/token').send({ subjectId: subjects[i] }).expect(200)
      expect(typeof res.body.token).toBe('string')
    }
  })

  it('publish yo\'q (marker null) → 503 content_not_published', async () => {
    h.published = null
    const res = await request(buildApp('u1')).post('/api/content/token').send({ subjectId: 'fizika' }).expect(503)
    expect(res.body.error).toBe('content_not_published')
  })

  it('kunlik kvota oshsa → 429 + abuse audit (token berilmaydi)', async () => {
    ;(globalThis as { __dtCount?: number }).__dtCount = 99
    const audit = vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue(undefined)
    const res = await request(buildApp('u-abuse')).post('/api/content/token').send({ subjectId: 'fizika' }).expect(429)
    expect(res.body.error).toBe('content_token_daily_cap')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u-abuse',
      action: 'content_token_abuse',
    }))
  })

  it('muvaffaqiyat: token published versiya + physics scope + segment bilan', async () => {
    const res = await request(buildApp('user-7')).post('/api/content/token').send({ subjectId: 'fizika' }).expect(200)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.body.version).toBe('cv12')
    // Segment — client URL qurish uchun (SSOT serverda)
    expect(res.body.segment).toBe('physics')
    expect(typeof res.body.token).toBe('string')
    // Token HAQIQIY imzolangan — ochib tekshiramiz
    const verified = verifyContentToken(SECRET, res.body.token, Math.floor(Date.now() / 1000) + 1)
    expect(verified.ok).toBe(true)
    if (verified.ok) {
      expect(verified.claims.sub).toBe('user-7')
      expect(verified.claims.sid).toBe('physics')
      expect(verified.claims.v).toBe(12)
      expect(verified.claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    }
  })

  it('token PII\'siz (faqat sub/sid/v/exp/jti)', async () => {
    const res = await request(buildApp('user-pii')).post('/api/content/token').send({ subjectId: 'fizika' }).expect(200)
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['exp', 'jti', 'sid', 'sub', 'v'])
  })

  it('noto\'g\'ri body → 400', async () => {
    await request(buildApp('u1')).post('/api/content/token').send({}).expect(400)
    await request(buildApp('u1')).post('/api/content/token').send({ subjectId: '' }).expect(400)
  })
})

describe('POST /api/content/token — flag o\'chiq', () => {
  it('QBANK_R2_ENABLED=false → 404 (rollback kanali)', async () => {
    const { config } = await import('../../../server/config')
    const original = config.qbank.enabled
    // Test ichida vaqtincha o'chiramiz (modul snapshot — keyin tiklaymiz)
    ;(config.qbank as { enabled: boolean }).enabled = false
    try {
      await request(buildApp('u1')).post('/api/content/token').send({ subjectId: 'fizika' }).expect(404)
    } finally {
      ;(config.qbank as { enabled: boolean }).enabled = original
    }
  })
})
