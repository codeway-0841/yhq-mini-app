/**
 * Users router — HTTP handlers only.
 * All business logic lives in users.service.ts.
 */

import { Router }                                    from 'express'
import { wrap, AppError }                            from '../../middleware/error-handler'
import { validate }                                  from '../../middleware/validate'
import { parseUserId }                               from '../../utils/parse'
import { usersService, InitInputSchema, PhoneSchema, toApiUser, toApiProgress, toApiSettings } from './users.service'
import { progressRepository }                        from '../progress/progress.repository'
import { settingsRepository }                        from '../settings/settings.repository'
import { savedRepository }                           from '../saved/saved.repository'
import { usersRepository }                           from './users.repository'

const router = Router()

// POST /api/init
router.post(
  '/init',
  validate({ body: InitInputSchema }),
  wrap(async (req, res) => {
    const profile = await usersService.init(req.body)
    res.json(profile)
  }),
)

// GET /api/profile/:userId
router.get(
  '/profile/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const [user, prog, sett, saved] = await Promise.all([
      usersRepository.findById(uid),
      progressRepository.findByUserId(uid),
      settingsRepository.findByUserId(uid),
      savedRepository.findByUserId(uid),
    ])

    if (!user) throw new AppError(404, 'User not found')
    // prog/sett missing means /init was never called — treat same as user not found
    if (!prog || !sett) throw new AppError(404, 'User profile incomplete — call /init first')

    res.json({
      user:           toApiUser(user),
      progress:       toApiProgress(prog),
      settings:       toApiSettings(sett),
      savedQuestions: saved,
    })
  }),
)

// PATCH /api/users/:userId/phone
router.patch(
  '/users/:userId/phone',
  validate({ body: PhoneSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await usersService.updatePhone(uid, (req.body as { phone: string }).phone)
    res.json({ ok: true })
  }),
)

// POST /api/users/:userId/trial — 3 kunlik bepul Premium trial (FAQAT 1 marta)
router.post(
  '/users/:userId/trial',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const result = await usersService.startTrial(uid)
    res.json(result)
  }),
)

export default router
