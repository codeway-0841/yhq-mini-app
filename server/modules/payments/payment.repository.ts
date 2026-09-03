import { sql } from 'drizzle-orm'
import type { PlanKey } from '../../../shared/premium-plans'
import { executeRows } from '../../db/connection'

export interface CompletePaymentInput {
  telegramChargeId: string
  providerChargeId: string
  userId: string
  plan: PlanKey
  days: number | null
  amount: number
  currency: string
  payload: string
  rawUpdate: Record<string, unknown>
}

export type CompletePaymentResult = 'activated' | 'duplicate' | 'user_not_found'

export interface CompleteProviderOrderInput extends CompletePaymentInput {
  orderPk: number
  orderId: string
  providerTransId: string
  orderRawDetails: Record<string, unknown>
}

export type CompleteProviderOrderResult =
  | { status: 'activated' | 'duplicate'; order: { id: number; orderId: string; status: string; providerTransId: string | null; rawDetails: Record<string, unknown> } }
  | { status: 'user_not_found' | 'not_pending' }

export const paymentRepository = {
  /**
   * Ledger insert va entitlement update bitta PostgreSQL statement ichida bajariladi.
   * Charge ID takror kelsa `inserted` bo'sh qoladi va premium qayta berilmaydi.
   */
  async complete(input: CompletePaymentInput): Promise<CompletePaymentResult> {
    const rows = await executeRows<{
      user_exists: boolean
      inserted: boolean
      activated: boolean
    }>(sql`
      WITH target_user AS (
        SELECT id FROM users WHERE id = ${input.userId}
      ), inserted AS (
        INSERT INTO payments (
          telegram_payment_charge_id,
          provider_payment_charge_id,
          user_id,
          plan,
          amount,
          currency,
          payload,
          status,
          raw_update
        )
        SELECT
          ${input.telegramChargeId},
          ${input.providerChargeId},
          target_user.id,
          ${input.plan},
          ${input.amount},
          ${input.currency},
          ${input.payload},
          'completed',
          ${JSON.stringify(input.rawUpdate)}::jsonb
        FROM target_user
        ON CONFLICT (telegram_payment_charge_id) DO NOTHING
        RETURNING user_id
      ), activated AS (
        UPDATE users
        SET
          /* C-1 (audit CRITICAL): tariff='premium' FAQAT days IS NULL sentinelida.
           * OYLIK MODEL (2026-08-29): barcha plan'lar 30 kunlik — plan'lardan
           * days=null ENDI KELMAYDI; sentinel branch faqat eski umrbod egalari
           * va admin grant (admin.repository.grantPremium) uchun saqlanadi.
           * Muddatli grantlar tariff'ga TEGMAYDI — entitlement premium_until
           * > now() orqali; aks holda eng arzon oylik xarid umrbod premium
           * berib qo'yardi (hech narsa tariff'ni qaytarmasdi). */
          tariff = CASE
            WHEN ${input.days}::integer IS NULL THEN 'premium'::tariff
            ELSE users.tariff
          END,
          premium_until = CASE
            WHEN ${input.days}::integer IS NULL THEN users.premium_until
            ELSE GREATEST(COALESCE(users.premium_until, now()), now())
              + make_interval(days => ${input.days}::integer)
          END,
          updated_at = now()
        WHERE users.id = ${input.userId}
          AND EXISTS (SELECT 1 FROM inserted)
        RETURNING users.id
      )
      SELECT
        EXISTS (SELECT 1 FROM target_user) AS user_exists,
        EXISTS (SELECT 1 FROM inserted) AS inserted,
        EXISTS (SELECT 1 FROM activated) AS activated
    `)

    const row = rows[0]
    if (!row?.user_exists) return 'user_not_found'
    if (!row.inserted) return 'duplicate'
    if (!row.activated) throw new Error('Payment ledger inserted without entitlement activation')
    return 'activated'
  },

  /**
   * Provider order completion — payment_orders claim + payments ledger +
   * entitlement bitta statementda. Shu bilan "order completed, premium yo'q"
   * crash oynasi yopiladi.
   */
  async completeProviderOrder(input: CompleteProviderOrderInput): Promise<CompleteProviderOrderResult> {
    const rows = await executeRows<{
      order_exists: boolean
      user_exists: boolean
      claimed: boolean
      inserted: boolean
      activated: boolean
      id: number | null
      order_id: string | null
      status: string | null
      provider_trans_id: string | null
      raw_details: Record<string, unknown> | null
    }>(sql`
      WITH order_row AS (
        SELECT id, order_id, user_id
        FROM payment_orders
        WHERE id = ${input.orderPk} AND order_id = ${input.orderId}
      ), existing_payment AS (
        SELECT 1
        FROM payments
        WHERE telegram_payment_charge_id = ${input.telegramChargeId}
      ), target_user AS (
        SELECT users.id
        FROM users
        JOIN order_row ON order_row.user_id = users.id
      ), claimed AS (
        UPDATE payment_orders
        SET
          status = 'completed',
          provider_trans_id = ${input.providerTransId},
          raw_details = ${JSON.stringify(input.orderRawDetails)}::jsonb,
          updated_at = now()
        WHERE id = ${input.orderPk}
          AND order_id = ${input.orderId}
          AND status = 'pending'
          AND EXISTS (SELECT 1 FROM target_user)
          AND NOT EXISTS (SELECT 1 FROM existing_payment)
        RETURNING id, order_id, user_id, status, provider_trans_id, raw_details
      ), inserted AS (
        INSERT INTO payments (
          telegram_payment_charge_id,
          provider_payment_charge_id,
          user_id,
          plan,
          amount,
          currency,
          payload,
          status,
          raw_update
        )
        SELECT
          ${input.telegramChargeId},
          ${input.providerChargeId},
          claimed.user_id,
          ${input.plan},
          ${input.amount},
          ${input.currency},
          ${input.payload},
          'completed',
          ${JSON.stringify(input.rawUpdate)}::jsonb
        FROM claimed
        ON CONFLICT (telegram_payment_charge_id) DO NOTHING
        RETURNING user_id
      ), activated AS (
        UPDATE users
        SET
          tariff = CASE
            WHEN ${input.days}::integer IS NULL THEN 'premium'::tariff
            ELSE users.tariff
          END,
          premium_until = CASE
            WHEN ${input.days}::integer IS NULL THEN users.premium_until
            ELSE GREATEST(COALESCE(users.premium_until, now()), now())
              + make_interval(days => ${input.days}::integer)
          END,
          updated_at = now()
        WHERE users.id = ${input.userId}
          AND EXISTS (SELECT 1 FROM inserted)
        RETURNING users.id
      )
      SELECT
        EXISTS (SELECT 1 FROM order_row) AS order_exists,
        EXISTS (SELECT 1 FROM target_user) AS user_exists,
        EXISTS (SELECT 1 FROM claimed) AS claimed,
        EXISTS (SELECT 1 FROM inserted) AS inserted,
        EXISTS (SELECT 1 FROM activated) AS activated,
        (SELECT id::int FROM claimed) AS id,
        (SELECT order_id FROM claimed) AS order_id,
        (SELECT status FROM claimed) AS status,
        (SELECT provider_trans_id FROM claimed) AS provider_trans_id,
        (SELECT raw_details FROM claimed) AS raw_details
    `)

    const row = rows[0]
    if (!row?.order_exists) return { status: 'not_pending' }
    if (!row.user_exists) return { status: 'user_not_found' }
    if (!row.claimed) return { status: 'not_pending' }
    if (!row.inserted) {
      return {
        status: 'duplicate',
        order: {
          id: Number(row.id),
          orderId: String(row.order_id),
          status: String(row.status),
          providerTransId: row.provider_trans_id,
          rawDetails: row.raw_details ?? {},
        },
      }
    }
    if (!row.activated) throw new Error('Provider order completed without entitlement activation')
    return {
      status: 'activated',
      order: {
        id: Number(row.id),
        orderId: String(row.order_id),
        status: String(row.status),
        providerTransId: row.provider_trans_id,
        rawDetails: row.raw_details ?? {},
      },
    }
  },
}
