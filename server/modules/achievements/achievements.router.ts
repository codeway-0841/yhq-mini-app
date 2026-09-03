/**
 * Achievements (Yutuqlar) — HTTP Router Layer.
 * Faqat authentication, parameter validation va JSON javob qaytarish bilan shug'ullanadi.
 * Barcha hisob-kitoblar achievements.service.ts da, DB operatsiyalari achievements.repository.ts da.
 */

import { Router } from 'express'
import { wrap, AppError } from '../../middleware/error-handler'
import { parseUserId } from '../../utils/parse'
import { requireSelf } from '../../middleware/auth'
import { achievementsService } from './achievements.service'

const router = Router()

router.use('/achievements/:userId', requireSelf)

router.get(
  '/achievements/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const stats = await achievementsService.getUserStats(uid)
    res.json({ stats })
  }),
)

export default router
