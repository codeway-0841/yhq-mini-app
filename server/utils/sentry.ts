/**
 * Sentry (backend) — Express/Vercel functions uchun xatolarni yig'ish.
 * SENTRY_DSN sozlanmagan bo'lsa, to'liq no-op.
 */
import * as Sentry from '@sentry/node'

const dsn = process.env['SENTRY_DSN']

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] === 'production' ? 'production' : 'development',
    release: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 8),
    // Har 10-transaksiyadan 1 tasini kuzatish (serverless uchun yetarli)
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
