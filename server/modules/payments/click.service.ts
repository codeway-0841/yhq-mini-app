/**
 * Click.uz Payment Gateway Service
 * Implements Click Merchant API specification for payments in Uzbekistan.
 */

import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { paymentOrders } from '../../schema'
import { paymentRepository } from './payment.repository'
import { getPlan, type PlanKey } from '../../../shared/premium-plans'
import { config } from '../../config'

export interface ClickPrepareInput {
  click_trans_id: string | number
  service_id: string | number
  click_paydoc_id?: string | number
  merchant_trans_id: string // orderId
  amount: string | number
  action: 0 | '0'
  error: string | number
  error_note?: string
  sign_time: string
  sign_string: string
}

export interface ClickCompleteInput {
  click_trans_id: string | number
  service_id: string | number
  click_paydoc_id?: string | number
  merchant_trans_id: string // orderId
  merchant_prepare_id: string | number // paymentOrders.id
  amount: string | number
  action: 1 | '1'
  error: string | number
  error_note?: string
  sign_time: string
  sign_string: string
}

export interface ClickResponse {
  click_trans_id: string | number
  merchant_trans_id: string
  merchant_prepare_id?: number | null
  merchant_confirm_id?: number | null
  error: number
  error_note: string
}

export const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_CANCELLED: -9,
} as const

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex')
}

/** Timing-safe hex compare (past uzunligi tufayli timing signal minimal, lekin baribir). */
function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf8')
  const right = Buffer.from(b.toLowerCase(), 'utf8')
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

/** Imzo tekshiruvi — FAQAT secret sozlanganda o'tadi. Secret YO'Q bo'lsa
 *  webhook FAIL-CLOSED: hech qanday to'lov tasdiqlanmaydi (bepul premium himoyasi). */
function verifyClickSignature(expectedSign: string, providedSign: unknown): boolean {
  if (typeof providedSign !== 'string' || providedSign.length === 0) return false
  return safeEqualHex(expectedSign, String(providedSign))
}

/**
 * Generate MD5 signature according to Click specification
 */
export function generateClickSignature(
  params: {
    click_trans_id: string | number
    service_id: string | number
    secret_key: string
    merchant_trans_id: string
    merchant_prepare_id?: string | number
    amount: string | number
    action: number | string
    sign_time: string
  }
): string {
  const { click_trans_id, service_id, secret_key, merchant_trans_id, merchant_prepare_id, amount, action, sign_time } = params
  const raw = String(action) === '1'
    ? `${click_trans_id}${service_id}${secret_key}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`
    : `${click_trans_id}${service_id}${secret_key}${merchant_trans_id}${amount}${action}${sign_time}`
  return md5(raw)
}

/**
 * Generate checkout payment link for Click.uz
 */
export function buildClickPaymentUrl(params: {
  orderId: string
  amount: number
  returnUrl?: string
}): string {
  const serviceId = config.click.serviceId || '32876'
  const merchantId = config.click.merchantId || '24567'
  const returnUrl = params.returnUrl || `${config.deploy.appUrl}/premium`

  return `https://my.click.uz/services/pay?service_id=${encodeURIComponent(serviceId)}&merchant_id=${encodeURIComponent(merchantId)}&amount=${params.amount}&transaction_param=${encodeURIComponent(params.orderId)}&return_url=${encodeURIComponent(returnUrl)}`
}

/**
 * Handle Click Prepare step (action = 0)
 */
export async function handleClickPrepare(input: ClickPrepareInput): Promise<ClickResponse> {
  const secretKey = config.click.secretKey
  const clickTransId = input.click_trans_id
  const merchantTransId = String(input.merchant_trans_id || '').trim()

  // 1. Signature validation — MAJBURIY (fail-closed): secret sozlanmagan bo'lsa
  //    ham soxta so'rov o'tmaydi. Secret'siz muhit faqat dev (mock/test'lar
  //    service'ni to'g'ridan-to'g'ri chaqiradi, webhook esa hech qachon).
  if (!secretKey) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED',
    }
  }
  const expectedSign = generateClickSignature({
    click_trans_id: input.click_trans_id,
    service_id: input.service_id,
    secret_key: secretKey,
    merchant_trans_id: merchantTransId,
    amount: input.amount,
    action: 0,
    sign_time: input.sign_time,
  })

  if (!verifyClickSignature(expectedSign, input.sign_string)) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED',
    }
  }

  // 2. Look up the order in DB
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.orderId, merchantTransId))

  if (!order) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.ORDER_NOT_FOUND,
      error_note: 'Order not found',
    }
  }

  // 3. Amount validation
  const reqAmount = Number(input.amount)
  if (Math.abs(reqAmount - order.amountUzs) > 0.01) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.INCORRECT_AMOUNT,
      error_note: 'Incorrect amount',
    }
  }

  // 4. Status validation
  if (order.status === 'completed') {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: order.id,
      error: CLICK_ERRORS.ALREADY_PAID,
      error_note: 'Already paid',
    }
  }

  // 5. Success -> return merchant_prepare_id (order.id)
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: order.id,
    error: CLICK_ERRORS.SUCCESS,
    error_note: 'Success',
  }
}

/**
 * Handle Click Complete step (action = 1)
 */
export async function handleClickComplete(input: ClickCompleteInput): Promise<ClickResponse> {
  const secretKey = config.click.secretKey
  const clickTransId = input.click_trans_id
  const merchantTransId = String(input.merchant_trans_id || '').trim()
  const prepareId = Number(input.merchant_prepare_id)

  // 1. Signature validation — MAJBURIY (fail-closed), prepare bilan bir xil.
  if (!secretKey) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED',
    }
  }
  const expectedSign = generateClickSignature({
    click_trans_id: input.click_trans_id,
    service_id: input.service_id,
    secret_key: secretKey,
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: prepareId,
    amount: input.amount,
    action: 1,
    sign_time: input.sign_time,
  })

  if (!verifyClickSignature(expectedSign, input.sign_string)) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.SIGN_CHECK_FAILED,
      error_note: 'SIGN CHECK FAILED',
    }
  }

  // 2. Look up order
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, prepareId))

  if (!order || order.orderId !== merchantTransId) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.ORDER_NOT_FOUND,
      error_note: 'Order not found',
    }
  }

  // 3. If Click reported error (< 0) -> mark cancelled
  if (Number(input.error) < 0) {
    await db
      .update(paymentOrders)
      .set({
        status: 'cancelled',
        providerTransId: String(clickTransId),
        rawDetails: input as unknown as Record<string, unknown>,
      })
      .where(eq(paymentOrders.id, order.id))

    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERRORS.TRANSACTION_CANCELLED,
      error_note: 'Transaction cancelled',
    }
  }

  // 4. If already completed
  if (order.status === 'completed') {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: order.id,
      error: CLICK_ERRORS.SUCCESS,
      error_note: 'Success',
    }
  }

  // 5. Activate Premium entitlement
  const plan = getPlan(order.plan)
  if (plan) {
    const chargeId = `click_${clickTransId}`
    await paymentRepository.complete({
      telegramChargeId: chargeId,
      providerChargeId: String(clickTransId),
      userId: order.userId,
      plan: plan.key as PlanKey,
      days: plan.days,
      amount: order.amountUzs,
      currency: 'UZS',
      payload: `click_order_${order.orderId}`,
      rawUpdate: input as unknown as Record<string, unknown>,
    })
  }

  // 6. Update order status to completed
  await db
    .update(paymentOrders)
    .set({
      status: 'completed',
      providerTransId: String(clickTransId),
      rawDetails: input as unknown as Record<string, unknown>,
    })
    .where(eq(paymentOrders.id, order.id))

  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_confirm_id: order.id,
    error: CLICK_ERRORS.SUCCESS,
    error_note: 'Success',
  }
}
