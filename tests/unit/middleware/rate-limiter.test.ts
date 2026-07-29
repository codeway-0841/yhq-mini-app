/**
 * Unit tests for the token-bucket rate limiter.
 * Each rateLimit() creates an isolated bucket — tests don't share state.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { rateLimit } from '../../../server/middleware/rate-limiter'

function fakeReq(userId = 'u1'): Request {
  return { params: { userId } } as unknown as Request
}

function fakeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json   = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return { status, json }
}

afterEach(() => vi.useRealTimers())

describe('rateLimit()', () => {
  it('allows first request through', () => {
    const middleware = rateLimit({ maxPerMinute: 5 })
    const next: NextFunction = vi.fn()
    middleware(fakeReq(), fakeRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks after max requests in a minute', () => {
    const middleware = rateLimit({ maxPerMinute: 3 })
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    // 3 allowed
    for (let i = 0; i < 3; i++) {
      middleware(fakeReq(), res as unknown as Response, next)
    }
    expect(next).toHaveBeenCalledTimes(3)

    // 4th blocked
    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(3)
    expect(res.status).toHaveBeenCalledWith(429)
  })

  it('different user IDs are tracked separately', () => {
    const middleware = rateLimit({ maxPerMinute: 1 })
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    middleware(fakeReq('u1'), res as unknown as Response, next)
    middleware(fakeReq('u2'), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(2)
  })

  it('different rateLimit() instances do not share buckets', () => {
    const a = rateLimit({ maxPerMinute: 1 })
    const b = rateLimit({ maxPerMinute: 1 })
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    a(fakeReq('u1'), res as unknown as Response, next)  // uses a's bucket
    b(fakeReq('u1'), res as unknown as Response, next)  // uses b's bucket — both allowed
    expect(next).toHaveBeenCalledTimes(2)
  })

  it('missing userId skips rate check', () => {
    const middleware = rateLimit({ maxPerMinute: 0 })  // maxPerMinute=0 → clamped to 1
    const req = { params: {} } as unknown as Request
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    // No userId — should skip check and call next
    middleware(req, res as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('maxPerMinute: 0 is clamped to 1 (no crash)', () => {
    const middleware = rateLimit({ maxPerMinute: 0 })
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()

    // Second request should be blocked (max=1)
    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(429)
  })

  it('tokens refill after time passes', () => {
    vi.useFakeTimers()
    const middleware = rateLimit({ maxPerMinute: 1 })
    const res = fakeRes()
    const next: NextFunction = vi.fn()

    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)

    // Blocked immediately
    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)

    // Advance 1 minute → refill 1 token
    vi.advanceTimersByTime(61_000)
    middleware(fakeReq(), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(2)
  })
})
