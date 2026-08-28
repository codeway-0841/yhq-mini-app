/**
 * Payme (Paycom) Merchant API — JSON-RPC 2.0.
 *
 * Click'dagi (click.service.ts) bilan bir xil xavfsizlik modeli:
 *  - AUTH FAIL-CLOSED: PAYME_SECRET_KEY sozlanmagan bo'lsa HAR QANDAY RPC
 *    -32504 bilan rad etiladi (soxta webhook = bepul premium yo'li YO'Q).
 *  - Summani FAQAT DB'dagi order bilan solishtiramiz (TIYIN'da — 1 UZS = 100).
 *  - PerformTransaction ATOMIK CLAIM (pending→completed conditional UPDATE) —
 *    parallel/replay webhook'dan premium ikki marta berilmaydi; xuddi shu
 *    tranzaksiya replay'i idempotent SUCCESS.
 *
 * Payme → merchant RPC metodlar: CheckPerformTransaction, CreateTransaction,
 * PerformTransaction, CancelTransaction, CheckTransaction.
 * Tranzaksiya holatlari: 1=created, 2=completed, -1=cancelled(pending),
 * -2=cancelled(after perform). Bizning order.status mapping:
 *   pending(+providerTransId)=1, completed=2, cancelled=-1/-2 (rawDetails.paymeState).
 */

import crypto from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/connection'
import { paymentOrders } from '../../schema'
import { paymentRepository } from './payment.repository'
import { redeemOrderPromo } from './order-promo'
import { getPlan, type PlanKey } from '../../../shared/premium-plans'
import { config } from '../../config'
import { Sentry } from '../../utils/sentry'

/** Payme xato kodlari (merchant diapazoni -31001..-31099 + protokol). */
const PAYME_ERRORS = {
  INVALID_AMOUNT:      -31001,
  TRANSACTION_NOT_FOUND: -31003,
  ORDER_NOT_FOUND:     -31050,
  CANT_PERFORM:        -31008,
  INVALID_ACCOUNT:     -31050,
  UNAUTHORIZED:        -32504,
  METHOD_NOT_FOUND:    -32601,
  INVALID_PARAMS:      -32602,
  INTERNAL:            -32400,
} as const

type OrderRow = typeof paymentOrders.$inferSelect

interface RpcError { code: number; message: string; data?: string }
interface RpcResultOk { result: Record<string, unknown> }
interface RpcResultErr { error: RpcError }
type RpcOutcome = RpcResultOk | RpcResultErr

function ok(result: Record<string, unknown>): RpcResultOk { return { result } }
function err(code: number, message: string, data?: string): RpcResultErr {
  return { error: { code, message, ...(data ? { data } : {}) } }
}

/** Basic auth: login "Paycom", password = PAYME_SECRET_KEY. Timing-safe. */
export function verifyPaymeAuth(authHeader: string | undefined): boolean {
  const secret = config.payme.secretKey
  if (!secret || !authHeader?.startsWith('Basic ')) return false
  const expected = Buffer.from(`Paycom:${secret}`, 'utf8').toString('base64')
  const got = authHeader.slice(6).trim()
  const a = Buffer.from(got), b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Checkout havolasi: https://checkout.paycom.uz/<base64(m=..;ac.order_id=..;a=..;c=..)>
 *  Summa TIYIN'da (UZS × 100). */
export function buildPaymePaymentUrl(params: {
  orderId: string
  amountUzs: number
  returnUrl?: string
}): string {
  const merchantId = config.payme.merchantId
  const returnUrl = params.returnUrl || `${config.deploy.appUrl}/premium`
  const raw = `m=${merchantId};ac.order_id=${params.orderId};a=${params.amountUzs * 100};c=${returnUrl}`
  return `https://checkout.paycom.uz/${Buffer.from(raw, 'utf8').toString('base64')}`
}

function orderNotFound(): RpcResultErr { return err(PAYME_ERRORS.ORDER_NOT_FOUND, 'Buyurtma topilmadi', 'order_id') }
function txNotFound(): RpcResultErr { return err(PAYME_ERRORS.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi') }

/** Order'ni orderId (account.order_id) bo'yicha o'qish. */
async function findOrder(orderId: string): Promise<OrderRow | null> {
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderId, orderId))
  return order ?? null
}

/** Summa (tiyin) order summasiga tengmi — NaN ham rad etiladi. */
function amountMatches(order: OrderRow, amountTiyin: unknown): boolean {
  const n = Number(amountTiyin)
  return Number.isFinite(n) && Math.abs(n - order.amountUzs * 100) < 1
}

function paymeStateOf(order: OrderRow): number {
  return (order.rawDetails as { paymeState?: number }).paymeState
    ?? (order.status === 'completed' ? 2 : order.status === 'cancelled' ? -1 : 1)
}

function txView(order: OrderRow): Record<string, unknown> {
  const d = order.rawDetails as { createTime?: number; performTime?: number; cancelTime?: number; cancelReason?: number }
  return {
    transaction:   order.orderId,
    state:         paymeStateOf(order),
    create_time:   d.createTime ?? 0,
    perform_time:  d.performTime ?? 0,
    cancel_time:   d.cancelTime ?? 0,
    reason:        d.cancelReason ?? null,
  }
}

// ── RPC metodlar ──────────────────────────────────────────────────────────

async function checkPerformTransaction(params: Record<string, unknown>): Promise<RpcOutcome> {
  const account = params['account'] as Record<string, unknown> | undefined
  const orderId = String(account?.['order_id'] ?? '').trim()
  if (!orderId) return err(PAYME_ERRORS.INVALID_ACCOUNT, "account.order_id majburiy")
  const order = await findOrder(orderId)
  if (!order) return orderNotFound()
  if (!amountMatches(order, params['amount'])) return err(PAYME_ERRORS.INVALID_AMOUNT, "Noto'g'ri summa")
  if (order.status === 'cancelled') return err(PAYME_ERRORS.CANT_PERFORM, 'Buyurtma bekor qilingan')
  if (order.status === 'completed') return err(PAYME_ERRORS.CANT_PERFORM, "Buyurtma allaqachon to'langan")
  return ok({ allow: true })
}

async function createTransaction(params: Record<string, unknown>): Promise<RpcOutcome> {
  const account = params['account'] as Record<string, unknown> | undefined
  const orderId = String(account?.['order_id'] ?? '').trim()
  const paymeTxId = String(params['id'] ?? '')
  const paymeTime = Number(params['time']) || Date.now()
  if (!orderId || !paymeTxId) return err(PAYME_ERRORS.INVALID_PARAMS, 'id va account.order_id majburiy')

  const order = await findOrder(orderId)
  if (!order) return orderNotFound()

  // Idempotency: xuddi shu Payme tranzaksiyasi qayta yaratilsa — mavjudini qaytaramiz
  if (order.providerTransId === paymeTxId) return ok(txView(order))
  // Boshqa Payme tranzaksiyasi band qilgan yoki to'langan — yangisiga ruxsat yo'q
  if (order.providerTransId || order.status === 'completed') {
    return err(PAYME_ERRORS.CANT_PERFORM, 'Buyurtmaga boshqa tranzaksiya bog‘langan')
  }
  if (order.status === 'cancelled') return err(PAYME_ERRORS.CANT_PERFORM, 'Buyurtma bekor qilingan')
  if (!amountMatches(order, params['amount'])) return err(PAYME_ERRORS.INVALID_AMOUNT, "Noto'g'ri summa")

  const [updated] = await db
    .update(paymentOrders)
    .set({
      providerTransId: paymeTxId,
      rawDetails: { ...order.rawDetails, paymeState: 1, createTime: paymeTime },
    })
    // ATOMIK: parallel CreateTransaction'dan faqat biri o'tadi
    .where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, 'pending')))
    .returning()
  if (!updated) {
    const fresh = await findOrder(orderId)
    if (fresh?.providerTransId === paymeTxId) return ok(txView(fresh))
    return err(PAYME_ERRORS.CANT_PERFORM, 'Buyurtma holati o‘zgargan')
  }
  return ok(txView(updated))
}

async function performTransaction(params: Record<string, unknown>): Promise<RpcOutcome> {
  const paymeTxId = String(params['id'] ?? '')
  if (!paymeTxId) return err(PAYME_ERRORS.INVALID_PARAMS, 'id majburiy')

  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.providerTransId, paymeTxId))
  if (!order) return txNotFound()

  if (order.status === 'completed') {
    // Xuddi shu tranzaksiya replay'i — idempotent SUCCESS (qayta grant YO'Q)
    return ok(txView(order))
  }
  if (order.status === 'cancelled') return err(PAYME_ERRORS.CANT_PERFORM, 'Tranzaksiya bekor qilingan')

  // ATOMIK CLAIM — parallel Perform'dan faqat biri o'tadi
  const [claimed] = await db
    .update(paymentOrders)
    .set({
      status: 'completed',
      rawDetails: { ...order.rawDetails, paymeState: 2, performTime: Date.now() },
    })
    .where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, 'pending')))
    .returning()
  if (!claimed) {
    const [fresh] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id))
    if (fresh?.status === 'completed') return ok(txView(fresh))
    return err(PAYME_ERRORS.CANT_PERFORM, 'Tranzaksiya holati o‘zgargan')
  }

  // Premium grant (ledger CTE idempotent) — Click'dagi bilan bir xil
  const plan = getPlan(order.plan)
  if (plan) {
    try {
      const result = await paymentRepository.complete({
        telegramChargeId: `payme_${paymeTxId}`,
        providerChargeId: paymeTxId,
        userId: order.userId,
        plan: plan.key as PlanKey,
        days: plan.days,
        amount: order.amountUzs,
        currency: 'UZS',
        payload: `payme_order_${order.orderId}`,
        rawUpdate: { provider: 'payme', paymeTxId },
      })
      if (result === 'user_not_found') {
        await db.update(paymentOrders).set({ status: 'cancelled' }).where(eq(paymentOrders.id, order.id)).returning({ id: paymentOrders.id })
        return err(PAYME_ERRORS.CANT_PERFORM, 'Foydalanuvchi topilmadi')
      }
    } catch (e) {
      // Grant xatosi — order'ni qayta 'pending'ga qaytaramiz, Payme retry qiladi
      await db.update(paymentOrders).set({ status: 'pending' }).where(eq(paymentOrders.id, order.id)).returning({ id: paymentOrders.id })
      throw e
    }
  }

  // Promokod redemption — best-effort (premium allaqachon berilgan)
  await redeemOrderPromo(order)

  return ok(txView(claimed))
}

async function cancelTransaction(params: Record<string, unknown>): Promise<RpcOutcome> {
  const paymeTxId = String(params['id'] ?? '')
  const reason = Number(params['reason']) || 0
  if (!paymeTxId) return err(PAYME_ERRORS.INVALID_PARAMS, 'id majburiy')

  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.providerTransId, paymeTxId))
  if (!order) return txNotFound()

  const afterPerform = order.status === 'completed'
  const newState = afterPerform ? -2 : -1

  if (order.status !== 'cancelled') {
    if (afterPerform) {
      // Pul qaytariladi, lekin premium grant qaytarilmaydi (ledger idempotent) —
      // ops manual refund jarayoni; Sentry'da ko'rinadigan signal qoldiramiz
      Sentry.captureMessage('Payme refund: completed order cancelled — premium revoke MANUAL', {
        level: 'warning',
        extra: { orderId: order.orderId, userId: order.userId, paymeTxId, reason },
      })
    }
    await db
      .update(paymentOrders)
      .set({
        status: 'cancelled',
        rawDetails: { ...order.rawDetails, paymeState: newState, cancelTime: Date.now(), cancelReason: reason },
      })
      .where(eq(paymentOrders.id, order.id))
      .returning({ id: paymentOrders.id })
  }

  const [fresh] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id))
  return ok(txView(fresh!))
}

async function checkTransaction(params: Record<string, unknown>): Promise<RpcOutcome> {
  const paymeTxId = String(params['id'] ?? '')
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.providerTransId, paymeTxId))
  if (!order) return txNotFound()
  return ok(txView(order))
}

// ── RPC dispatcher ────────────────────────────────────────────────────────

interface RpcRequest { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

/** Bitta JSON-RPC so'rovini bajarish — router'dan chaqiriladi. */
export async function handlePaymeRpc(body: RpcRequest): Promise<{ id: string | number | null } & RpcOutcome> {
  const id = body?.id ?? null
  try {
    switch (body?.method) {
      case 'CheckPerformTransaction': return { id, ...(await checkPerformTransaction(body.params ?? {})) }
      case 'CreateTransaction':       return { id, ...(await createTransaction(body.params ?? {})) }
      case 'PerformTransaction':      return { id, ...(await performTransaction(body.params ?? {})) }
      case 'CancelTransaction':       return { id, ...(await cancelTransaction(body.params ?? {})) }
      case 'CheckTransaction':        return { id, ...(await checkTransaction(body.params ?? {})) }
      default:                        return { id, ...err(PAYME_ERRORS.METHOD_NOT_FOUND, 'Metod topilmadi') }
    }
  } catch (e) {
    Sentry.captureException(e)
    return { id, ...err(PAYME_ERRORS.INTERNAL, 'Ichki xatolik') }
  }
}
