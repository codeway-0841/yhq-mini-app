/**
 * Auth router — multi-provider login va account linking endpoint'lari.
 *
 * PUBLIC (middleware'da alohida ruxsat — credentials YO'Q holda chaqiriladi):
 *   POST /api/auth/phone/register   {phone, password, firstName}
 *   POST /api/auth/phone/login      {phone, password}
 *   POST /api/auth/telegram         {id, first_name, ..., auth_date, hash}  (Login Widget)
 * HIMOYALI (requireAuth — Bearer session YOKI initData):
 *   POST /api/auth/phone/link       {phone, password}   (Profil "Hisobni bog'lash")
 *   POST /api/auth/tg-link-code     → {code, url}       (APK → bot deep-link)
 *   GET  /api/auth/me               → profile + providers
 *   POST /api/auth/logout           (revoke joriy session)
 *
 * Barcha PUBLIC endpoint'lar qattiq rate-limit'langan (brute-force himoyasi).
 */

import { Router } from 'express'
import { wrap } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { rateLimit } from '../../middleware/rate-limiter'
import { requireAuth } from '../../middleware/auth'
import {
  authService,
  PhoneRegisterSchema, PhoneLoginSchema, PhoneLinkSchema, TgWidgetLoginSchema,
} from './auth.service'

const router = Router()

/** Login urinishlari — IP bo'yicha 10/min (parol brute-force himoyasi) */
const AUTH_LIMIT = { maxPerMinute: 10 }

// POST /api/auth/phone/register
router.post(
  '/auth/phone/register',
  rateLimit(AUTH_LIMIT),
  validate({ body: PhoneRegisterSchema }),
  wrap(async (req, res) => {
    res.status(201).json(await authService.registerWithPhone(req.body))
  }),
)

// POST /api/auth/phone/login
router.post(
  '/auth/phone/login',
  rateLimit(AUTH_LIMIT),
  validate({ body: PhoneLoginSchema }),
  wrap(async (req, res) => {
    res.json(await authService.loginWithPhone(req.body))
  }),
)

// POST /api/auth/telegram — Telegram Login Widget
router.post(
  '/auth/telegram',
  rateLimit(AUTH_LIMIT),
  validate({ body: TgWidgetLoginSchema }),
  wrap(async (req, res) => {
    res.json(await authService.loginWithTelegramWidget(req.body))
  }),
)

// POST /api/auth/phone/link — Profil "Hisobni bog'lash": joriy akkauntga telefon qo'shish
router.post(
  '/auth/phone/link',
  requireAuth,
  rateLimit(AUTH_LIMIT),
  validate({ body: PhoneLinkSchema }),
  wrap(async (req, res) => {
    // requireAuth o'tgan — userId kafolatlangan
    res.json(await authService.linkPhone((req as { userId?: string }).userId!, req.body))
  }),
)

// POST /api/auth/tg-link-code — APK/brauzer (telefon sessiya) uchun bot deep-link kodi
router.post(
  '/auth/tg-link-code',
  requireAuth,
  rateLimit(AUTH_LIMIT),
  wrap(async (req, res) => {
    res.json(await authService.createTelegramLinkCode((req as { userId?: string }).userId!))
  }),
)

// GET /api/auth/me — session warm start (client splash'dan keyin old profile)
router.get(
  '/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json(await authService.getSessionProfile((req as { userId?: string }).userId!))
  }),
)

// POST /api/auth/logout — joriy session revoke
router.post(
  '/auth/logout',
  requireAuth,
  wrap(async (req, res) => {
    // Bearer sessiya logout uchun shart; initData orqali kirgan user sessiyaga ega emas
    const token = (req as { sessionToken?: string }).sessionToken
    if (token) await authService.logout(token)
    res.json({ ok: true })
  }),
)

export default router
