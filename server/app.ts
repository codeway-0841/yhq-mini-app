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
import { config }       from './config'
import { requestLogger } from './middleware/request-logger'
import { errorHandler } from './middleware/error-handler'

import usersRouter       from './modules/users/users.router'
import progressRouter    from './modules/progress/progress.router'
import settingsRouter    from './modules/settings/settings.router'
import savedRouter       from './modules/saved/saved.router'
import leaderboardRouter from './modules/leaderboard/leaderboard.router'
import questionsRouter   from './modules/questions/questions.router'

export function createApp() {
  const app = express()

  // ── Global middleware ────────────────────────────────────────────────────
  app.use(requestLogger)
  app.use(cors({
    origin:  config.server.allowedOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }))
  app.use(express.json({ limit: '16kb' }))

  // ── Feature routers ──────────────────────────────────────────────────────
  // All public API routes are prefixed with /api.
  // Each router only knows its own sub-path (e.g. /init, /profile/:id).
  app.use('/api', usersRouter)
  app.use('/api', progressRouter)
  app.use('/api', settingsRouter)
  app.use('/api', savedRouter)
  app.use('/api', leaderboardRouter)
  app.use('/api', questionsRouter)

  // 404 catch-all for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler)

  return app
}
