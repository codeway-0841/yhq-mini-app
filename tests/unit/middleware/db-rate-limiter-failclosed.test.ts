/**
 * dbRateLimit middleware — DB xatosida FAIL-CLOSED (audit P1-2).
 *
 * Oldin: catch → console.error + next() (fail-open) — DB outage paytida butun
 * rate-limit devirasi o'chib, auth endpoint'lar himoyasiz ochilardi.
 * Endi: 503 { error: 'rate_limiter_unavailable' } + Sentry.
 *
 * Prod yo'lini tekshirish uchun NODE_ENV=production qilinadi (config.env —
 * dinamik getter; test'dan keyin 'test'ga qaytaramiz).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../server/db/connection', () => ({
  executeRows: vi.fn(),
}))

import { executeRows } from '../../../server/db/connection'
import { dbRateLimit } from '../../../server/middleware/db-rate-limiter'

const mockedExecute = vi.mocked(executeRows)

function call() {
  const req = { method: 'POST', path: '/api/x', ip: '10.0.0.1', params: {} } as never
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as never
  const next = vi.fn()
  return { middleware: dbRateLimit({ maxPerMinute: 5, bucket: 'test-failclosed' }), req, res, next }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  process.env.NODE_ENV = 'test'
})

describe('dbRateLimit — DB xatosida fail-closed (P1-2)', () => {
  it('production: DB counter xatosi → 503, next() CHAQRILMAYDI', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockRejectedValueOnce(new Error('neon unavailable'))

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(503)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'rate_limiter_unavailable' })
    expect(next).not.toHaveBeenCalled()
  })

  it('production: sog\'lom DB counter → next() chaqiriladi (limit ichida)', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockResolvedValueOnce([{ count: 1 }])

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })
})
