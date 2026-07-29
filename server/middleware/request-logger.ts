/**
 * Minimal structured request logger.
 * In production swap with pino-http or morgan for structured JSON logs.
 */

import { Request, Response, NextFunction } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  res.on('finish', () => {
    const ms     = Date.now() - start
    const status = res.statusCode
    const color  = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
    console.log(`${color}${req.method} ${req.path} ${status} ${ms}ms\x1b[0m`)
  })
  next()
}
