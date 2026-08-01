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
    res.status(err.statusCode).json({ error: err.message })
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
