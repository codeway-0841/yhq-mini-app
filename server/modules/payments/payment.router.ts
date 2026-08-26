import { Router } from 'express'
import express from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/connection'
import { paymentOrders } from '../../schema'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { wrap, AppError } from '../../middleware/error-handler'
import { getPlan, type PlanKey } from '../../../shared/premium-plans'
import {
  handleClickPrepare,
  handleClickComplete,
  buildClickPaymentUrl,
  type ClickPrepareInput,
  type ClickCompleteInput,
} from './click.service'

export const paymentRouter = Router()

/** Buyurtma yaratish — 10/min (payment_orders jadvalining maqsadsiz o'sishini
 *  cheklash; Vercel'da in-memory limiter no-op — DB counter ishlaydi). */
const orderLimiter = rateLimit({ maxPerMinute: 10, bucket: 'pay-order' })

/** Click webhook body'si ba'zi integratsiyalarda form-urlencoded keladi —
 *  express.json faqat JSON'ni parse qiladi. Ikkala format qabul qilinadi. */
const clickBodyParser = express.urlencoded({ extended: false })

const CreateOrderSchema = z.object({
  plan: z.enum(['month', 'year', 'lifetime']),
  provider: z.enum(['click']).default('click'),
  returnUrl: z.string().url().optional(),
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
    const { plan: planKey, provider, returnUrl } = req.body
    const userId = req.userId

    const plan = getPlan(planKey)
    if (!plan) {
      throw new AppError(400, 'Invalid plan')
    }

    // Generate unique order ID
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const orderId = `ord_${Date.now()}_${randomSuffix}`

    const [order] = await db
      .insert(paymentOrders)
      .values({
        orderId,
        userId,
        plan: planKey as PlanKey,
        amountUzs: plan.priceUzs,
        provider,
        status: 'pending',
        rawDetails: {},
      })
      .returning()

    const paymentUrl = buildClickPaymentUrl({
      orderId: order.orderId,
      amount: order.amountUzs,
      returnUrl,
    })

    res.status(201).json({
      ok: true,
      orderId: order.orderId,
      amountUzs: order.amountUzs,
      plan: order.plan,
      provider: order.provider,
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
