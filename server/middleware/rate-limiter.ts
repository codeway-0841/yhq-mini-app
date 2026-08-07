/**
 * In-process token-bucket rate limiter.
 * Each rateLimit() call creates an isolated bucket map — no cross-instance collisions.
 *
 * Usage:
 *   router.post('/progress/:userId/result', rateLimit({ maxPerMinute: 120 }), wrap(handler))
 */

import { Request, Response, NextFunction } from 'express'

interface Bucket {
  tokens:       number
  lastRefillMs: number
}

interface Options {
  /** Must be ≥ 1. Default: 60 */
  maxPerMinute?: number
  keyFn?: (req: Request) => string | undefined
}

export function rateLimit(opts: Options = {}) {
  const max = Math.max(1, Math.floor(opts.maxPerMinute ?? 60))
  const refillIntervalMs = 60_000 / max

  const keyFn = opts.keyFn ?? ((req: Request): string | undefined => {
    const paramId = req.params['userId']
    return (req as { telegramUserId?: string }).telegramUserId
      ?? (typeof paramId === 'string' ? paramId : paramId?.[0])
      ?? req.ip
  })

  // Each limiter instance owns its own Map — no shared-state collisions
  const buckets = new Map<string, Bucket>()

  // Evict stale buckets every minute
  const evictTimer = setInterval(() => {
    const staleMs = 5 * 60_000
    const now = Date.now()
    for (const [key, b] of buckets) {
      if (now - b.lastRefillMs > staleMs) buckets.delete(key)
    }
  }, 60_000)
  // Don't keep the process alive just for eviction
  evictTimer.unref()

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req)
    if (!key) { next(); return }

    const now = Date.now()
    let b = buckets.get(key)

    if (!b) {
      buckets.set(key, { tokens: max - 1, lastRefillMs: now })
      next()
      return
    }

    const newTokens = Math.floor((now - b.lastRefillMs) / refillIntervalMs)
    if (newTokens > 0) {
      b.tokens = Math.min(max, b.tokens + newTokens)
      b.lastRefillMs = now
    }

    if (b.tokens <= 0) {
      res.status(429).json({ error: 'Too many requests — slow down' })
      return
    }

    b.tokens--
    next()
  }
}
