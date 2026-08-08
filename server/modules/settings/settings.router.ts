/**
 * Settings router.
 */

import { Router }                              from 'express'
import { wrap, AppError }                      from '../../middleware/error-handler'
import { validate }                            from '../../middleware/validate'
import { parseUserId }                         from '../../utils/parse'
import { settingsRepository, SettingsPatchSchema } from './settings.repository'

const router = Router()

// PATCH /api/settings/:userId
router.patch(
  '/settings/:userId',
  validate({ body: SettingsPatchSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const updated = await settingsRepository.patch(uid, req.body)
    if (!updated) throw new AppError(404, 'Settings row not found — call /init first')

    res.json({ ok: true })
  }),
)

export default router
