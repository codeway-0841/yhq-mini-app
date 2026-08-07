/**
 * Saved questions router.
 */

import { Router }          from 'express'
import { z }               from 'zod'
import { wrap, AppError }  from '../../middleware/error-handler'
import { validate }        from '../../middleware/validate'
import { parseBigInt }     from '../../utils/parse'
import { savedRepository } from './saved.repository'
import { SUBJECT_IDS, DEFAULT_SUBJECT_ID } from '../../config/subjects'

const router = Router()

// subjectId majburiy emas — eski client'lar default (yhq) bilan ishlayveradi
const SubjectSchema = z.enum(SUBJECT_IDS as [string, ...string[]]).default(DEFAULT_SUBJECT_ID)
const AddBodySchema    = z.object({ questionId: z.number().int().positive(), subjectId: SubjectSchema })
const DeleteParamSchema = z.object({
  userId:     z.string().min(1),
  questionId: z.coerce.number().int().positive(),
})
const DeleteQuerySchema = z.object({ subject: SubjectSchema })

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
    const { questionId, subjectId } = req.body as z.infer<typeof AddBodySchema>
    await savedRepository.add(uid, questionId, subjectId)
    res.json({ ok: true })
  }),
)

// DELETE /api/saved/:userId/:questionId?subject=<id>
router.delete(
  '/saved/:userId/:questionId',
  validate({ params: DeleteParamSchema, query: DeleteQuerySchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    await savedRepository.remove(uid, Number(req.params['questionId']), String(req.query['subject'] ?? DEFAULT_SUBJECT_ID))
    res.json({ ok: true })
  }),
)

export default router
