import { Router } from 'express'
import express from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../db/connection'
import { paymentOrders } from '../../schema'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { wrap, AppError } from '../../middleware/error-handler'
import { getPlan, applyDiscount, type PlanKey } from '../../../shared/premium-plans'
import {
  handleClickPrepare,
  handleClickComplete,
  buildClickPaymentUrl,
  type ClickPrepareInput,
  type ClickCompleteInput,
} from './click.service'
import { handlePaymeRpc, buildPaymePaymentUrl, verifyPaymeAuth } from './payme.service'
import { promoRepository } from '../promo/promo.repository'

export const paymentRouter = Router()

/** Buyurtma yaratish — 10/min (payment_orders jadvalining maqsadsiz o'sishini
 *  cheklash; Vercel'da in-memory limiter no-op — DB counter ishlaydi). */
const orderLimiter = rateLimit({ maxPerMinute: 10, bucket: 'pay-order' })

/** Click webhook body'si ba'zi integratsiyalarda form-urlencoded keladi —
 *  express.json faqat JSON'ni parse qiladi. Ikkala format qabul qilinadi. */
const clickBodyParser = express.urlencoded({ extended: false })

const CreateOrderSchema = z.object({
  plan: z.enum(['month', 'year', 'lifetime']),
  provider: z.enum(['click', 'payme']).default('click'),
  returnUrl: z.string().url().optional(),
  /** Chegirma promokodi (discount_percent turi) — server QAYTA tekshiradi. */
  promoCode: z.string().trim().min(3).max(30).optional(),
})

/**
 * 1. Create Payment Order
 * Authenticated endpoint: creates a pending payment order and returns checkout payment URL.
 */
paymentRouter.post(
  '/create-order',
  requireAuth,
  orderLimiter,
  validate({ body: CreateOrderSchema }),
  wrap(async (req: any, res) => {
    const { plan: planKey, provider, returnUrl, promoCode } = req.body
    const userId = req.userId

    const plan = getPlan(planKey)
    if (!plan) {
      throw new AppError(400, 'Invalid plan')
    }

    // ── Promokod (chegirma) — SERVER qayta tekshiradi (client faqat ko'rsatadi).
    // Chegirma kodi FAQAT 'discount_percent' turi; premium_days kodlari shu
    // yerda ishlamaydi (ular Profil'dagi PromoCodeModal'da faollashadi).
    let finalAmount = plan.priceUzs
    let discountPercent = 0
    if (promoCode) {
      const promo = await promoRepository.findByCode(promoCode)
      if (!promo) throw new AppError(404, 'Promokod topilmadi', 'PROMO_NOT_FOUND')
      if (!promo.isActive) throw new AppError(400, 'Promokod faol emas', 'PROMO_INACTIVE')
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        throw new AppError(400, 'Promokodning amal qilish muddati tugagan', 'PROMO_EXPIRED')
      }
      if (promo.type !== 'discount_percent') {
        throw new AppError(400, 'Bu promokod chegirma kodi emas', 'PROMO_NOT_DISCOUNT')
      }
      discountPercent = promo.value
      finalAmount = applyDiscount(plan.priceUzs, discountPercent)
    }

    // Generate unique order ID
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const orderId = `ord_${Date.now()}_${randomSuffix}`

    const rawDetails = promoCode ? { promoCode: promoCode.toUpperCase(), discountPercent } : {}
    let order: typeof paymentOrders.$inferSelect
    if (promoCode) {
      const reserved = await promoRepository.createDiscountPaymentOrder(promoCode, {
        orderId,
        userId,
        plan: planKey as PlanKey,
        amountUzs: finalAmount,
        provider,
        rawDetails,
      })
      if (reserved.status === 'created') {
        order = reserved.order as typeof paymentOrders.$inferSelect
      } else {
        switch (reserved.status) {
          case 'not_found': throw new AppError(404, 'Promokod topilmadi', 'PROMO_NOT_FOUND')
          case 'inactive': throw new AppError(400, 'Promokod faol emas', 'PROMO_INACTIVE')
          case 'expired': throw new AppError(400, 'Promokodning amal qilish muddati tugagan', 'PROMO_EXPIRED')
          case 'not_discount': throw new AppError(400, 'Bu promokod chegirma kodi emas', 'PROMO_NOT_DISCOUNT')
          case 'already_used': throw new AppError(400, 'Siz ushbu promokodni avval ishlatgansiz', 'PROMO_ALREADY_USED')
          case 'user_pending': throw new AppError(400, 'Ushbu promokod bilan to\'lov kutilayotgan buyurtmangiz mavjud', 'PROMO_PENDING_EXISTS')
          case 'limit_reached': throw new AppError(400, 'Promokoddan foydalanish limiti tugagan', 'PROMO_LIMIT_REACHED')
        }
      }
    } else {
      const [created] = await db
        .insert(paymentOrders)
        .values({
          orderId,
          userId,
          plan: planKey as PlanKey,
          amountUzs: finalAmount,
          provider,
          status: 'pending',
          rawDetails,
        })
        .returning()
      order = created
    }

    const paymentUrl = provider === 'payme'
      ? buildPaymePaymentUrl({ orderId: order.orderId, amountUzs: order.amountUzs, returnUrl })
      : buildClickPaymentUrl({ orderId: order.orderId, amount: order.amountUzs, returnUrl })

    res.status(201).json({
      ok: true,
      orderId: order.orderId,
      amountUzs: order.amountUzs,
      plan: order.plan,
      provider: order.provider,
      discountPercent,
      paymentUrl,
    })
  })
)

/**
 * 2. Check Order Status
 * Authenticated endpoint: poll or check if order is completed.
 */
paymentRouter.get(
  '/check-order/:orderId',
  requireAuth,
  wrap(async (req: any, res) => {
    const { orderId } = req.params
    const userId = req.userId

    const [order] = await db
      .select()
      .from(paymentOrders)
      .where(and(eq(paymentOrders.orderId, orderId), eq(paymentOrders.userId, userId)))

    if (!order) {
      throw new AppError(404, 'Order not found')
    }

    res.json({
      ok: true,
      orderId: order.orderId,
      status: order.status,
      plan: order.plan,
      amountUzs: order.amountUzs,
      provider: order.provider,
      updatedAt: order.updatedAt,
    })
  })
)

/**
 * 2.5. Payment History (Profil → "To'lovlar tarixi" sheet'i)
 * Authenticated: joriy user'ning buyurtmalari (eng yangisi birinchi, 50 tagacha).
 * PII bo'lmasa-da user'ga tegishli moliyaviy data — keshlanmaydi.
 */
paymentRouter.get(
  '/history',
  requireAuth,
  wrap(async (req: any, res) => {
    const userId = req.userId

    const rows = await db
      .select({
        orderId: paymentOrders.orderId,
        plan: paymentOrders.plan,
        amountUzs: paymentOrders.amountUzs,
        provider: paymentOrders.provider,
        status: paymentOrders.status,
        createdAt: paymentOrders.createdAt,
      })
      .from(paymentOrders)
      .where(eq(paymentOrders.userId, userId))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(50)

    res.set('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    })
  })
)

/**
 * 2.6. Yopiq guruh taklif havolasi (Profil → Yopiq guruh)
 * Authenticated: joriy user'ning Premium obunasini tekshiradi va dinamik invite link qaytaradi.
 */
paymentRouter.get(
  '/closed-group-invite',
  requireAuth,
  wrap(async (req: any, res) => {
    const userId = req.userId
    const subjectId = (req.query.subjectId as string) || 'yhq'

    const { usersRepository } = await import('../users/users.repository')
    const user = await usersRepository.findById(userId)
    const isPremium = user != null && (
      user.tariff === 'premium' ||
      (user.premiumUntil != null && new Date(user.premiumUntil) > new Date())
    )

    if (!isPremium) {
      throw new AppError(403, 'Yopiq guruhga kirish uchun Premium obuna talab qilinadi', 'PREMIUM_REQUIRED')
    }

    const { createGroupInviteLinkForSubject } = await import('../../api-entry/bot')
    const inviteLink = await createGroupInviteLinkForSubject(subjectId, userId)
    const { getSubjectClosedGroupUrl } = await import('../../../shared/subjects')

    res.set('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      inviteLink: inviteLink || getSubjectClosedGroupUrl(subjectId),
    })
  })
)

const ClickWebhookSchema = z.object({
  click_trans_id: z.union([z.string(), z.number()]),
  service_id: z.union([z.string(), z.number()]),
  click_paydoc_id: z.union([z.string(), z.number()]).optional(),
  merchant_trans_id: z.string().min(1).max(64),
  merchant_prepare_id: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]),
  action: z.union([z.literal(0), z.literal(1), z.literal('0'), z.literal('1')]),
  error: z.union([z.string(), z.number()]),
  error_note: z.string().optional(),
  sign_time: z.string().min(1),
  sign_string: z.string().min(1),
})

/**
 * 3. Click Webhook Handler
 * Supports unified POST /click as well as POST /click/prepare and POST /click/complete.
 */
async function handleClickWebhookRoute(req: any, res: any) {
  const parseResult = ClickWebhookSchema.safeParse(req.body)
  if (!parseResult.success) {
    const raw = req.body || {}
    return res.json({
      click_trans_id: raw.click_trans_id ?? 0,
      merchant_trans_id: raw.merchant_trans_id ?? '',
      error: -3,
      error_note: 'Invalid request payload',
    })
  }

  const payload = parseResult.data
  const action = Number(payload.action)

  if (action === 0) {
    const result = await handleClickPrepare(payload as ClickPrepareInput)
    return res.json(result)
  } else if (action === 1) {
    const result = await handleClickComplete(payload as ClickCompleteInput)
    return res.json(result)
  } else {
    return res.json({
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      error: -3,
      error_note: 'Action not found',
    })
  }
}

// Click webhook alohida bucket (audit Q2): imzo-himoyalangan bo'lsa-da, global
// 120/min IP limitidan tashqari maxsus tor cheklov — webhook spam/probe'lar
// DB'ga chuqur ish qilmasligi uchun. KeyFn: IP (webhook'da userId yo'q).
const clickHookLimiter = rateLimit({ maxPerMinute: 30, bucket: 'pay-hook', keyFn: (req) => req.ip ?? 'unknown' })

paymentRouter.post('/click', clickBodyParser, clickHookLimiter, wrap(handleClickWebhookRoute))
paymentRouter.post('/click/prepare', clickBodyParser, clickHookLimiter, wrap(handleClickWebhookRoute))
paymentRouter.post('/click/complete', clickBodyParser, clickHookLimiter, wrap(handleClickWebhookRoute))

// ── Payme (Paycom) Merchant API — JSON-RPC 2.0 ─────────────────────────────
// Auth: HTTP Basic (login "Paycom", parol PAYME_SECRET_KEY) — FAIL-CLOSED
// (secret'siz har qanday RPC -32504: soxta webhook premium bermaydi).
paymentRouter.post(
  '/payme',
  rateLimit({ maxPerMinute: 30, bucket: 'payme-hook', keyFn: (req) => req.ip ?? 'unknown' }),
  wrap(async (req: any, res) => {
    if (!verifyPaymeAuth(req.headers['authorization'])) {
      res.json({
        id: req.body?.id ?? null,
        error: { code: -32504, message: 'Недостаточно привилегий для выполнения данного метода' },
      })
      return
    }
    const result = await handlePaymeRpc(req.body ?? {})
    res.json(result)
  }),
)
