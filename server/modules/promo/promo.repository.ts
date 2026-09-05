import { sql } from 'drizzle-orm'
import { executeRows, transactionBestEffort } from '../../db/connection'
import type { users } from '../../schema'

export interface PromoCodeRow {
  id: number
  code: string
  type: string
  value: number
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  isActive: boolean
  createdAt: Date
}

export interface DiscountOrderInput {
  orderId: string
  userId: string
  plan: string
  amountUzs: number
  provider: string
  rawDetails: Record<string, unknown>
}

export type DiscountOrderResult =
  | { status: 'created'; order: { id: number; orderId: string; userId: string; plan: string; amountUzs: number; provider: string; status: string; rawDetails: Record<string, unknown> } }
  | { status: 'not_found' | 'inactive' | 'expired' | 'not_discount' | 'already_used' | 'user_pending' | 'limit_reached' }

export const promoRepository = {
  async findByCode(code: string): Promise<PromoCodeRow | null> {
    const rows = await executeRows<PromoCodeRow>(sql`
      SELECT
        id,
        code,
        type,
        value,
        max_uses AS "maxUses",
        used_count AS "usedCount",
        expires_at AS "expiresAt",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM promo_codes
      WHERE UPPER(code) = UPPER(${code.trim()})
      LIMIT 1
    `)
    return rows[0] ?? null
  },

  async isRedeemedByUser(promoCodeId: number, userId: string): Promise<boolean> {
    const rows = await executeRows<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM promo_code_redemptions
      WHERE promo_code_id = ${promoCodeId} AND user_id = ${userId}
    `)
    return Number(rows[0]?.count ?? 0) > 0
  },

  /**
   * Foydalanuvchi yoki global miqyosda bu promokod bilan aktiv pending order borligini tekshirish (ID 05).
   * Pending buyurtmalar 30 daqiqa ichida yaratilgan bo'lsa hisobga olinadi.
   */
  async getActivePendingReservations(promoCode: string, userId?: string): Promise<{ userPending: number; totalPending: number }> {
    const rows = await executeRows<{ user_pending: number; total_pending: number }>(sql`
      SELECT
        COUNT(CASE WHEN user_id = ${userId ?? ''} THEN 1 END)::int AS user_pending,
        COUNT(*)::int AS total_pending
      FROM payment_orders
      WHERE status = 'pending'
        AND created_at >= now() - interval '30 minutes'
        AND UPPER(raw_details->>'promoCode') = UPPER(${promoCode.trim()})
    `)
    return {
      userPending: Number(rows[0]?.user_pending ?? 0),
      totalPending: Number(rows[0]?.total_pending ?? 0),
    }
  },

  /**
   * Atomically reserve a discount order. The advisory lock serializes creators
   * for the same code; the row lock keeps used_count changes compatible with
   * redemption. The check and payment_orders INSERT must stay in one tx.
   */
  async createDiscountPaymentOrder(code: string, input: DiscountOrderInput): Promise<DiscountOrderResult> {
    return transactionBestEffort(async (tx) => {
      await executeRows(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(UPPER(${code.trim()}), 0))
      `, tx)

      const promoRows = await executeRows<{
        id: number
        is_active: boolean
        expires_at: Date | null
        type: string
        used_count: number
        max_uses: number | null
      }>(sql`
        SELECT id, is_active, expires_at, type, used_count, max_uses
        FROM promo_codes
        WHERE UPPER(code) = UPPER(${code.trim()})
        FOR UPDATE
      `, tx)
      const promo = promoRows[0]
      if (!promo) return { status: 'not_found' as const }
      if (!promo.is_active) return { status: 'inactive' as const }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { status: 'expired' as const }
      if (promo.type !== 'discount_percent') return { status: 'not_discount' as const }

      const redeemed = await executeRows<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM promo_code_redemptions
          WHERE promo_code_id = ${promo.id} AND user_id = ${input.userId}
        ) AS exists
      `, tx)
      if (redeemed[0]?.exists) return { status: 'already_used' as const }

      const pending = await executeRows<{ user_pending: number; total_pending: number }>(sql`
        SELECT
          COUNT(*) FILTER (WHERE user_id = ${input.userId})::int AS user_pending,
          COUNT(*)::int AS total_pending
        FROM payment_orders
        WHERE status = 'pending'
          AND created_at >= now() - interval '30 minutes'
          AND UPPER(raw_details->>'promoCode') = UPPER(${code.trim()})
      `, tx)
      const userPending = Number(pending[0]?.user_pending ?? 0)
      const totalPending = Number(pending[0]?.total_pending ?? 0)
      if (userPending > 0) return { status: 'user_pending' as const }
      if (promo.max_uses !== null && Number(promo.used_count) + totalPending >= Number(promo.max_uses)) {
        return { status: 'limit_reached' as const }
      }

      const rows = await executeRows<DiscountOrderResult extends { status: 'created'; order: infer O } ? O : never>(sql`
        INSERT INTO payment_orders (order_id, user_id, plan, amount_uzs, provider, status, raw_details)
        VALUES (
          ${input.orderId}, ${input.userId}, ${input.plan}, ${input.amountUzs},
          ${input.provider}, 'pending', ${JSON.stringify(input.rawDetails)}::jsonb
        )
        RETURNING id, order_id AS "orderId", user_id AS "userId", plan,
                  amount_uzs AS "amountUzs", provider, status, raw_details AS "rawDetails"
      `, tx)
      const order = rows[0]
      if (!order) throw new Error('Discount order reservation insert returned no row')
      return { status: 'created' as const, order }
    })
  },

  /**
   * Promokodni foydalanuvchiga qo'llash — atomik tranzaksiya / CTE:
   * 1. promo_code_redemptions ga yozish (agar avval ishlatilmagan bo'lsa)
   * 2. promo_codes used_count ni 1 ga oshirish (agar max_uses dan oshmasa)
   * 3. users jadvalida tariff='premium' va premium_until ni uzaytirish
   */
  async redeem(promoCodeId: number, userId: string, days: number): Promise<{
    success: boolean
    premiumUntil: Date | null
    tariff: typeof users.$inferSelect['tariff']
  }> {
    const rows = await executeRows<{
      success: boolean
      premiumUntil: Date | null
      tariff: typeof users.$inferSelect['tariff']
    }>(sql`
      WITH inserted_redemption AS (
        INSERT INTO promo_code_redemptions (promo_code_id, user_id)
        VALUES (${promoCodeId}, ${userId})
        ON CONFLICT (promo_code_id, user_id) DO NOTHING
        RETURNING id
      ), updated_promo AS (
        UPDATE promo_codes
        SET used_count = used_count + 1
        WHERE id = ${promoCodeId}
          AND EXISTS (SELECT 1 FROM inserted_redemption)
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING id
      ), updated_user AS (
        UPDATE users
        SET
          /* C-1: muddatli grant tariff'ga TEGMAYDI — premium_until yetarli.
           * (oldingi 'tariff = premium' +3 kunlik promoni umrbod qilib qo'yardi) */
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days}::int),
          updated_at = now()
        WHERE id = ${userId}
          AND EXISTS (SELECT 1 FROM updated_promo)
        RETURNING id, tariff, premium_until AS "premiumUntil"
      )
      SELECT
        EXISTS(SELECT 1 FROM updated_user) AS success,
        (SELECT "premiumUntil" FROM updated_user) AS "premiumUntil",
        (SELECT tariff FROM updated_user) AS tariff
    `)

    const result = rows[0]
    return {
      success: Boolean(result?.success),
      premiumUntil: result?.premiumUntil ? new Date(result.premiumUntil) : null,
      tariff: result?.tariff ?? 'free',
    }
  },

  /**
   * Chegirma promokodini ISHLATILDI deb belgilash (to'lov COMPLETION'da —
   * order yaratilganda EMAS: bekor to'lov kodni kuydirmaydi).
   * Atomik: per-user UNIQUE(promo_code_id, user_id) + max_uses guard.
   * Parallel ikki to'lov bir xil kod bilan — faqat biri hisoblanadi.
   */
  async markRedeemed(promoCodeId: number, userId: string): Promise<boolean> {
    const rows = await executeRows<{ ok: boolean }>(sql`
      WITH inserted AS (
        INSERT INTO promo_code_redemptions (promo_code_id, user_id)
        VALUES (${promoCodeId}, ${userId})
        ON CONFLICT (promo_code_id, user_id) DO NOTHING
        RETURNING id
      ), bumped AS (
        UPDATE promo_codes
        SET used_count = used_count + 1
        WHERE id = ${promoCodeId}
          AND EXISTS (SELECT 1 FROM inserted)
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING id
      )
      SELECT EXISTS (SELECT 1 FROM inserted) AS ok
    `)
    return Boolean(rows[0]?.ok)
  },

  async getAllCodes(): Promise<PromoCodeRow[]> {
    return executeRows<PromoCodeRow>(sql`
      SELECT
        id,
        code,
        type,
        value,
        max_uses AS "maxUses",
        used_count AS "usedCount",
        expires_at AS "expiresAt",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM promo_codes
      ORDER BY created_at DESC
    `)
  },

  async createCode(input: {
    code: string
    type?: string
    value: number
    maxUses?: number | null
    expiresAt?: Date | null
  }): Promise<PromoCodeRow> {
    const rows = await executeRows<PromoCodeRow>(sql`
      INSERT INTO promo_codes (code, type, value, max_uses, expires_at)
      VALUES (
        UPPER(${input.code.trim()}),
        ${input.type ?? 'premium_days'},
        ${input.value},
        ${input.maxUses ?? null},
        ${input.expiresAt ?? null}
      )
      RETURNING
        id,
        code,
        type,
        value,
        max_uses AS "maxUses",
        used_count AS "usedCount",
        expires_at AS "expiresAt",
        is_active AS "isActive",
        created_at AS "createdAt"
    `)
    return rows[0]
  },

  async toggleActive(id: number, isActive: boolean): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE promo_codes
      SET is_active = ${isActive}
      WHERE id = ${id}
      RETURNING id
    `)
    return rows.length > 0
  },

  async deleteCode(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      DELETE FROM promo_codes
      WHERE id = ${id}
      RETURNING id
    `)
    return rows.length > 0
  },
}
