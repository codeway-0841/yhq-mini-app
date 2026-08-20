/**
 * dbRateLimit — 429 SPIKE Sentry signali (FIXPLAN #49).
 *
 * Har 429 uchun Sentry event yuborish spam/kvota chiqimi bo'lardi. Signal
 * FAQAT ikki holatda:
 *   1. spike boshi: count === max + 1 (birinchi bloklangan so'rov)
 *   2. davomiy hujum: count % max === 0 (har max-karrali qayta-blok)
 * Shu orqali Sentry alert rule (message:rate_limit_spike) shovqinsiz ishlaydi.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../server/db/connection', () => ({
  executeRows: vi.fn(),
}))
vi.mock('../../../server/utils/sentry', () => ({
  Sentry: { captureMessage: vi.fn(), captureException: vi.fn() },
}))

import { executeRows } from '../../../server/db/connection'
import { Sentry } from '../../../server/utils/sentry'
import { dbRateLimit } from '../../../server/middleware/db-rate-limiter'

const mockedExecute = vi.mocked(executeRows)
const mockedMessage = vi.mocked(Sentry.captureMessage)

const MAX = 5

function call() {
  const req = { method: 'POST', path: '/api/x', ip: '10.0.0.1', params: {} } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any
  const next = vi.fn()
  return { middleware: dbRateLimit({ maxPerMinute: MAX, bucket: 'test-spike' }), req, res, next }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  process.env.NODE_ENV = 'test'
})

describe('dbRateLimit — 429 spike Sentry signali (#49)', () => {
  it('spike boshi (count = max+1): 429 + captureMessage(level=warning)', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockResolvedValueOnce([{ count: MAX + 1 }])

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(next).not.toHaveBeenCalled()
    expect(mockedMessage).toHaveBeenCalledTimes(1)
    expect(mockedMessage).toHaveBeenCalledWith(
      'rate_limit_spike',
      expect.objectContaining({ level: 'warning', extra: { count: MAX + 1, max: MAX } }),
    )
  })

  it('oddiy blok (count = max+2): 429, captureMessage CHAQRILMAYDI (spam yo\'q)', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockResolvedValueOnce([{ count: MAX + 2 }])

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(mockedMessage).not.toHaveBeenCalled()
  })

  it('davomiy hujum (count = 2*max): 429 + yana signal', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockResolvedValueOnce([{ count: MAX * 2 }])

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(mockedMessage).toHaveBeenCalledTimes(1)
  })

  it('limit ichida (count <= max): next(), 429 va signal yo\'q', async () => {
    process.env.NODE_ENV = 'production'
    mockedExecute.mockResolvedValueOnce([{ count: MAX }])

    const { middleware, req, res, next } = call()
    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
    expect(mockedMessage).not.toHaveBeenCalled()
  })
})
