/**
 * Analytics router — KPI event qabul qilish.
 * userId faqat VERIFIED id'dan olinadi (auth middleware o'rnatadi —
 * initData YOKI Bearer session) — client-supplied userId ishonchilmaydi.
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
// M-8 (audit): multi-instance umumiy limiter (prod'da Neon counter) — in-memory
// per-instance limiter Vercel'da N replica × limit bergan edi.
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { analyticsRepository } from './analytics.repository'
import { parseUserId } from '../../utils/parse'

const router = Router()

const EventSchema = z.object({
  event: z.string().min(1).max(64).regex(/^[a-z_]+$/, 'snake_case event'),
  props: z.record(z.string(), z.unknown()).optional().default({}).refine(
    (p) => JSON.stringify(p).length <= 4096,
    { message: 'props payload too large (max 4KB)' }
  ),
})

// POST /api/analytics — rate limited (prod'da DB counter), prod'da auth (dev'da ochiq)
router.post(
  '/analytics',
  rateLimit({ maxPerMinute: 60, bucket: 'analytics' }),
  validate({ body: EventSchema }),
  wrap(async (req, res) => {
    const { event, props } = req.body as z.infer<typeof EventSchema>
    const authUserId = (req as { userId?: string }).userId
    const uid = authUserId ? parseUserId(authUserId) : null
    await analyticsRepository.insertEvent(uid ?? null, event, props)
    res.status(204).end()
  }),
)

export default router
