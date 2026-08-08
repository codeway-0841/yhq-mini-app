/**
 * Analytics router — KPI event qabul qilish (1 haftalik sinov).
 * userId faqat VERIFIED telegram id'dan olinadi (auth middleware o'rnatadi) —
 * client-supplied userId ishonchilmaydi.
 */
import { Router } from 'express'
import { z } from 'zod'
import { wrap } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { rateLimit } from '../../middleware/rate-limiter'
import { db } from '../../db/connection'
import { analyticsEvents } from '../../schema'
import { parseUserId } from '../../utils/parse'

const router = Router()

const EventSchema = z.object({
  event: z.string().min(1).max(64).regex(/^[a-z_]+$/, 'snake_case event'),
  props: z.record(z.string(), z.unknown()).optional().default({}),
})

// POST /api/analytics — rate limited, prod'da auth (dev'da ochiq)
router.post(
  '/analytics',
  rateLimit({ maxPerMinute: 60 }),
  validate({ body: EventSchema }),
  wrap(async (req, res) => {
    const { event, props } = req.body as z.infer<typeof EventSchema>
    const telegramId = (req as { telegramUserId?: string }).telegramUserId
    const uid = telegramId ? parseUserId(telegramId) : null
    await db.insert(analyticsEvents).values({ userId: uid ?? null, event, props })
    res.status(204).end()
  }),
)

export default router
