/**
 * Saved questions router.
 */

import { Router }          from 'express'
import { z }               from 'zod'
import { wrap, AppError }  from '../../middleware/error-handler'
import { validate }        from '../../middleware/validate'
import { parseBigInt }     from '../../utils/parse'
import { savedRepository } from './saved.repository'

const router = Router()

const AddBodySchema    = z.object({ questionId: z.number().int().positive() })
const DeleteParamSchema = z.object({
  userId:     z.string().min(1),
  questionId: z.coerce.number().int().positive(),
})

// GET /api/saved/:userId
router.get(
  '/saved/:userId',
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    res.json(await savedRepository.findByUserId(uid))
  }),
)

// POST /api/saved/:userId
router.post(
  '/saved/:userId',
  validate({ body: AddBodySchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    await savedRepository.add(uid, req.body.questionId as number)
    res.json({ ok: true })
  }),
)

// DELETE /api/saved/:userId/:questionId
router.delete(
  '/saved/:userId/:questionId',
  validate({ params: DeleteParamSchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    await savedRepository.remove(uid, Number(req.params['questionId']))
    res.json({ ok: true })
  }),
)

export default router
