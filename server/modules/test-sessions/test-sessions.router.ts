import { Router } from 'express'
import { z } from 'zod'
import {
  CreateTestSessionSchema,
  FinishTestSessionSchema,
  SessionPositionProofSchema,
  SubmitTestAnswerSchema,
} from '../../../shared/test-session'
import { requireAuth } from '../../middleware/auth'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { AppError, wrap } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { testSessionsService } from './test-sessions.service'

const router = Router()
const SessionParamsSchema = z.object({ sessionId: z.uuid() })
const ExplainBodySchema = SessionPositionProofSchema.extend({
  language: z.enum(['uz', 'ru']).default('uz'),
})

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

/**
 * Bookmark toggle (pozitsiya-proof — master ID client'ga chiqmaydi).
 * Mavjud bo'lsa o'chiradi, bo'lmasa qo'shadi.
 */
router.post(
  '/test-sessions/:sessionId/saved',
  rateLimit({ maxPerMinute: 60, bucket: 'test-session:save' }),
  validate({ params: SessionParamsSchema, body: SessionPositionProofSchema }),
  wrap(async (req, res) => {
    const result = await testSessionsService.toggleSaved(
      authenticatedUser(req), String(req.params['sessionId']), req.body,
    )
    res.json({ ok: true, ...result })
  }),
)

// GET /api/test-sessions/:sessionId/saved — saqlangan pozitsiyalar (bookmark holati).
router.get(
  '/test-sessions/:sessionId/saved',
  validate({ params: SessionParamsSchema }),
  wrap(async (req, res) => {
    res.json(await testSessionsService.savedPositions(authenticatedUser(req), String(req.params['sessionId'])))
  }),
)

/**
 * Statik izoh (pozitsiya-proof + POST-ANSWER gate — legacy /explanation pariteti).
 * Master ID javobda YO'Q — faqat matn.
 */
router.post(
  '/test-sessions/:sessionId/explanation',
  rateLimit({ maxPerMinute: 30, bucket: 'test-session:explain' }),
  validate({ params: SessionParamsSchema, body: ExplainBodySchema }),
  wrap(async (req, res) => {
    const { language, ...proof } = req.body as z.infer<typeof ExplainBodySchema>
    res.json(await testSessionsService.sessionExplanation(
      authenticatedUser(req), String(req.params['sessionId']), proof, language,
    ))
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
