/**
 * Structured request logger — har request uchun bitta JSON qator.
 *
 * - `X-Request-Id`: kiruvchi header xavfsiz formatda bo'lsa echo qilinadi
 *   (client ↔ server trace korrelyatsiyasi), aks holda yangi UUID.
 * - Path'dagi uzun raqamli segmentlar (Telegram user id — PII) `:id` ga
 *   normalize qilinadi — log/Sentry'da PII yotmaydi.
 * - Health/readiness monitoring endpointlari loglanmaydi (shovqin).
 */

import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'

/** Kiruvchi request id faqat shu formatda qabul qilinadi (log injection himoyasi) */
const SAFE_REQ_ID = /^[A-Za-z0-9_-]{8,64}$/

const SKIP_PATHS = new Set(['/api/health', '/api/ready'])

/** Telegram id'lar (5+ xonali raqamlar) — PII; log'da ko'rinmasligi kerak.
 *  Telegram login kodlari ham sekret-ga o'xshash (session bearer tranziti) —
 *  eski path-based polling shakli uchun normalizatsiya (P1-3). */
export function normalizePath(path: string): string {
  return path
    .replace(/\d{5,}/g, ':id')
    .replace(/\/auth\/telegram-login\/[A-Za-z0-9_-]+/g, '/auth/telegram-login/:code')
}

export function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  return value && SAFE_REQ_ID.test(value) ? value : randomUUID()
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  const requestId = resolveRequestId(req.headers['x-request-id'])
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    if (SKIP_PATHS.has(req.path)) return
    const entry = {
      level:     res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId,
      method:    req.method,
      path:      normalizePath(req.path),
      status:    res.statusCode,
      ms:        Date.now() - start,
    }
    console.log(JSON.stringify(entry))
  })
  next()
}
