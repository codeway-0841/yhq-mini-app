/**
 * Daily Challenge router.
 *
 * GET  /api/daily/:userId?date=YYYY-MM-DD&subject=yhq  → bugungi holat + streak
 * GET  /api/daily/:userId/history?date=...&subject=yhq → barcha kunlar + joriy/best streak
 * POST /api/daily/:userId/fix                          → xato tuzatildi (+1), {date, subjectId}
 * POST /api/daily/:userId/activity                     → kunlik faollik (1 savol yoki dars) → streak
 */

import { Router }             from 'express'
import { z }                  from 'zod'
import { wrap, AppError }     from '../../middleware/error-handler'
import { validate }           from '../../middleware/validate'
import { parseUserId }        from '../../utils/parse'
import { rateLimit }          from '../../middleware/rate-limiter'
import { requireSelf }        from '../../middleware/auth'
import { isCalendarDate, tashkentDate } from '../../utils/date'
import { progressRepository } from '../progress/progress.repository'
import { dailyRepository }    from './daily.repository'
import { SUBJECT_IDS }        from '../../config/subjects'

const router = Router()

// Har bir daily endpoint faqat initData bilan tasdiqlangan egasiga tegishli.
router.use('/daily/:userId', requireSelf)


// GET /api/daily/:userId — bugungi kunlik holat (record yo'q bo'lsa null) + streak
router.get(
  '/daily/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const date    = typeof req.query['date'] === 'string' ? req.query['date'] : ''
    const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : ''
    if (!isCalendarDate(date)) throw new AppError(400, 'Invalid date (YYYY-MM-DD expected)')
    if (!SUBJECT_IDS.includes(subject)) throw new AppError(400, 'Invalid subject')

    const data = await dailyRepository.getToday(uid, date, subject)
    res.json(data)
  }),
)

// GET /api/daily/:userId/history — shu fanga tegishli barcha kunlik yozuvlar +
// joriy streak (kun o'tkazilsa 0) + eng yaxshi seriya ("Intizom" sahifasi)
router.get(
  '/daily/:userId/history',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const date    = typeof req.query['date'] === 'string' ? req.query['date'] : ''
    const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : ''
    if (!isCalendarDate(date)) throw new AppError(400, 'Invalid date (YYYY-MM-DD expected)')
    if (!SUBJECT_IDS.includes(subject)) throw new AppError(400, 'Invalid subject')

    const data = await dailyRepository.getHistory(uid, date, subject)
    res.json(data)
  }),
)

const FixSchema = z.object({
  subjectId: z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
})

// POST /api/daily/:userId/fix — legacy compatibility.
// Verified fixed counter faqat progressRepository.recordAnswer ichida, server
// javobni tekshirganidan keyin oshadi. Bu endpoint eski outbox/clientlarga ok
// qaytaradi, lekin ishonchsiz client signalidan progress yozmaydi.
router.post(
  '/daily/:userId/fix',
  rateLimit({ maxPerMinute: 120 }),
  validate({ body: FixSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.ensureExists(uid)

    void (req.body as z.infer<typeof FixSchema>).subjectId

    res.json({ ok: true })
  }),
)

const ActivitySchema = z.object({
  subjectId: z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
})

// POST /api/daily/:userId/activity
// Kunlik sof faollik (masalan dars) — savol natijalari progress routerda
// server tekshirgan javob asosida hisoblanadi.
router.post(
  '/daily/:userId/activity',
  rateLimit({ maxPerMinute: 300 }),
  validate({ body: ActivitySchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.ensureExists(uid)

    const { subjectId } = req.body as z.infer<typeof ActivitySchema>
    const { dailyStreak, coinSaved } = await dailyRepository.touchActivity(uid, tashkentDate(), subjectId, 0, 0)

    // coinSaved: uzilgan seriya coin evaziga saqlandi — client toast ko'rsatadi.
    res.json({ ok: true, dailyStreak, coinSaved })
  }),
)

export default router
