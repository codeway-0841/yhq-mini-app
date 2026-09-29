/**
 * Live webhook allowlist desync himoyasi (payment/payme 401 incident pattern'i).
 *
 * POST /api/live/webhook LiveKit serveridan credentials'siz keladi (JWT imzo
 * route'da tekshiriladi) — middleware o'tkazmasa prod'da barcha event'lar 401.
 */
import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { isPublicLiveWebhook } from '../../../server/middleware/auth'

const req = (method: string, path: string): Request => ({ method, path }) as unknown as Request

describe('auth.middleware — live webhook allowlist', () => {
  it('LiveKit webhook public (imzo route qatlamida)', () => {
    expect(isPublicLiveWebhook(req('POST', '/live/webhook'))).toBe(true)
  })

  it('boshqa live routelar PUBLIC EMAS (fail-closed)', () => {
    expect(isPublicLiveWebhook(req('POST', '/live/rooms'))).toBe(false)
    expect(isPublicLiveWebhook(req('GET', '/live/webhook'))).toBe(false)
    expect(isPublicLiveWebhook(req('POST', '/live/rooms/1/join'))).toBe(false)
  })

  it('traversal bilan aylanib o‘tilmaydi', () => {
    expect(isPublicLiveWebhook(req('POST', '/live/%2e%2e/progress/result'))).toBe(false)
  })
})
