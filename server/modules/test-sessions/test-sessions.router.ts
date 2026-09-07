import { Router } from 'express'
import { z } from 'zod'
import {
  CreateTestSessionSchema,
  FinishTestSessionSchema,
  SubmitTestAnswerSchema,
} from '../../../shared/test-session'
import { requireAuth } from '../../middleware/auth'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { AppError, wrap } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { testSessionsService } from './test-sessions.service'

const router = Router()
const SessionParamsSchema = z.object({ sessionId: z.uuid() })

function authenticatedUser(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') throw new AppError(401, 'authentication_required')
  return userId
}

router.use('/test-sessions', requireAuth)
router.use('/test-sessions', (_req, res, next) => {
  res.set({
    'Cache-Control': 'private, no-store',
    Pragma: 'no-cache',
    Vary: 'Authorization, x-telegram-init-data',
  })
  next()
})

// POST /api/test-sessions — bounded server-owned random/topic/exam/mock/saved/mistakes session.
router.post(
  '/test-sessions',
  rateLimit({ maxPerMinute: 10, bucket: 'test-session:create' }),
  validate({ body: CreateTestSessionSchema }),
  wrap(async (req, res) => {
    const response = await testSessionsService.create(authenticatedUser(req), req.body)
    res.status(201).json(response)
  }),
)

// GET /api/test-sessions/:sessionId — only the owned, still-issued unanswered window.
router.get(
  '/test-sessions/:sessionId',
  validate({ params: SessionParamsSchema }),
  wrap(async (req, res) => {
    res.json(await testSessionsService.resume(authenticatedUser(req), String(req.params['sessionId'])))
  }),
)

router.post(
  '/test-sessions/:sessionId/answers',
  rateLimit({ maxPerMinute: 120, bucket: 'test-session:answer' }),
  validate({ params: SessionParamsSchema, body: SubmitTestAnswerSchema }),
  wrap(async (req, res) => {
    res.json(await testSessionsService.answer(authenticatedUser(req), String(req.params['sessionId']), req.body))
  }),
)

router.post(
  '/test-sessions/:sessionId/finish',
  rateLimit({ maxPerMinute: 20, bucket: 'test-session:finish' }),
  validate({ params: SessionParamsSchema, body: FinishTestSessionSchema }),
  wrap(async (req, res) => {
    const session = await testSessionsService.finish(
      authenticatedUser(req), String(req.params['sessionId']), req.body.status,
    )
    res.json({ session })
  }),
)

export default router
