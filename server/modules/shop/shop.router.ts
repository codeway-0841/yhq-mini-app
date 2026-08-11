import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { parseUserId } from '../../utils/parse'
import { requireSelf } from '../../middleware/auth'
import { shopRepository } from './shop.repository'

const router = Router()

router.use('/shop/:userId', requireSelf)
router.use('/shop/:userId/*', requireSelf)

const ItemTypeSchema = z.enum(['avatar', 'merch', 'badge'])

// GET /api/shop/:userId/balance
router.get(
  '/shop/:userId/balance',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const balance = await shopRepository.getBalance(uid)
    res.json({ balance })
  }),
)

// GET /api/shop/:userId/overview — full shop state for initial load
router.get(
  '/shop/:userId/overview',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const [balance, purchases, dailyStatus, tasks, taskProgress] = await Promise.all([
      shopRepository.getBalance(uid),
      shopRepository.getUserPurchases(uid),
      shopRepository.getDailyRewardStatus(uid),
      shopRepository.getTasks(),
      shopRepository.getUserTaskProgress(uid),
    ])

    res.json({ balance, purchases, dailyStatus, tasks, taskProgress })
  }),
)

// GET /api/shop/items?type=avatar&category=all
router.get(
  '/shop/items',
  validate({ query: z.object({ type: ItemTypeSchema, category: z.string().optional() }) }),
  wrap(async (req, res) => {
    const { type, category } = req.query as { type: string; category?: string }
    const items = await shopRepository.getItems(type, category)
    res.json({ items })
  }),
)

// POST /api/shop/:userId/purchase
router.post(
  '/shop/:userId/purchase',
  validate({ body: z.object({ itemId: z.string().min(1) }) }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const { itemId } = req.body as { itemId: string }
    const result = await shopRepository.purchaseItem(uid, itemId)
    res.json(result)
  }),
)

// POST /api/shop/:userId/daily-claim
router.post(
  '/shop/:userId/daily-claim',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const result = await shopRepository.claimDailyReward(uid)
    res.json(result)
  }),
)

// GET /api/shop/:userId/history
router.get(
  '/shop/:userId/history',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const history = await shopRepository.getTransactionHistory(uid)
    res.json({ history })
  }),
)

export default router
