/**
 * Progress router.
 */

import { Router }               from 'express'
import { z }                    from 'zod'
import { wrap, AppError }       from '../../middleware/error-handler'
import { validate }             from '../../middleware/validate'
import { requireSelf }          from '../../middleware/auth'
import { parseUserId }          from '../../utils/parse'
// Multi-instance umumiy limiter (prod'da Neon DB counter, test/dev'da in-memory)
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { progressRepository }   from './progress.repository'
import { bossRepository }       from '../boss/boss.repository'
import { bossPeriodKey, BOSS_DAMAGE_PER_CORRECT } from '../../../shared/boss-battle'
import { Sentry }               from '../../utils/sentry'
import { SUBJECT_IDS, resolveSubject } from '../../config/subjects'
import { getProvider }          from '../../providers'
import { tashkentDate }         from '../../utils/date'
import { config }               from '../../config'

const router = Router()

const MistakesOverviewQuery = z.object({
  subjectId: z.string().min(1).max(32),
  language: z.enum(['uz', 'ru']).default('uz'),
})

router.get(
  '/progress/mistakes/overview',
  wrap(async (req, res) => {
    const userId = (req as { userId?: string }).userId
    if (!userId || userId === '0') {
      res.status(401).json({ error: 'authentication_required' })
      return
    }
    const parsed = MistakesOverviewQuery.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
      return
    }
    const { subjectId, language } = parsed.data
    const subject = resolveSubject(subjectId)
    // FAIL-CLOSED: Top-10 launch token'lar proof secret bilan imzolanadi.
    // Statik fallback string bilan imzolash token forge yo'lini ochardi
    // (source ochiq — har kim o'z userId'siga istalgan questionId uchun
    // token yasay olardi). Secret bo'lmasa 503 (question-bank-protection v2).
    const secret = config.testSessions.proofSecret
    if (!secret) throw new AppError(503, 'test_sessions_unavailable')
    const overview = await progressRepository.getMistakesOverview(
      userId,
      subject.id,
      subject.dataSourceId,
      secret,
      language,
    )
    res.set('Cache-Control', 'private, no-store')
    res.json(overview)
  }),
)

// Route-level guard (audit #17): global telegramAuth USER_SEGMENTS tekshiruvi
// bilan bir xil natija, lekin daily/achievements'dagi patternga mos —
// explicit, global allowlist'ga tayanmaydi.
router.use('/progress/:userId', requireSelf)

const ResultSchema = z.object({
  questionId:     z.number().int().positive(),
  selectedAnswer: z.string().min(1).max(32).nullable(),
  subjectId:      z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
  /** Offline outbox idempotency: har mantiqiy javob uchun 1 UUID.
   *  Replay shu token bilan keladi — counterlar FAQAT 1 marta yoziladi. */
  clientToken:    z.string().min(8).max(64).optional(),
  /** Savol ko'rsatilgandan javobgacha ketgan vaqt (ms) — qiyinlikni
   *  ma'lumotdan chiqarish uchun yig'iladi; ball/XP'ga ta'sir qilmaydi. */
  elapsedMs:      z.number().int().min(0).max(600_000).optional(),
})

// POST /api/progress/:userId/result
router.post(
  '/progress/:userId/result',
  rateLimit({ maxPerMinute: 120, bucket: 'progress' }),
  validate({ body: ResultSchema }),
  wrap(async (req, res) => {
    // Legacy contraction (v2 Phase 4): flag o'chiq bo'lsa arbitrary questionId
    // submission YO'Q — 410 (javob faqat test-session answer orqali).
    // Default ON (prod o'zgarishsiz); rollback = env o'chirish.
    if (!config.legacy.resultEnabled) throw new AppError(410, 'legacy_result_disabled')

    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const { questionId, selectedAnswer, subjectId, clientToken, elapsedMs } = req.body as z.infer<typeof ResultSchema>
    const date = tashkentDate()
    const subject = resolveSubject(subjectId)
    if (!subject.isActive) throw new AppError(400, 'Subject is not active')

    const question = await getProvider(subject.dataSourceId).getQuestionById(questionId)
    if (!question) throw new AppError(404, 'Question not found')
    const correct = selectedAnswer !== null && selectedAnswer === question.correctAnswer

    // Progress counterlari + daily record + streak (+ coin mint) BITTA atomik SQL statement'da.
    const { updated, dailyStreak, duplicate, reason, coinBalance, coinSaved, xp, xpEarned, coinsMinted } = await progressRepository.recordAnswer({
      userId: uid, correct, questionId, date, subjectId, clientToken, elapsedMs,
    })
    if (!updated) throw new AppError(404, 'Progress row not found — call /init first')

    // POST-ANSWER REVEAL: correctAnswer endi public /questions'da yo'q —
    // client feedback uchun javob bergandan keyin shu yerda oladi.
    if (duplicate) {
      if (reason === 'replay') {
        // XUDDI SHU token replay — reveal QAYTA OCHILMAYDI (farming himoyasi).
        res.json({ ok: true, correct: null, correctAnswer: null, dailyStreak: null, duplicate: true })
        return
      }
      // 'gate': anti-farm (avval to'g'ri yechilganiga yana to'g'ri) yoki kunlik
      // kredit — counterlar (va coin) yozilmaydi, LEKIN user FRESH javob bergan:
      // feedback beriladi (aks holda client buni "offline" deb adashtirardi —
      // pending → yakuniy natijada "unanswered" qolib ketardi).
      res.json({ ok: true, correct, correctAnswer: question.correctAnswer, dailyStreak: null, duplicate: true })
      return
    }
    // coin mint: FAQAT yangi to'g'ri javob (gate'dan o'tgan) — duplicate'lar 0.
    // Kunlik shift (COINS_DAILY_ANSWER_CAP) to'lgan bo'lsa 0 qaytadi, shuning
    // uchun qiymat SERVER hisobidan olinadi (client "+1" deb aldanmasin).
    const coinsEarned = coinsMinted

    // BOSS BATTLE: gate'dan o'tgan fresh to'g'ri javob — haftalik boss'ga zarar.
    // Best-effort: boss xatosi ASOSIY javob oqimini sindirmaydi (Sentry'ga tushadi).
    if (correct) {
      try {
        await bossRepository.applyDamage(uid, bossPeriodKey(), BOSS_DAMAGE_PER_CORRECT)
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'boss-battle', stage: 'applyDamage' } })
      }
    }

    // coinSaved: shu javob uzilgan seriyani coin evaziga saqladi — client toast
    // ko'rsatadi (foydalanuvchi coin nimaga sarflanganini bilishi shart).
    res.json({
      ok: true, correct, correctAnswer: question.correctAnswer, dailyStreak,
      coinsEarned, coinBalance, coinSaved,
      // XP: jami (level uchun) + shu javobda berilgani (animatsiya uchun)
      xp, xpEarned,
    })
  }),
)

// DELETE /api/progress/:userId  (reset)
router.delete(
  '/progress/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    await progressRepository.reset(uid)
    res.json({ ok: true })
  }),
)

const ReviewCardSchema = z.object({
  subjectId:  z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
  questionId: z.number().int().positive(),
  ef:         z.number().min(1.3).max(3.0),
  interval:   z.number().int().min(0).max(3650),
  reps:       z.number().int().min(0).max(1000),
  dueAt:      z.number().int().positive(), // unix ms timestamp
})

// GET /api/progress/:userId/cards/summary — SR dashboard xulosasi (#46)
// ("/cards"dan OLDIN: Express aniq yo'l keng wildcard'dan oldin tekshiriladi)
router.get(
  '/progress/:userId/cards/summary',
  validate({
    query: z.object({
      subjectId: z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject').optional(),
    }),
  }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const subjectId = (req.query['subjectId'] as string) || 'yhq'
    const summary = await progressRepository.getCardsSummary(uid, subjectId)
    res.json({ ok: true, summary })
  }),
)

// GET /api/progress/:userId/cards
router.get(
  '/progress/:userId/cards',
  validate({
    query: z.object({
      subjectId: z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject').optional(),
    }),
  }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')
    const subjectId = (req.query['subjectId'] as string) || 'yhq'

    const rows = await progressRepository.getCards(uid, subjectId)
    const cards: Record<number, { questionId: number; ef: number; interval: number; reps: number; dueAt: number }> = {}
    for (const r of rows) {
      cards[r.questionId] = {
        questionId: r.questionId,
        ef:         r.ef,
        interval:   r.interval,
        reps:       r.reps,
        dueAt:      r.dueAt.getTime(),
      }
    }
    res.json({ ok: true, cards })
  }),
)

// POST /api/progress/:userId/cards/review
router.post(
  '/progress/:userId/cards/review',
  rateLimit({ maxPerMinute: 120, bucket: 'progress' }),
  validate({ body: ReviewCardSchema }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const body = req.body as z.infer<typeof ReviewCardSchema>
    await progressRepository.upsertCard({
      userId:     uid,
      subjectId:  body.subjectId,
      questionId: body.questionId,
      ef:         body.ef,
      interval:   body.interval,
      reps:       body.reps,
      dueAt:      new Date(body.dueAt),
    })
    res.json({ ok: true })
  }),
)

// GET /api/progress/:userId/topic-progress?subjectId=yhq
// Mavzu kesimida yechilganlar (v2 TopicsPage progress chiziqlari).
// Faqat aggregate — savol ID/matn/javob YO'Q. requireSelf ostida.
router.get(
  '/progress/:userId/topic-progress',
  validate({
    query: z.object({
      subjectId: z.string().refine((id) => SUBJECT_IDS.includes(id), 'Unknown subject'),
    }),
  }),
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    const subjectId = req.query['subjectId'] as string
    const subject = resolveSubject(subjectId)
    const counts = await progressRepository.getTopicSolvedCounts(uid, subject.id, subject.dataSourceId)
    res.set('Cache-Control', 'private, no-store')
    res.json({ subjectId: subject.id, topics: counts })
  }),
)

export default router
