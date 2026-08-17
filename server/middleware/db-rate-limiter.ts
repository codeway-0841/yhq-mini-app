/**
 * DB-backed rate limiter — MULTI-INSTANCE umumiy oyna (Neon PostgreSQL).
 *
 * Muammo: in-memory token bucket har instance'da ALOHIDA → Vercel/Render'da
 * N replica bo'lsa hujumchi N × limitani oladi (auth endpoint'lar uchun
 * kritik). Bu limiter `rate_limits` jadvalidagi ATOMIK upsert-counter'ga
 * tayanadi (ON CONFLICT DO UPDATE — row-level lock, parallel so'rovlar
 * aniq sanaladi). Fixed 60s oyna.
 *
 * Fallback siyosati:
 *  - NODE_ENV != production → in-memory rateLimit (test determinizmi;
 *    integration suite bir IP'dan yuzlab urish qiladi — DB counter flaky 429
 *    berardi). Prod semantikasi faqat production'da.
 *  - DB xatosi → FAIL-CLOSED 503 (audit P1-2): fail-open'da DB outage paytida
 *    butun rate-limit devirasi o'chib qolardi (auth brute-force oynasi ochiladi).
 *    Bu middleware bilan himoyalangan endpoint'lar baribir DB'siz ishlamaydi —
 *    503 ochiqrog'i va Sentry'ga tushadi.
 */

import type { Request, Response, NextFunction } from 'express'
import { sql } from 'drizzle-orm'
import { executeRows } from '../db/connection'
import { config } from '../config'
import { Sentry } from '../utils/sentry'
import { rateLimit } from './rate-limiter'

interface DbRateLimitOptions {
  /** Limiter nomi (bucket prefix) — 'auth', 'auth:forgot' kabi */
  bucket:        string
  /** Oyna (60s) ichidagi max so'rovlar. Default 10 */
  maxPerMinute?: number
  keyFn?:        (req: Request) => string | undefined
}

/** Atomik oyna-counter iste'moli. `count > max` bo'lsa so'rov rad etilishi kerak. */
export async function dbRateConsume(bucketKey: string, max: number): Promise<{ allowed: boolean; count: number }> {
  const rows = await executeRows<{ count: number }>(sql`
    INSERT INTO rate_limits (bucket, count, window_start)
    VALUES (${bucketKey}, 1, now())
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start <= now() - interval '60 seconds' THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start <= now() - interval '60 seconds' THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count
  `)
  const count = Number(rows[0]?.count ?? 1)
  return { allowed: count <= max, count }
}

export function dbRateLimit(opts: DbRateLimitOptions) {
  const max = Math.max(1, Math.floor(opts.maxPerMinute ?? 10))
  // SINXRON SAQLANG: in-memory rate-limiter.ts dagi default keyFn bilan bir xil
  const keyFn = opts.keyFn ?? ((req: Request): string | undefined => {
    const paramId = req.params['userId']
    return (req as { userId?: string }).userId
      ?? (req as { telegramUserId?: string }).telegramUserId
      ?? (typeof paramId === 'string' ? paramId : paramId?.[0])
      ?? req.ip
  })
  // Test/dev determinizmi uchun in-memory nusxa — prod'da ishlatilmaydi
  const memoryFallback = rateLimit({ maxPerMinute: max, keyFn })

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyFn(req)
    if (!key) { next(); return }
    if (config.env !== 'production') { memoryFallback(req, res, next); return }

    try {
      // Route bo'yicha ajratish: method+path bucket prefix'ga kiritiladi —
      // /auth/otp/request va /auth/phone/login umumiy limitni BO'LISHMAYDI
      // (in-memory nusxada har rateLimit() chaqiruvi alohida Map edi).
      const { allowed } = await dbRateConsume(`${opts.bucket}:${req.method}:${req.path}:${key}`, max)
      if (!allowed) {
        res.status(429).json({ error: 'Too many requests — slow down' })
        return
      }
      next()
    } catch (err) {
      console.error('[rate-limit] DB counter xatosi (fail-closed):', err)
      Sentry.captureException(err)
      res.status(503).json({ error: 'rate_limiter_unavailable' })
    }
  }
}
