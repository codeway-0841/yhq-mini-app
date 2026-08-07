import type { NextFunction, Request, Response } from 'express'
import { timingSafeEqual } from 'crypto'
import { config } from '../config'

function equalSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Internal cron endpointlari secret yo'q yoki noto'g'ri bo'lsa doim fail-closed. */
export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = config.cron.secret
  const authorization = req.headers.authorization

  if (!secret) {
    res.status(503).json({ error: 'cron_not_configured' })
    return
  }
  if (typeof authorization !== 'string' || !equalSecret(authorization, `Bearer ${secret}`)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}
