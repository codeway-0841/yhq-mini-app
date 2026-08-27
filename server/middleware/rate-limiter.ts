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

/**
 * Rate limit KALITI — shaxs bo'yicha, transport bo'yicha EMAS.
 *
 * Nega alohida funksiya:
 *
 *  1) CGNAT. Mobil operatorlar minglab abonentni bitta public IPv4 ortiga
 *     joylaydi. IP bo'yicha kalitlangan chelak begona odamlar o'rtasida
 *     bo'linadi va ular bir-birini bloklaydi. Kalit HAR DOIM avval `userId`
 *     bo'lishi kerak; IP faqat anonim so'rov uchun zaxira.
 *
 *  2) PLATFORMADAN MUSTAQILLIK. `req.userId` — kanonik matn id (CLAUDE.md
 *     qoida 9), uni Telegram initData ham, telefon/email Bearer sessiyasi ham
 *     bir xil to'ldiradi. Bu yerda ATAYLAB Telegram'ga oid hech narsa yo'q:
 *     `x-telegram-init-data`, initData shakli, Telegram raqam id — hech biri
 *     tekshirilmaydi. Kelajakda Android APK va iOS ilovalari o'z auth
 *     usullari bilan kelganda, ular AYNI `req.userId` ni to'ldirsa, rate
 *     limit qatlamiga umuman tegish shart bo'lmaydi.
 *
 * Bu yerga transportga xos shart QO'SHMANG (User-Agent, platforma sarlavhasi,
 * Telegram-only maydonlar) — aks holda yangi mijoz turi qo'shilganda limitlar
 * jimgina noto'g'ri ishlaydi.
 */
export function identityKey(req: Request): string {
  return (req as { userId?: string }).userId ?? req.ip ?? 'unknown'
}

export function rateLimit(opts: Options = {}) {
  const max = Math.max(1, Math.floor(opts.maxPerMinute ?? 60))
  const refillIntervalMs = 60_000 / max

  const keyFn = opts.keyFn ?? ((req: Request): string | undefined => {
    const paramId = req.params['userId']
    return (req as { userId?: string }).userId
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
