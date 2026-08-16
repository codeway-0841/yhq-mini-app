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
          tariff = 'premium'::tariff,
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
}
