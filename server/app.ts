/**
 * Express app factory.
 *
 * Separated from server/index.ts so the app can be imported in integration
 * tests without binding to a port.
 *
 * Mount order:
 *   1. Global middleware (logger, CORS, JSON body parser)
 *   2. Feature routers under /api
 *   3. Global error handler (must be last)
 */

import express          from 'express'
import cors             from 'cors'
import { sql }           from 'drizzle-orm'
import { config }        from './config'
import { requestLogger } from './middleware/request-logger'
import { errorHandler }  from './middleware/error-handler'
import { rateLimit }     from './middleware/rate-limiter'
import { telegramAuth }  from './middleware/auth'
import { createReadinessHandler } from './middleware/readiness'
import { executeRows }   from './db/connection'

import usersRouter       from './modules/users/users.router'
import progressRouter    from './modules/progress/progress.router'
import settingsRouter    from './modules/settings/settings.router'
import savedRouter       from './modules/saved/saved.router'
import leaderboardRouter from './modules/leaderboard/leaderboard.router'
import questionsRouter   from './modules/questions/questions.router'
import dashboardRouter   from './modules/dashboard/dashboard.router'
import analyticsRouter   from './modules/analytics/analytics.router'
import dailyRouter       from './modules/daily/daily.router'
import cronRouter        from './modules/cron/cron.router'
import achievementsRouter from './modules/achievements/achievements.router'
import tutorRouter        from './modules/tutor/tutor.router'
import adminRouter        from './modules/admin/admin.router'

export function createApp() {
  const app = express()

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(requestLogger)
  app.use(cors({
    origin:  config.server.allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }))
  app.use(express.json({ limit: '16kb' }))

  // Vercel/Render load balancer ortida — req.ip X-Forwarded-For'dan o'qilsin.
  // Bo'lmasa rate limiter barcha foydalanuvchini bitta bucket'ga soladi.
  app.set('trust proxy', 1)

  // Minimal xavfsizlik header'lari (helmet kerak emas — API JSON-only)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })

  // Health check — must stay above auth/rate-limit so monitors always reach it
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) })
  })

  // Readiness — LIVENESS'dan farqli: DB ping majburiy. Deploy/monitoring
  // faqat ready nodeni tanlashi kerak (DB uzilib ketsa node trafikdan chiqadi).
  app.get('/api/ready', createReadinessHandler(() => executeRows(sql`SELECT 1`)))

  // Global IP-based rate limit (per-endpoint limiters may be stricter).
  // 120/min per-IP: oddiy foydalanuvchi uchun kafolatli (sahifa yuklash
  // + progress sync ~10-20 req/min), lekin polling/spam hujumlarga yetarli devor.
  app.use('/api', rateLimit({
    maxPerMinute: 120,
    keyFn: (req) => req.ip ?? 'unknown',
  }))

  // Vercel Cron — telegramAuth'dan OLDIN (Telegram initData yo'q); CRON_SECRET himoyali
  app.use('/api', cronRouter)

  // Telegram initData verification (enforced in production, see middleware/auth)
  app.use('/api', telegramAuth)

  // ── Feature routers ──────────────────────────────────────────────────────
  // All public API routes are prefixed with /api.
  // Each router only knows its own sub-path (e.g. /init, /profile/:id).
  app.use('/api', usersRouter)
  app.use('/api', progressRouter)
  app.use('/api', settingsRouter)
  app.use('/api', savedRouter)
  app.use('/api', leaderboardRouter)
  app.use('/api', questionsRouter)
  app.use('/api', dashboardRouter)
  app.use('/api', analyticsRouter)
  app.use('/api', dailyRouter)
  app.use('/api', achievementsRouter)
  app.use('/api', tutorRouter)
  app.use('/api', adminRouter)

  // 404 catch-all for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler)

  return app
}
