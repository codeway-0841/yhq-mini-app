/**
 * Daily Challenge router.
 *
 * GET  /api/daily/:userId?date=YYYY-MM-DD&subject=yhq  → bugungi holat + streak
 * GET  /api/daily/:userId/history?date=...&subject=yhq → barcha kunlar + joriy/best streak
 * POST /api/daily/:userId/complete                     → {date, subjectId, answered, correct}
 * POST /api/daily/:userId/fix                          → xato tuzatildi (+1), {date, subjectId}
 * POST /api/daily/:userId/activity                     → kunlik faollik (1 savol yoki dars) → streak
 */

import { Router }             from 'express'
import { z }                  from 'zod'
import { wrap, AppError }     from '../../middleware/error-handler'
import { validate }           from '../../middleware/validate'
import { parseBigInt }        from '../../utils/parse'
import { rateLimit }          from '../../middleware/rate-limiter'
import { progressRepository } from '../progress/progress.repository'
import { dailyRepository }    from './daily.repository'

const router = Router()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/daily/:userId — bugungi kunlik holat (record yo'q bo'lsa null) + streak
router.get(
  '/daily/:userId',
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const date    = typeof req.query['date'] === 'string' ? req.query['date'] : ''
    const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : ''
    if (!DATE_RE.test(date))    throw new AppError(400, 'Invalid date (YYYY-MM-DD expected)')
    if (!subject || subject.length > 32) throw new AppError(400, 'Invalid subject')

    const data = await dailyRepository.getToday(uid, date, subject)
    res.json(data)
  }),
)

// GET /api/daily/:userId/history — shu fanga tegishli barcha kunlik yozuvlar +
// joriy streak (kun o'tkazilsa 0) + eng yaxshi seriya ("Intizom" sahifasi)
router.get(
  '/daily/:userId/history',
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const date    = typeof req.query['date'] === 'string' ? req.query['date'] : ''
    const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : ''
    if (!DATE_RE.test(date))    throw new AppError(400, 'Invalid date (YYYY-MM-DD expected)')
    if (!subject || subject.length > 32) throw new AppError(400, 'Invalid subject')

    const data = await dailyRepository.getHistory(uid, date, subject)
    res.json(data)
  }),
)

const CompleteSchema = z.object({
  date:      z.string().regex(DATE_RE),
  subjectId: z.string().min(1).max(32),
  answered:  z.number().int().min(1).max(100),
  correct:   z.number().int().min(0).max(100),
})

// POST /api/daily/:userId/complete
router.post(
  '/daily/:userId/complete',
  rateLimit({ maxPerMinute: 30 }),
  validate({ body: CompleteSchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    // Progress qatori bo'lmasa (init o'tmagan holat) yaratamiz — FK xatosini oldini oladi
    await progressRepository.ensureExists(uid)

    const { date, subjectId, answered, correct } = req.body as z.infer<typeof CompleteSchema>
    const { dailyStreak } = await dailyRepository.complete(uid, date, subjectId, answered, correct)

    res.json({ ok: true, dailyStreak })
  }),
)

const FixSchema = z.object({
  date:      z.string().regex(DATE_RE),
  subjectId: z.string().min(1).max(32),
  count:     z.number().int().min(1).max(100).default(1),
})

// POST /api/daily/:userId/fix — eski xato to'g'rilandi, shu kunga fixed qo'shish
router.post(
  '/daily/:userId/fix',
  rateLimit({ maxPerMinute: 120 }),
  validate({ body: FixSchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.ensureExists(uid)

    const { date, subjectId } = req.body as z.infer<typeof FixSchema>
    await dailyRepository.addFixed(uid, date, subjectId)

    res.json({ ok: true })
  }),
)

const ActivitySchema = z.object({
  date:      z.string().regex(DATE_RE),
  subjectId: z.string().min(1).max(32),
  /** Shu chaqiruvdagi savol delta'lari (0 = sof faollik, masalan dars) */
  answered:  z.number().int().min(0).max(100).default(0),
  correct:   z.number().int().min(0).max(100).default(0),
})

// POST /api/daily/:userId/activity
// Kunlik faollik: kamida 1 savol YOKI dars — streak shu bilan yoziladi.
// Har javob answered/correct delta sifatida qo'shiladi (kunlik JAMI — heat map).
router.post(
  '/daily/:userId/activity',
  rateLimit({ maxPerMinute: 300 }),
  validate({ body: ActivitySchema }),
  wrap(async (req, res) => {
    const uid = parseBigInt(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.ensureExists(uid)

    const { date, subjectId, answered, correct } = req.body as z.infer<typeof ActivitySchema>
    const { dailyStreak } = await dailyRepository.touchActivity(uid, date, subjectId, answered, correct)

    res.json({ ok: true, dailyStreak })
  }),
)

export default router
