/**
 * Coins router — do'kon xaridlari va ramka tanlash (FIXPLAN #40).
 *
 * Trust boundary (promo kabi): userId FAQAT telegramAuth middleware'dan
 * (initData YOKI Bearer) — client yuborgan userId'ga UMUMAN ishonmaymiz.
 * Narx/buyum config: shared/shop-items.ts (server SSOT; client narxi ekranda
 * ko'rsatadi, lekin debit SERVER'dagi narx bo'yicha).
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { requireAdmin } from '../../middleware/admin'
import { getShopItem, isDurableShopItem } from '../../../shared/shop-items'
import { getMerchItem } from '../../../shared/merch-items'
import { getDailyTask } from '../../../shared/daily-tasks'
import { tashkentDate } from '../../utils/date'
import { coinsRepository } from './coins.repository'

const router = Router()

const PurchaseBodySchema = z.object({
  itemId:     z.string().min(1).max(64),
  /** Idempotency: client har URINISH uchun yangi UUID yaratadi — retry-proof. */
  purchaseId: z.string().min(8).max(64),
})

const EquipBodySchema = z.object({
  /** null — ramkani olib tashlash */
  itemId: z.string().min(1).max(64).nullable(),
})

// Xarid brute-force/spam himoyasi (promo kabi): user boshiga 10/min.
// Per-ENDPOINT bucket'lar: ramka tanlash xarid byudjetini yeb qo'ymasligi uchun
const mkLimiter = (bucket: string) => rateLimit({
  maxPerMinute: 10,
  bucket,
  keyFn: (req) => (req as { userId?: string }).userId ?? req.ip ?? 'unknown',
})
const purchaseLimiter = mkLimiter('coins:purchase')
const equipLimiter    = mkLimiter('coins:equip')
const claimLimiter    = mkLimiter('coins:claim')
const merchLimiter    = mkLimiter('coins:merch')

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') {
    throw new AppError(401, 'AUTH_REQUIRED')
  }
  return userId
}

// POST /api/coins/purchase
router.post(
  '/coins/purchase',
  purchaseLimiter,
  validate({ body: PurchaseBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { itemId, purchaseId } = req.body as z.infer<typeof PurchaseBodySchema>

    const item = getShopItem(itemId)
    if (!item) throw new AppError(404, 'ITEM_NOT_FOUND')
    if (item.kind === 'premium-days' && !item.days) {
      throw new AppError(500, 'ITEM_CONFIG_INVALID')
    }

    const result = await coinsRepository.purchase(userId, itemId, purchaseId)

    switch (result.status) {
      case 'user_not_found':
        throw new AppError(404, 'USER_NOT_FOUND')
      case 'already_owned':
        throw new AppError(409, 'ITEM_ALREADY_OWNED')
      case 'insufficient':
        throw new AppError(409, 'COINS_INSUFFICIENT')
      case 'duplicate':
        // Retry (double-tap / tarmoq qayta yuboruvi) — idempotent muvaffaqiyat
        res.json({ ok: true, duplicate: true, balance: result.balance, premiumUntil: null })
        return
      case 'ok':
        res.json({
          ok: true,
          duplicate: false,
          balance: result.balance,
          premiumUntil: result.premiumUntil?.toISOString() ?? null,
          durable: isDurableShopItem(item),
        })
        return
    }
  }),
)

// POST /api/coins/equip — avatar ramkasini tanlash/olib tashlash
router.post(
  '/coins/equip',
  equipLimiter,
  validate({ body: EquipBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { itemId } = req.body as z.infer<typeof EquipBodySchema>

    if (itemId !== null) {
      const item = getShopItem(itemId)
      if (!item || item.kind !== 'avatar-frame') {
        throw new AppError(404, 'FRAME_NOT_FOUND')
      }
    }
    const result = await coinsRepository.equipFrame(userId, itemId)
    if (result === 'not_owned') {
      throw new AppError(403, 'ITEM_NOT_OWNED')
    }
    if (result === 'user_not_found') {
      throw new AppError(404, 'USER_NOT_FOUND')
    }
    res.json({ ok: true, avatarFrame: itemId })
  }),
)

// GET /api/coins/history — oxirgi tangalar harakati (50 tagacha)
router.get(
  '/coins/history',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const rows = await coinsRepository.getHistory(userId, 50)
    res.json({
      ok: true,
      rows: rows.map((r) => ({
        delta: r.delta,
        reason: r.reason,
        refId: r.refId,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  }),
)

// ── KUNLIK VAZIFALAR (#40 Faza 2) ────────────────────────────────────────────

const ClaimBodySchema = z.object({
  taskId: z.string().min(1).max(64),
})

/** Kunlik vazifa sanasi — SERVER'da (Toshkent) hisoblanadi; client sanasiga
 *  ishonilmaydi (ertalab/kechki foydalanuvchi vaqt zonasi uddalamaydi). */

// GET /api/coins/tasks — bugungi vazifalar + progress + claim holati
router.get(
  '/coins/tasks',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const date = tashkentDate()
    const tasks = await coinsRepository.getTasksState(userId, date)
    res.json({ ok: true, date, tasks })
  }),
)

// POST /api/coins/claim-task — bajarilgan vazifa mukofotini olish (atomik, 1/kun)
router.post(
  '/coins/claim-task',
  claimLimiter,
  validate({ body: ClaimBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const { taskId } = req.body as z.infer<typeof ClaimBodySchema>
    if (!getDailyTask(taskId)) throw new AppError(404, 'TASK_NOT_FOUND')

    const result = await coinsRepository.claimTask(userId, taskId, tashkentDate())
    switch (result.status) {
      case 'unknown_task':
        throw new AppError(404, 'TASK_NOT_FOUND')
      case 'user_not_found':
        throw new AppError(404, 'USER_NOT_FOUND')
      case 'already_claimed':
        throw new AppError(409, 'TASK_ALREADY_CLAIMED')
      case 'not_completed':
        throw new AppError(409, 'TASK_NOT_COMPLETED')
      case 'ok':
        res.json({ ok: true, balance: result.balance, reward: result.reward })
        return
    }
  }),
)

// ── MERCH (#40 Faza 3) — real fizik tovarlar coin'ga ────────────────────────

const BuyMerchBodySchema = z.object({
  itemId:     z.string().min(1).max(64),
  purchaseId: z.string().min(8).max(64),
  fullName:   z.string().trim().min(2).max(80),
  /** E.164 yoki +998 xx xxx-xx-xx shakli — bo'shliq/dash tolerant */
  phone:      z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/, 'Telefon raqam noto\'g\'ri'),
  note:       z.string().trim().max(200).optional().nullable(),
})

// GET /api/coins/merch — katalog + qolgan zaxira + user holati
router.get(
  '/coins/merch',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const items = await coinsRepository.getMerchState(userId)
    res.json({ ok: true, items })
  }),
)

// POST /api/coins/buy-merch — buyurtma yaratish (debit atomik + stock + 1-per-user)
router.post(
  '/coins/buy-merch',
  merchLimiter,
  validate({ body: BuyMerchBodySchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const body = req.body as z.infer<typeof BuyMerchBodySchema>
    if (!getMerchItem(body.itemId)) throw new AppError(404, 'MERCH_NOT_FOUND')

    const result = await coinsRepository.buyMerch(userId, body.itemId, body.purchaseId, {
      fullName: body.fullName,
      phone:    body.phone,
      note:     body.note ?? null,
    })
    switch (result.status) {
      case 'user_not_found':
        throw new AppError(404, 'USER_NOT_FOUND')
      case 'unknown_item':
        throw new AppError(404, 'MERCH_NOT_FOUND')
      case 'already_owned':
        throw new AppError(409, 'MERCH_ALREADY_OWNED')
      case 'sold_out':
        throw new AppError(409, 'MERCH_SOLD_OUT')
      case 'insufficient':
        throw new AppError(409, 'COINS_INSUFFICIENT')
      case 'duplicate':
        res.json({ ok: true, duplicate: true, orderId: null, balance: result.balance })
        return
      case 'ok':
        res.json({ ok: true, duplicate: false, orderId: result.orderId, balance: result.balance })
        return
    }
  }),
)

// GET /api/coins/merch-orders — mening buyurtmalarim (client kontrakti: camelCase)
router.get(
  '/coins/merch-orders',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const rows = await coinsRepository.listMyMerchOrders(userId)
    res.json({
      ok: true,
      rows: rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        pricePaid: r.price_paid,
        status: r.status,
        createdAt: r.created_at,
      })),
    })
  }),
)

// ── Admin: buyurtmalar boshqaruvi ────────────────────────────────────────────

const ListOrdersQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'delivered', 'cancelled']).optional(),
})

// GET /api/admin/merch-orders?status=
router.get(
  '/admin/merch-orders',
  requireAdmin,
  validate({ query: ListOrdersQuerySchema }),
  wrap(async (req, res) => {
    const { status } = req.query as z.infer<typeof ListOrdersQuerySchema>
    const rows = await coinsRepository.listMerchOrders(status)
    res.json({ ok: true, rows })
  }),
)

const OrderStatusBodySchema = z.object({
  status: z.enum(['contacted', 'delivered']),
})

// PATCH /api/admin/merch-orders/:id/status  (contacted|delivered — refund'siz)
router.patch(
  '/admin/merch-orders/:id/status',
  requireAdmin,
  validate({ body: OrderStatusBodySchema }),
  wrap(async (req, res) => {
    const id = Number(req.params['id'])
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'INVALID_ORDER_ID')
    const { status } = req.body as z.infer<typeof OrderStatusBodySchema>
    const ok = await coinsRepository.updateMerchOrderStatus(id, status)
    if (!ok) throw new AppError(409, 'ORDER_NOT_UPDATABLE')
    res.json({ ok: true, id, status })
  }),
)

// POST /api/admin/merch-orders/:id/cancel — bekor qilish + ATOMIK coin refund
router.post(
  '/admin/merch-orders/:id/cancel',
  requireAdmin,
  wrap(async (req, res) => {
    const id = Number(req.params['id'])
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'INVALID_ORDER_ID')
    const result = await coinsRepository.cancelMerchOrder(id)
    if (result === 'not_found') throw new AppError(404, 'ORDER_NOT_FOUND')
    if (result === 'not_cancellable') throw new AppError(409, 'ORDER_NOT_CANCELLABLE')
    res.json({ ok: true, id, status: 'cancelled' })
  }),
)

export default router
