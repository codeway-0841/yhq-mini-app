import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireCronSecret } from '../../../server/middleware/cron-auth'
import { config } from '../../../server/config'

describe('requireCronSecret middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 503 when CRON_SECRET is not configured', () => {
    const originalSecret = config.cron.secret
    try {
      config.cron.secret = ''
      const req = { headers: {} } as any
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any
      const next = vi.fn()

      requireCronSecret(req, res, next)

      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json).toHaveBeenCalledWith({ error: 'cron_not_configured' })
      expect(next).not.toHaveBeenCalled()
    } finally {
      config.cron.secret = originalSecret
    }
  })

  it('returns 401 when Authorization header is missing or incorrect', () => {
    const originalSecret = config.cron.secret
    try {
      config.cron.secret = 'super-secret-token'
      const req = { headers: { authorization: 'Bearer wrong-token' } } as any
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any
      const next = vi.fn()

      requireCronSecret(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' })
      expect(next).not.toHaveBeenCalled()
    } finally {
      config.cron.secret = originalSecret
    }
  })

  it('calls next() when Authorization header matches secret', () => {
    const originalSecret = config.cron.secret
    try {
      config.cron.secret = 'valid-secret-123'
      const req = { headers: { authorization: 'Bearer valid-secret-123' } } as any
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any
      const next = vi.fn()

      requireCronSecret(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
    } finally {
      config.cron.secret = originalSecret
    }
  })
})
