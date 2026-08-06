/**
 * Sentry (backend) — Express/Vercel functions uchun xatolarni yig'ish.
 * SENTRY_DSN sozlanmagan bo'lsa, to'liq no-op.
 */
import * as Sentry from '@sentry/node'
import { config } from '../config'

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.isProd ? 'production' : 'development',
    release: config.deploy.buildId,
    // Har 10-transaksiyadan 1 tasini kuzatish (serverless uchun yetarli)
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
