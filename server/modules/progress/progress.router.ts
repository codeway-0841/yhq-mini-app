/**
 * Progress router.
 */

import { Router }               from 'express'
import { z }                    from 'zod'
import { wrap, AppError }       from '../../middleware/error-handler'
import { validate }             from '../../middleware/validate'
import { parseBigInt }          from '../../utils/parse'
import { rateLimit }            from '../../middleware/rate-limiter'
import { progressRepository }   from './progress.repository'

const router = Router()

const ResultSchema = z.object({
  correct:    z.boolean(),
  questionId: z.number().int().positive().optional(),
})

// POST /api/progress/:userId/result
router.post(
  '/progress/:userId/result',
  rateLimit({ maxPerMinute: 120 }),
  validate({ body: ResultSchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const { correct, questionId } = req.body as z.infer<typeof ResultSchema>
    const updated = await progressRepository.addResult(uid, correct, questionId ?? null)
    if (!updated) throw new AppError(404, 'Progress row not found — call /init first')

    res.json({ ok: true })
  }),
)

// DELETE /api/progress/:userId  (reset)
router.delete(
  '/progress/:userId',
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.reset(uid)
    res.json({ ok: true })
  }),
)

export default router
