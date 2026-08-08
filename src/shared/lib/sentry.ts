/**
 * Sentry (frontend) — xatolarni avtomatik yig'ish.
 * VITE_SENTRY_DSN sozlanmagan bo'lsa, Sentry to'liq o'chiq (no-op).
 */
import * as Sentry from '@sentry/react'
import { getTelegramUser } from '../../platform/telegram'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    release: import.meta.env.VITE_APP_VERSION ?? 'yhq-mini-app',
    // Performance monitoring (boshlang'ich sample rate)
    tracesSampleRate: 0.1,
    // Telegram foydalanuvchisi bilan xatolarni bog'lash
    initialScope: { tags: { app: 'yhq-mini-app' } },
  })

  // Telegram foydalanuvchisini Sentry'ga bog'lash
  const tg = getTelegramUser()
  if (tg?.id) {
    Sentry.setUser({ id: String(tg.id), username: tg.username })
  }
}

export { Sentry }
