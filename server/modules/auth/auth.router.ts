/**
 * Auth router — multi-provider login va account linking endpoint'lari.
 *
 * PUBLIC (middleware'da alohida ruxsat — credentials YO'Q holda chaqiriladi):
 *   POST /api/auth/otp/request           {phone}                → {sent: true}
 *   POST /api/auth/otp/verify/login      {phone, code}          → AuthResponse
 *   POST /api/auth/otp/verify/register   {phone, code, password, firstName} → AuthResponse
 *   POST /api/auth/phone/register        {phone, password, firstName}  (legacy)
 *   POST /api/auth/phone/login           {phone, password}             (legacy)
 *   POST /api/auth/telegram              {id, first_name, ..., hash}   (Login Widget)
 * HIMOYALI (requireAuth — Bearer session YOKI initData):
 *   POST /api/auth/phone/link       {phone, password}   (Profil "Hisobni bog'lash")
 *   POST /api/auth/tg-link-code     → {code, url}       (APK → bot deep-link)
 *   GET  /api/auth/me               → profile + providers
 *   POST /api/auth/logout           (revoke joriy session)
 *
 * Barcha PUBLIC endpoint'lar qattiq rate-limit'langan (brute-force himoyasi).
 */

import { Router } from 'express'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
// Multi-instance umumiy limiter: prod'da DB counter (Neon), test/dev'da in-memory
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { requireAuth } from '../../middleware/auth'
import {
  authService,
  PhoneRegisterSchema, PhoneLoginSchema, PhoneLinkSchema, TgWidgetLoginSchema,
  RequestOTPSchema, VerifyOTPLoginSchema, VerifyOTPRegisterSchema,
  EmailSchema, PasswordSchema,
} from './auth.service'
import { z } from 'zod'

const router = Router()

/** Login urinishlari — IP bo'yicha 10/min (parol brute-force himoyasi).
 *  bucket: prod DB counter namespace (route method+path avtomatik ajratiladi). */
const AUTH_LIMIT = { maxPerMinute: 10, bucket: 'auth' }

// ── SMS OTP flow ────────────────────────────────────────────────────────────

// POST /api/auth/otp/request — SMS kod yuborish
router.post(
  '/auth/otp/request',
  rateLimit(AUTH_LIMIT),
  validate({ body: RequestOTPSchema }),
  wrap(async (req, res) => {
    res.json(await authService.requestOTP(req.body))
  }),
)

// POST /api/auth/otp/verify/login — OTP bilan kirish (mavjud akkaunt)
router.post(
  '/auth/otp/verify/login',
  rateLimit(AUTH_LIMIT),
  validate({ body: VerifyOTPLoginSchema }),
  wrap(async (req, res) => {
    res.json(await authService.verifyOTPLogin(req.body))
  }),
)

// POST /api/auth/otp/verify/register — OTP bilan ro'yxatdan o'tish
router.post(
  '/auth/otp/verify/register',
  rateLimit(AUTH_LIMIT),
  validate({ body: VerifyOTPRegisterSchema }),
  wrap(async (req, res) => {
    res.status(201).json(await authService.verifyOTPRegister(req.body))
  }),
)

// ── Legacy telefon + parol flow ─────────────────────────────────────────────

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

// POST /api/auth/telegram-login — "Telegram orqali kirish" (public, kod yaratish)
router.post(
  '/auth/telegram-login',
  rateLimit(AUTH_LIMIT),
  wrap(async (_req, res) => {
    res.json(await authService.createTelegramLoginCode())
  }),
)

// GET /api/auth/telegram-login — polling (kod X-Login-Code HEADER'da).
// Header varianti AFZAL: kod URL path'da yurmaydi → request-log'larga,
// brauzer tarixiga va proxy access-log'lariga tushmaydi (P1-3).
router.get(
  '/auth/telegram-login',
  rateLimit({ maxPerMinute: 30, bucket: 'auth' }),
  wrap(async (req, res) => {
    const header = req.headers['x-login-code']
    const code = String((Array.isArray(header) ? header[0] : header) ?? '').trim()
    if (!code || code.length > 20) throw new AppError(400, 'invalid_code')
    res.json(await authService.checkTelegramLoginCode(code))
  }),
)

// GET /api/auth/telegram-login/:code — ESKI polling shakli (keshlangan bundle'lar
// uchun qoladi; yangi klientlar yuqoridagi header variantini ishlatadi).
router.get(
  '/auth/telegram-login/:code',
  rateLimit({ maxPerMinute: 30, bucket: 'auth' }),
  wrap(async (req, res) => {
    // Express 5 params typing: string | string[] — wildcard bo'lmagan routeda string
    const code = String(req.params.code ?? '')
    if (!code || code.length > 20) throw new AppError(400, 'invalid_code')
    res.json(await authService.checkTelegramLoginCode(code))
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

// ── Email + Password Auth ───────────────────────────────────────────────────

const EmailRegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(1).max(64),
})

const EmailLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(72),
})

// POST /api/auth/email/register
router.post(
  '/auth/email/register',
  rateLimit(AUTH_LIMIT),
  validate({ body: EmailRegisterSchema }),
  wrap(async (req, res) => {
    res.status(201).json(await authService.registerWithEmail(req.body, req))
  }),
)

// POST /api/auth/email/login
router.post(
  '/auth/email/login',
  rateLimit(AUTH_LIMIT),
  validate({ body: EmailLoginSchema }),
  wrap(async (req, res) => {
    res.json(await authService.loginWithEmail(req.body, req))
  }),
)

// GET /api/auth/verify-email?token=<token>
router.get(
  '/auth/verify-email',
  rateLimit(AUTH_LIMIT),  // Prevent token brute-force
  wrap(async (req, res) => {
    const token = req.query.token as string
    if (!token) throw new AppError(400, 'token_required')
    res.json(await authService.verifyEmail(token))
  }),
)

// POST /api/auth/resend-verification
router.post(
  '/auth/resend-verification',
  requireAuth,
  rateLimit({ maxPerMinute: 3, bucket: 'auth' }),  // Stricter rate limit
  wrap(async (req, res) => {
    res.json(await authService.resendEmailVerification((req as { userId?: string }).userId!))
  }),
)

// ── Password Reset ──────────────────────────────────────────────────────────

const RequestPasswordResetSchema = z.object({
  email: EmailSchema,
})

const ResetPasswordSchema = z.object({
  token: z.string().length(64),
  password: PasswordSchema,
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: PasswordSchema,
})

// POST /api/auth/forgot-password
router.post(
  '/auth/forgot-password',
  rateLimit({ maxPerMinute: 3, bucket: 'auth' }),
  validate({ body: RequestPasswordResetSchema }),
  wrap(async (req, res) => {
    res.json(await authService.requestPasswordReset(req.body.email))
  }),
)

// POST /api/auth/reset-password
router.post(
  '/auth/reset-password',
  rateLimit(AUTH_LIMIT),
  validate({ body: ResetPasswordSchema }),
  wrap(async (req, res) => {
    res.json(await authService.resetPassword(req.body.token, req.body.password, req))
  }),
)

// POST /api/auth/change-password
router.post(
  '/auth/change-password',
  requireAuth,
  rateLimit(AUTH_LIMIT),
  validate({ body: ChangePasswordSchema }),
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId!
    res.json(await authService.changePassword(
      userId,
      req.body.currentPassword,
      req.body.newPassword,
      req,
    ))
  }),
)

// ── OAuth (Google + Apple) — v2 stub (FIXPLAN #36 qarori): route'lar SAQLANADI
// (client'da kelajakda tugmalar ulanadi), hozir ANIq `available: false` — 501
// generic holat o'rniga kuzatuvchan javob; implementatsiya auth.service'da TODO.

// GET /api/auth/google/callback
router.get(
  '/auth/google/callback',
  rateLimit(AUTH_LIMIT),
  wrap(async (_req, res) => {
    res.status(501).json({ available: false, provider: 'google', error: 'oauth_not_implemented', message: 'Google kirish v2 relizda ochiladi' })
  }),
)

// POST /api/auth/apple/callback
router.post(
  '/auth/apple/callback',
  rateLimit(AUTH_LIMIT),
  wrap(async (_req, res) => {
    res.status(501).json({ available: false, provider: 'apple', error: 'oauth_not_implemented', message: 'Apple kirish v2 relizda ochiladi' })
  }),
)

export default router
