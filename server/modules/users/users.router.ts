/**
 * Users router — HTTP handlers only.
 * All business logic lives in users.service.ts.
 */

import { Router }                                    from 'express'
import { z }                                         from 'zod'
import { wrap, AppError }                            from '../../middleware/error-handler'
import { validate }                                  from '../../middleware/validate'
import { requireSelf }                               from '../../middleware/auth'
import { dbRateLimit }                               from '../../middleware/db-rate-limiter'
import { parseUserId }                               from '../../utils/parse'
import { usersService, InitInputSchema, PhoneSchema, AvatarUploadSchema, AVATAR_DATA_URL_PREFIX, toApiUser, toApiProgress, toApiSettings } from './users.service'
import { referralsRepository }                       from './users.repository'
import { REFERRAL_REWARD_DAYS, REFERRAL_MAX_REWARDED } from './referral.constants'
import { progressRepository }                        from '../progress/progress.repository'
import { settingsRepository }                        from '../settings/settings.repository'
import { savedRepository }                           from '../saved/saved.repository'
import { coinsRepository }                           from '../coins/coins.repository'
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

    const [user, prog, sett, saved, solvedKeys, economy] = await Promise.all([
      usersRepository.findById(uid),
      progressRepository.findByUserId(uid),
      settingsRepository.findByUserId(uid),
      savedRepository.findByUserId(uid),
      progressRepository.listSolvedKeys(uid),   // P2: jsonb o'rniga jadval
      coinsRepository.getEconomyState(uid),     // #40: balans + egalik
    ])

    if (!user) throw new AppError(404, 'User not found')
    // prog/sett missing means /init was never called — treat same as user not found
    if (!prog || !sett) throw new AppError(404, 'User profile incomplete — call /init first')

    res.json({
      user:           toApiUser(user, economy),
      progress:       toApiProgress(prog, solvedKeys),
      settings:       toApiSettings(sett),
      savedQuestions: saved,
    })
  }),
)

// PATCH /api/users/:userId/phone — OTP (SMS kod) MAJBURIY (H-2 audit).
// Client oqimi: POST /auth/otp/request {phone} → kod SMS'da → PATCH {phone, otp}.
router.patch(
  '/users/:userId/phone',
  validate({ body: PhoneSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const { phone, otp } = req.body as z.infer<typeof PhoneSchema>
    await usersService.updatePhone(uid, phone, otp)
    res.json({ ok: true })
  }),
)

// GET /api/referrals/:userId — referal statistikasi (Profil kartasi)
router.get(
  '/referrals/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const stats = await referralsRepository.getStats(uid)
    res.json({
      ...stats,
      rewardDays: REFERRAL_REWARD_DAYS,
      cap:        REFERRAL_MAX_REWARDED,
    })
  }),
)

// PATCH /api/users/:userId/sms-consent — SMS marketing roziligi (opt-in/out).
// Telefon ulash ≠ rozilik: user O'ZI yoqadi/o'chiradi; kampaniyalar FAQAT
// sms_opt_in=TRUE userlarga ketadi.
router.patch(
  '/users/:userId/sms-consent',
  validate({ body: z.object({ optIn: z.boolean() }) }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const ok = await usersRepository.setSmsOptIn(uid, (req.body as { optIn: boolean }).optIn)
    if (!ok) throw new AppError(404, 'User not found')
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

// ── AVATAR — qo'lda yuklangan profil rasmi (global ko'rsatish) ───────────────

// Yuklash brute-force/spam himoyasi (coins kabi): user boshiga 10/min.
const avatarUploadLimiter = dbRateLimit({
  maxPerMinute: 10,
  bucket: 'avatar:upload',
  keyFn: (req) => (req as { userId?: string }).userId ?? req.ip ?? 'unknown',
})

// PUT /api/users/:userId/avatar — custom avatar yuklash (FAQAT o'zi; requireSelf).
router.put(
  '/users/:userId/avatar',
  requireSelf,
  avatarUploadLimiter,
  validate({ body: AvatarUploadSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const { image } = req.body as z.infer<typeof AvatarUploadSchema>
    await usersService.updateAvatar(uid, image)
    res.json({ ok: true })
  }),
)

// DELETE /api/users/:userId/avatar — avatar o'chirish (FAQAT o'zi).
router.delete(
  '/users/:userId/avatar',
  requireSelf,
  avatarUploadLimiter,
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    await usersService.updateAvatar(uid, null)
    res.json({ ok: true })
  }),
)

// GET /api/avatar/:userId — GLOBAL o'qish (leaderboard/duel). PUBLIC_GET'da —
// <img> tag auth header yubora olmaydi; avatar ma'lumoti user O'ZI public
// ko'rsatish uchun yuklagan (PII emas). Binary image/webp, CDN-keshlanadi.
router.get(
  '/avatar/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const dataUrl = await usersService.getAvatar(uid)
    if (!dataUrl || !dataUrl.startsWith(AVATAR_DATA_URL_PREFIX)) {
      throw new AppError(404, 'Avatar not found')
    }
    const buf = Buffer.from(dataUrl.slice(AVATAR_DATA_URL_PREFIX.length), 'base64')
    res.set({
      'Content-Type': 'image/webp',
      // Qayta yuklangach ~10 daqiqagacha eski kesh ko'rinishi mumkin
      'Cache-Control': 'public, max-age=600',
    })
    res.send(buf)
  }),
)

export default router
