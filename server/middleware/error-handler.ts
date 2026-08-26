/**
 * Global Express error handler — must be registered last (after all routes).
 * Catches anything passed via next(err) or thrown inside wrap().
 */

import { Request, Response, NextFunction } from 'express'
import { Sentry } from '../utils/sentry'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Qo'shimcha kontekst (masalan, parol feedback'i) — client'ga qaytariladi. */
    public readonly details?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.details ? { error: err.message, details: err.details } : { error: err.message })
    return
  }

  // Body-parser (express.json) xatolari — CLIENT xatosi, server xatosi EMAS
  // (audit B4): avval ular 500 va Sentry spam bo'lardi (har buzilgan JSON spam =
  // alert shovqini). Endi 4xx + Sentry'siz.
  const type = (err as { type?: string }).type
  if (type === 'entity.too.large') {
    res.status(413).json({ error: "So'rov hajmi juda katta" })
    return
  }
  if (typeof type === 'string' && type.startsWith('entity.')) {
    // entity.parse.failed (buzilgan JSON), entity.too... va boshqalar
    res.status(400).json({ error: "So'rov tanasi formati noto'g'ri" })
    return
  }

  // Unexpected error — log full stack, hide internals from client
  console.error('[unhandled error]', err)
  Sentry.captureException(err)
  res.status(500).json({ error: 'Internal server error' })
}

/** Wrap an async route handler so errors propagate to errorHandler. */
export function wrap(
  fn: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)
}
