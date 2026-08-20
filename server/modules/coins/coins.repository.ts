/**
 * Coins repository — FIXPLAN #40 iqtisodiyotining DB qatlami.
 *
 * XAVFSIZLIK MODELI (server trust boundary):
 *  - Balans FAQAT server'da o'zgaradi: mint — progress.recordAnswer CTE'da
 *    (gate+token replay himoyasiga bog'langan), debit — purchase CTE'da.
 *  - Ledger-first idempotency: coin_transactions UNIQUE(user_id, reason, ref_id)
 *    bir mantiqiy amalni ikki marta yozishga yo'l qo'ymaydi.
 *  - Debit CTE ATOMIK: `balance >= price` shartli UPDATE — parallel xaridlar
 *    balansni manfiyga tushira olmaydi (row lock), owned-guard ikki marta
 *    sotib olishni oldini oladi.
 */
import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { getShopItem, isDurableShopItem } from '../../../shared/shop-items'
import { getMerchItem, MERCH_ITEMS } from '../../../shared/merch-items'
import { DAILY_TASKS, getDailyTask, type DailyTaskMetric } from '../../../shared/daily-tasks'

/** daily_records ustuni — FAQAT SSOT metrikalari (SQL injection yo'q: identifier) */
const METRIC_COLUMN: Record<DailyTaskMetric, ReturnType<typeof sql.identifier>> = {
  answered: sql.identifier('answered'),
  correct:  sql.identifier('correct'),
  fixed:    sql.identifier('fixed'),
}

export type PurchaseResult =
  | { status: 'ok';           balance: number; premiumUntil: Date | null }
  | { status: 'duplicate';    balance: number }
  | { status: 'already_owned' }
  | { status: 'insufficient'; balance: number }
  | { status: 'user_not_found' }

export const coinsRepository = {
  /** toApiUser enrichment: balans + egalik ro'yxati (2 parallel arzon so'rov). */
  async getEconomyState(userId: string): Promise<{ coins: number; ownedItems: string[] }> {
    const [bal, items] = await Promise.all([
      executeRows<{ balance: number }>(sql`
        SELECT balance::int AS balance FROM user_coins WHERE user_id = ${userId}
      `),
      executeRows<{ item_id: string }>(sql`
        SELECT item_id FROM user_items WHERE user_id = ${userId} ORDER BY acquired_at
      `),
    ])
    return { coins: Number(bal[0]?.balance ?? 0), ownedItems: items.map((r) => r.item_id) }
  },

  /**
   * Buyum sotib olish — BITTA atomik CTE (payment.complete uslubi):
   *  1) dup-guard (purchaseId idempotency — retry ikki marta debit qilmaydi)
   *  2) owned-guard (durable buyum ikki marta olinmaydi)
   *  3) shartli debit (balance >= price — race'da manfiy bo'lmaydi)
   *  4) ledger qaydi
   *  5) grant: durable → user_items; consumable → premium_until GREATEST (C-1: tariff TEGILMAYDI)
   */
  async purchase(userId: string, itemId: string, purchaseId: string): Promise<PurchaseResult> {
    const item = getShopItem(itemId)
    if (!item) return { status: 'user_not_found' }   // router oldin tekshiradi — defense-in-depth
    const durable = isDurableShopItem(item)
    const days = item.days ?? null

    const rows = await executeRows<{
      user_exists: boolean; was_duplicate: boolean; was_owned: boolean
      balance: number | null; current_balance: number | null; premiumUntil: Date | null
    }>(sql`
      WITH price AS (
        SELECT ${item.price}::int AS p, ${durable}::boolean AS dur, ${days}::int AS days
      ), target_user AS (
        SELECT id FROM users WHERE id = ${userId}
      ), dup AS (
        SELECT 1 FROM coin_transactions
        WHERE user_id = ${userId} AND reason = 'purchase' AND ref_id = ${purchaseId}
      ), owned AS (
        SELECT 1 FROM user_items
        WHERE user_id = ${userId} AND item_id = ${item.id}
          AND (SELECT dur FROM price)
      ), debit AS (
        UPDATE user_coins
        SET balance = balance - (SELECT p FROM price),
            updated_at = now()
        WHERE user_id = ${userId}
          AND balance >= (SELECT p FROM price)
          AND EXISTS (SELECT 1 FROM target_user)
          AND NOT EXISTS (SELECT 1 FROM dup)
          AND NOT EXISTS (SELECT 1 FROM owned)
        RETURNING balance
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, -(SELECT p FROM price), 'purchase', ${purchaseId}
        WHERE EXISTS (SELECT 1 FROM debit)
        ON CONFLICT DO NOTHING
        RETURNING id
      ), grant_item AS (
        INSERT INTO user_items (user_id, item_id)
        SELECT ${userId}, ${item.id}
        WHERE (SELECT dur FROM price) AND EXISTS (SELECT 1 FROM debit)
        ON CONFLICT DO NOTHING
        RETURNING item_id
      ), grant_premium AS (
        UPDATE users SET
          premium_until = GREATEST(COALESCE(premium_until, now()), now())
            + make_interval(days => (SELECT days FROM price)),
          updated_at = now()
        WHERE id = ${userId}
          AND NOT (SELECT dur FROM price)
          AND EXISTS (SELECT 1 FROM debit)
        RETURNING premium_until
      )
      SELECT
        EXISTS (SELECT 1 FROM target_user) AS user_exists,
        EXISTS (SELECT 1 FROM dup) AS was_duplicate,
        EXISTS (SELECT 1 FROM owned) AS was_owned,
        (SELECT balance::int FROM debit) AS balance,
        (SELECT balance::int FROM user_coins WHERE user_id = ${userId}) AS current_balance,
        (SELECT premium_until FROM grant_premium) AS "premiumUntil"
    `)

    const row = rows[0]
    if (!row?.user_exists) return { status: 'user_not_found' }
    if (row.was_duplicate) return { status: 'duplicate', balance: Number(row.current_balance ?? 0) }
    if (row.was_owned) return { status: 'already_owned' }
    if (row.balance === null) return { status: 'insufficient', balance: Number(row.current_balance ?? 0) }
    return {
      status: 'ok',
      balance: Number(row.balance),
      premiumUntil: row.premiumUntil ? new Date(row.premiumUntil) : null,
    }
  },

  /**
   * Avatar ramkasini tanlash — FAQAT egalik tekshiruvidan keyin (equip guard).
   * itemId=null — ramkani olib tashlash (har doim ruxsat).
   */
  async equipFrame(userId: string, frameId: string | null): Promise<'ok' | 'not_owned' | 'user_not_found'> {
    if (frameId !== null) {
      const owned = await executeRows<{ item_id: string }>(sql`
        SELECT item_id FROM user_items WHERE user_id = ${userId} AND item_id = ${frameId}
      `)
      if (owned.length === 0) return 'not_owned'
    }
    const rows = await executeRows<{ id: string }>(sql`
      UPDATE users SET avatar_frame = ${frameId}, updated_at = now()
      WHERE id = ${userId}
      RETURNING id
    `)
    return rows.length > 0 ? 'ok' : 'user_not_found'
  },

  /** Oxirgi tranzaksiyalar (Profil/Do'kon "Tarix" ko'rinishi) */
  async getHistory(userId: string, limit = 50): Promise<{ delta: number; reason: string; refId: string; createdAt: Date }[]> {
    const rows = await executeRows<{ delta: number; reason: string; ref_id: string; created_at: string }>(sql`
      SELECT delta::int AS delta, reason, ref_id, created_at
      FROM coin_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${Math.min(Math.max(1, limit), 100)}
    `)
    // neon-http raw SQL: timestamp string qaytadi (Date emas) — normalize
    return rows.map((r) => ({ delta: Number(r.delta), reason: r.reason, refId: r.ref_id, createdAt: new Date(r.created_at) }))
  },

  // ── KUNLIK VAZIFALAR (#40 Faza 2) ──────────────────────────────────────────

  /** Barcha vazifalar + bugungi progress + claim holati (2 arzon arallel so'rov). */
  async getTasksState(userId: string, date: string) {
    const [progressRows, claimedRows] = await Promise.all([
      executeRows<{ answered: number; correct: number; fixed: number }>(sql`
        SELECT
          COALESCE(SUM(answered), 0)::int AS answered,
          COALESCE(SUM(correct), 0)::int  AS correct,
          COALESCE(SUM(fixed), 0)::int    AS fixed
        FROM daily_records
        WHERE user_id = ${userId} AND date = ${date}
      `),
      executeRows<{ ref_id: string }>(sql`
        SELECT ref_id FROM coin_transactions
        WHERE user_id = ${userId} AND reason = 'task_claim'
          AND ref_id LIKE ${'%:' + date}
      `),
    ])
    const p = progressRows[0] ?? { answered: 0, correct: 0, fixed: 0 }
    const claimed = new Set(claimedRows.map((r) => r.ref_id.split(':')[0]))
    return DAILY_TASKS.map((task) => {
      const progress = Number(p[task.metric] ?? 0)
      return {
        id: task.id,
        metric: task.metric,
        target: task.target,
        reward: task.reward,
        progress: Math.min(progress, task.target),   // UI'da 20/20'dan oshib ko'rinmasin
        rawProgress: progress,
        completed: progress >= task.target,
        claimed: claimed.has(task.id),
      }
    })
  },

  /**
   * Mukofotni olish — BITTA atomik CTE:
   *  1) SQL'da progress qayta O'LCHANADI (client raqamiga ishonilmaydi)
   *  2) `ref_id = '<taskId>:<date>'` UNIQUE — bir kunlik bitta claim (retry-safe)
   *  3) award + ledger bir statement'da
   */
  async claimTask(userId: string, taskId: string, date: string): Promise<
    | { status: 'ok'; balance: number; reward: number }
    | { status: 'already_claimed' }
    | { status: 'not_completed'; progress: number }
    | { status: 'unknown_task' | 'user_not_found' }
  > {
    const task = getDailyTask(taskId)
    if (!task) return { status: 'unknown_task' }
    const col = METRIC_COLUMN[task.metric]
    const refId = `${task.id}:${date}`

    const rows = await executeRows<{
      progress: number; was_claimed: boolean; user_exists: boolean
      balance: number | null; current_balance: number | null
    }>(sql`
      WITH target_user AS (
        SELECT id FROM users WHERE id = ${userId}
      ), metric_value AS (
        SELECT COALESCE(SUM(${col}), 0)::int AS v
        FROM daily_records
        WHERE user_id = ${userId} AND date = ${date}
      ), claimed AS (
        SELECT 1 FROM coin_transactions
        WHERE user_id = ${userId} AND reason = 'task_claim' AND ref_id = ${refId}
      ), award AS (
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT ${userId}, ${task.reward}::int, now()
        WHERE EXISTS (SELECT 1 FROM target_user)
          AND (SELECT v FROM metric_value) >= ${task.target}::int
          AND NOT EXISTS (SELECT 1 FROM claimed)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance + ${task.reward}::int,
          updated_at = now()
        RETURNING balance
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${task.reward}, 'task_claim', ${refId}
        WHERE EXISTS (SELECT 1 FROM award)
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        (SELECT v FROM metric_value) AS progress,
        EXISTS (SELECT 1 FROM claimed) AS was_claimed,
        EXISTS (SELECT 1 FROM target_user) AS user_exists,
        (SELECT balance::int FROM award) AS balance,
        (SELECT balance::int FROM user_coins WHERE user_id = ${userId}) AS current_balance
    `)

    const row = rows[0]
    if (!row?.user_exists) return { status: 'user_not_found' }
    if (row.was_claimed) return { status: 'already_claimed' }
    if (row.balance === null) return { status: 'not_completed', progress: Number(row.progress ?? 0) }
    return { status: 'ok', balance: Number(row.balance), reward: task.reward }
  },

  // ── MERCH (#40 Faza 3) — real fizik tovarlar coin'ga ──────────────────────

  /** Katalog + faol zaxira + buying user allaqachon olganmi (ShopPage Merch UI) */
  async getMerchState(userId: string) {
    const [counts, mine] = await Promise.all([
      executeRows<{ item_id: string; used: number }>(sql`
        SELECT item_id, COUNT(*)::int AS used
        FROM merch_orders
        WHERE status <> 'cancelled'
        GROUP BY item_id
      `),
      executeRows<{ item_id: string }>(sql`
        SELECT DISTINCT item_id FROM merch_orders
        WHERE user_id = ${userId} AND status <> 'cancelled'
      `),
    ])
    const usedMap  = new Map(counts.map((r) => [r.item_id, Number(r.used)]))
    const mineSet  = new Set(mine.map((r) => r.item_id))
    return MERCH_ITEMS.map((item) => {
      const used = usedMap.get(item.id) ?? 0
      return {
        id: item.id,
        price: item.price,
        remaining: Math.max(0, item.stock - used),
        alreadyOwned: mineSet.has(item.id),
      }
    })
  },

  /**
   * Merch buyurtma — BITTA atomik CTE:
   *  1) dup-guard (purchaseId idempotency)
   *  2) stock-guard: faol (cancelled bo'lmagan) buyurtmalar < stock
   *  3) 1-per-user guard: user'da shu item'dan faol buyurtma YO'Q bo'lsin
   *  4) shartli debit (balance >= price) → order insert → ledger
   */
  async buyMerch(userId: string, itemId: string, purchaseId: string, info: { fullName: string; phone: string; note: string | null }): Promise<
    | { status: 'ok'; orderId: number; balance: number }
    | { status: 'duplicate'; balance: number }
    | { status: 'sold_out' }
    | { status: 'already_owned' }
    | { status: 'insufficient'; balance: number }
    | { status: 'user_not_found' | 'unknown_item' }
  > {
    const item = getMerchItem(itemId)
    if (!item) return { status: 'unknown_item' }

    const rows = await executeRows<{
      user_exists: boolean; was_duplicate: boolean; already_owned: boolean
      sold_out: boolean; balance: number | null; current_balance: number | null; order_id: number | null
    }>(sql`
      WITH target_user AS (
        SELECT id FROM users WHERE id = ${userId}
      ), dup AS (
        SELECT 1 FROM coin_transactions
        WHERE user_id = ${userId} AND reason = 'merch' AND ref_id = ${purchaseId}
      ), mine AS (
        SELECT 1 FROM merch_orders
        WHERE user_id = ${userId} AND item_id = ${item.id} AND status <> 'cancelled'
      ), stock_ok AS (
        SELECT (COUNT(*)::int < ${item.stock}) AS ok
        FROM merch_orders
        WHERE item_id = ${item.id} AND status <> 'cancelled'
      ), debit AS (
        UPDATE user_coins
        SET balance = balance - ${item.price}::int,
            updated_at = now()
        WHERE user_id = ${userId}
          AND balance >= ${item.price}::int
          AND EXISTS (SELECT 1 FROM target_user)
          AND NOT EXISTS (SELECT 1 FROM dup)
          AND NOT EXISTS (SELECT 1 FROM mine)
          AND (SELECT ok FROM stock_ok)
        RETURNING balance
      ), ord AS (
        INSERT INTO merch_orders (user_id, item_id, full_name, phone, note, price_paid)
        SELECT ${userId}, ${item.id}, ${info.fullName}, ${info.phone}, ${info.note}, ${item.price}
        WHERE EXISTS (SELECT 1 FROM debit)
        RETURNING id
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${userId}, ${-item.price}, 'merch', ${purchaseId}
        WHERE EXISTS (SELECT 1 FROM debit)
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM target_user) AS user_exists,
        EXISTS (SELECT 1 FROM dup) AS was_duplicate,
        EXISTS (SELECT 1 FROM mine) AS already_owned,
        NOT (SELECT ok FROM stock_ok) AS sold_out,
        (SELECT balance::int FROM debit) AS balance,
        (SELECT balance::int FROM user_coins WHERE user_id = ${userId}) AS current_balance,
        (SELECT id::int FROM ord) AS order_id
    `)

    const row = rows[0]
    if (!row?.user_exists) return { status: 'user_not_found' }
    if (row.was_duplicate) return { status: 'duplicate', balance: Number(row.current_balance ?? 0) }
    if (row.already_owned) return { status: 'already_owned' }
    if (row.sold_out) return { status: 'sold_out' }
    if (row.balance === null) return { status: 'insufficient', balance: Number(row.current_balance ?? 0) }
    return { status: 'ok', orderId: Number(row.order_id), balance: Number(row.balance) }
  },

  /** Foydalanuvchining o'z buyurtmalari (Profil/kelajak UI) */
  async listMyMerchOrders(userId: string) {
    return executeRows<{
      id: number; item_id: string; price_paid: number; status: string; created_at: string
    }>(sql`
      SELECT id::int AS id, item_id, price_paid::int AS price_paid, status, created_at
      FROM merch_orders
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `)
  },

  /** ADMIN: barcha buyurtmalar (user ismi bilan) */
  async listMerchOrders(status?: string) {
    const rows = await executeRows<{
      id: number; user_id: string; first_name: string; item_id: string
      full_name: string; phone: string; note: string | null
      price_paid: number; status: string; created_at: string
    }>(sql`
      SELECT o.id::int AS id, o.user_id, u.first_name, o.item_id,
             o.full_name, o.phone, o.note,
             o.price_paid::int AS price_paid, o.status, o.created_at
      FROM merch_orders o
      JOIN users u ON u.id = o.user_id
      ${status ? sql`WHERE o.status = ${status}` : sql``}
      ORDER BY o.created_at DESC
      LIMIT 200
    `)
    return rows
  },

  /** ADMIN: status yangilash (delivered/contacted — pul qaytarishsiz) */
  async updateMerchOrderStatus(orderId: number, status: 'contacted' | 'delivered'): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      UPDATE merch_orders SET status = ${status}, updated_at = now()
      WHERE id = ${orderId} AND status NOT IN ('cancelled', 'delivered')
      RETURNING id
    `)
    return rows.length > 0
  },

  /**
   * ADMIN: buyurtmani bekor qilish — ATOMIK refund CTE:
   *  - delivered/cancelled qayta o'zgarmaydi (bir yo'nalishli holat oqimi)
   *  - refund = price_paid SNAPSHOT (katalog narxi o'zgargan bo'lsa ham)
   *  - ledger ref `order:<id>` UNIQUE — ikki marta refund imkonsiz
   */
  async cancelMerchOrder(orderId: number): Promise<'ok' | 'not_found' | 'not_cancellable'> {
    const rows = await executeRows<{ balance: number | null; user_id: string | null }>(sql`
      WITH upd AS (
        UPDATE merch_orders SET status = 'cancelled', updated_at = now()
        WHERE id = ${orderId} AND status NOT IN ('cancelled', 'delivered')
        RETURNING id, user_id, price_paid
      ), credit AS (
        UPDATE user_coins SET balance = balance + (SELECT price_paid FROM upd), updated_at = now()
        WHERE user_id = (SELECT user_id FROM upd)
          AND EXISTS (SELECT 1 FROM upd)
        RETURNING user_id, balance
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT (SELECT user_id FROM upd), (SELECT price_paid FROM upd), 'merch_refund', ${`order:${orderId}`}
        WHERE EXISTS (SELECT 1 FROM credit)
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT (SELECT balance::int FROM credit) AS balance, (SELECT user_id FROM credit) AS user_id
    `)
    const changed = rows[0]?.user_id != null
    if (changed) return 'ok'
    // not_found vs not_cancellable farqi:
    const exists = await executeRows<{ status: string }>(sql`
      SELECT status FROM merch_orders WHERE id = ${orderId}
    `)
    return exists.length === 0 ? 'not_found' : 'not_cancellable'
  },
}
