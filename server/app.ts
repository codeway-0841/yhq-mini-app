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
import { questionsRepository } from './modules/questions/questions.repository'

import authRouter        from './modules/auth/auth.router'
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
import promoRouter        from './modules/promo/promo.router'
import certificateRouter  from './modules/certificate/certificate.router'
import { paymentRouter }  from './modules/payments/payment.router'

export function createApp() {
  const app = express()

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(requestLogger)
  app.use(cors({
    origin:         config.server.allowedOrigins,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'X-Request-Id'],
    credentials:    true,
  }))
  app.use(express.json({ limit: '10mb' }))

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
  // `/health` alias: Render healthCheckPath ham shu handler umumiy (bitta entry — standalone.ts birlashtirildi).
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) })
  }
  app.get('/api/health', healthHandler)
  app.get('/health', healthHandler)

  // Readiness — LIVENESS'dan farqli: DB ping + question pool loaded check.
  // Deploy/monitoring faqat ready nodeni tanlashi kerak (DB/pool yo'q bo'lsa 503).
  app.get('/api/ready', createReadinessHandler(async () => {
    await executeRows(sql`SELECT 1`)  // DB connectivity
    const poolReady = await questionsRepository.isPoolReady()
    if (!poolReady) throw new Error('Question pool not loaded')
  }))

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
  app.use('/api', authRouter)
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
  app.use('/api', promoRouter)
  app.use('/api', certificateRouter)
  app.use('/api/payments', paymentRouter)

  // 404 catch-all for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler)

  return app
}
