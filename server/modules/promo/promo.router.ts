import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { requireAdmin } from '../../middleware/admin'
import { promoRepository } from './promo.repository'

const router = Router()

const RedeemBodySchema = z.object({
  code: z.string().trim().min(3).max(30),
})

const CreatePromoBodySchema = z.object({
  code: z.string().trim().min(3).max(30),
  type: z.string().default('premium_days'),
  value: z.number().int().positive(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

// ── Rate limit: 1 daqiqada 5 ta urinish (brute-force kod taxminidan himoya).
// Prod'da DB counter — N replica = N×5/min brute-force byudjeti bo'lmasin. ──
const redeemLimiter = rateLimit({
  maxPerMinute: 5,
  bucket: 'promo',
  keyFn: (req) => (req as { userId?: string }).userId ?? req.ip ?? 'unknown',
})

// POST /api/promo/redeem
router.post(
  '/promo/redeem',
  redeemLimiter,
  validate({ body: RedeemBodySchema }),
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId || userId === '0') {
      throw new AppError(401, 'Avval tizimga kiring', 'AUTH_REQUIRED')
    }

    const { code } = req.body as z.infer<typeof RedeemBodySchema>
    const promo = await promoRepository.findByCode(code)

    if (!promo) {
      throw new AppError(404, 'Promokod topilmadi', 'PROMO_NOT_FOUND')
    }

    if (!promo.isActive) {
      throw new AppError(400, 'Promokod faol emas', 'PROMO_INACTIVE')
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      throw new AppError(400, 'Promokodning amal qilish muddati tugagan', 'PROMO_EXPIRED')
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new AppError(400, 'Promokoddan foydalanish limiti tugagan', 'PROMO_LIMIT_REACHED')
    }

    const alreadyRedeemed = await promoRepository.isRedeemedByUser(promo.id, userId)
    if (alreadyRedeemed) {
      throw new AppError(400, 'Siz ushbu promokodni avval ishlatgansiz', 'PROMO_ALREADY_USED')
    }

    const result = await promoRepository.redeem(promo.id, userId, promo.value)
    if (!result.success) {
      throw new AppError(400, 'Promokodni faollashtirib bo‘lmadi', 'PROMO_REDEEM_FAILED')
    }

    res.json({
      success: true,
      type: promo.type,
      value: promo.value,
      premiumUntil: result.premiumUntil?.toISOString() ?? null,
      tariff: result.tariff,
    })
  }),
)

// ── Admin Endpoints ──────────────────────────────────────────────────────────

// GET /api/admin/promo-codes
router.get(
  '/admin/promo-codes',
  requireAdmin,
  wrap(async (_req, res) => {
    const codes = await promoRepository.getAllCodes()
    res.json({ codes })
  }),
)

// POST /api/admin/promo-codes
router.post(
  '/admin/promo-codes',
  requireAdmin,
  validate({ body: CreatePromoBodySchema }),
  wrap(async (req, res) => {
    const body = req.body as z.infer<typeof CreatePromoBodySchema>
    const existing = await promoRepository.findByCode(body.code)
    if (existing) {
      throw new AppError(409, 'Bunday promokod allaqachon mavjud', 'PROMO_EXISTS')
    }

    const created = await promoRepository.createCode({
      code: body.code,
      type: body.type,
      value: body.value,
      maxUses: body.maxUses,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })

    res.status(201).json(created)
  }),
)

// PATCH /api/admin/promo-codes/:id/toggle
router.patch(
  '/admin/promo-codes/:id/toggle',
  requireAdmin,
  validate({ body: z.object({ isActive: z.boolean() }) }),
  wrap(async (req, res) => {
    const id = Number(req.params['id'])
    const { isActive } = req.body as { isActive: boolean }
    const success = await promoRepository.toggleActive(id, isActive)
    if (!success) throw new AppError(404, 'Promokod topilmadi')
    res.json({ ok: true, id, isActive })
  }),
)

// DELETE /api/admin/promo-codes/:id
router.delete(
  '/admin/promo-codes/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const id = Number(req.params['id'])
    const success = await promoRepository.deleteCode(id)
    if (!success) throw new AppError(404, 'Promokod topilmadi')
    res.json({ ok: true, id })
  }),
)

export default router
