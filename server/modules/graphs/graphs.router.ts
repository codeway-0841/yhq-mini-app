/**
 * Grafik quruvchi router — saqlash/ulashish (matematika serverda hisoblanmaydi).
 *
 * Auth: barcha yo'llar `requireAuth` (mehmon rejim yo'q). Egasi `req.userId`dan
 * olinadi — shuning uchun `USER_SEGMENTS`/`PUBLIC_GET` allowlist'larga
 * TEGILMAYDI (anti-spoof va allowlist desync xatari yo'q).
 * Share kod — capability: login qilgan har qanday user kod orqali ko'ra oladi.
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit } from '../../middleware/db-rate-limiter'
import { identityKey } from '../../middleware/rate-limiter'
import { requireAuth } from '../../middleware/auth'
import { SavedGraphInputSchema, SavedGraphUpdateSchema } from '../../../shared/contracts/graph'
import { graphsRepository } from './graphs.repository'

const router = Router()

router.use('/graphs', requireAuth)

function userIdFrom(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') throw new AppError(401, 'AUTH_REQUIRED')
  return userId
}

const listLimiter      = dbRateLimit({ maxPerMinute: 60, bucket: 'graphs:list', keyFn: identityKey })
const createLimiter    = dbRateLimit({ maxPerMinute: 10, bucket: 'graphs:create', keyFn: identityKey })
const updateLimiter    = dbRateLimit({ maxPerMinute: 20, bucket: 'graphs:update', keyFn: identityKey })
const shareLimiter     = dbRateLimit({ maxPerMinute: 10, bucket: 'graphs:share', keyFn: identityKey })
const shareReadLimiter = dbRateLimit({ maxPerMinute: 30, bucket: 'graphs:share-read', keyFn: identityKey })

const IdParamSchema = z.object({ id: z.string().uuid() })
const ShareParamSchema = z.object({ code: z.string().min(6).max(32).regex(/^[A-Za-z0-9_-]+$/) })

// GET /api/graphs — o'z grafiklari (yengil ro'yxat)
router.get(
  '/graphs',
  listLimiter,
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    res.json({ ok: true, graphs: await graphsRepository.list(userId) })
  }),
)

// GET /api/graphs/share/:code — share kod orqali (login shart)
router.get(
  '/graphs/share/:code',
  shareReadLimiter,
  validate({ params: ShareParamSchema }),
  wrap(async (req, res) => {
    const code = req.params['code'] as string
    const graph = await graphsRepository.getByShareCode(code)
    if (!graph) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.json({ ok: true, graph })
  }),
)

// POST /api/graphs — yangi saqlash (limit 20, atomik)
router.post(
  '/graphs',
  createLimiter,
  validate({ body: SavedGraphInputSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const { title, payload } = req.body as z.infer<typeof SavedGraphInputSchema>
    const graph = await graphsRepository.create(userId, title, payload)
    if (!graph) throw new AppError(409, 'GRAPH_LIMIT_REACHED')
    res.status(201).json({ ok: true, graph })
  }),
)

// GET /api/graphs/:id — to'liq workspace
router.get(
  '/graphs/:id',
  listLimiter,
  validate({ params: IdParamSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const graph = await graphsRepository.get(userId, req.params['id'] as string)
    if (!graph) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.json({ ok: true, graph })
  }),
)

// PATCH /api/graphs/:id
router.patch(
  '/graphs/:id',
  updateLimiter,
  validate({ params: IdParamSchema, body: SavedGraphUpdateSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const patch = req.body as z.infer<typeof SavedGraphUpdateSchema>
    const graph = await graphsRepository.update(userId, req.params['id'] as string, patch)
    if (!graph) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.json({ ok: true, graph })
  }),
)

// DELETE /api/graphs/:id
router.delete(
  '/graphs/:id',
  updateLimiter,
  validate({ params: IdParamSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const removed = await graphsRepository.remove(userId, req.params['id'] as string)
    if (!removed) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.status(204).send()
  }),
)

// POST /api/graphs/:id/share — idempotent share kod
router.post(
  '/graphs/:id/share',
  shareLimiter,
  validate({ params: IdParamSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const shareCode = await graphsRepository.mintShareCode(userId, req.params['id'] as string)
    if (!shareCode) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.json({ ok: true, shareCode })
  }),
)

// DELETE /api/graphs/:id/share — kodni bekor qilish
router.delete(
  '/graphs/:id/share',
  shareLimiter,
  validate({ params: IdParamSchema }),
  wrap(async (req, res) => {
    const userId = userIdFrom(req)
    const revoked = await graphsRepository.revokeShareCode(userId, req.params['id'] as string)
    if (!revoked) throw new AppError(404, 'GRAPH_NOT_FOUND')
    res.json({ ok: true })
  }),
)

export default router
