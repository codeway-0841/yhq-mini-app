import { Router } from 'express'
import { z } from 'zod'
import { wrap }   from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { getProvider } from '../../providers'
import { questionsRepository } from './questions.repository'
import { rateLimit } from '../../middleware/rate-limiter'

const router = Router()

/** Kontent endpointlari og'ir (to'liq savollar to'plami) — IP bo'yicha 60/min */
const contentLimit = rateLimit({ maxPerMinute: 60, keyFn: (req) => req.ip ?? 'unknown' })

const QuestionsQuery = z.object({
  topicId: z.string().regex(/^\d+$/).optional(),
  subject: z.string().max(32).optional(),
})

/**
 * Public content — CDN edge cache (24 h) + browser cache (1 h).
 * Kontent faqat qo'lda yangilanadi (seed), shuning uchun kunlik cache ok.
 */
const CONTENT_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600'

/**
 * GET /api/questions?topicId=1&subject=fizika
 *
 * subject → SubjectRegistry → dataSourceId → QuestionBankProvider.
 * Frontend faqat subject.id yuboradi — backend o'zi qaysi bazadan
 * olishini hal qiladi (separation of concerns).
 */
router.get('/questions', contentLimit, wrap(async (req, res) => {
  const parsed = QuestionsQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const { topicId, subject } = parsed.data
  const entry    = resolveSubject(subject)
  const provider = getProvider(entry.dataSourceId)

  const rows = topicId
    ? await provider.getQuestionsByTopic(Number(topicId))
    : await provider.getAllQuestions()

  res.set('Cache-Control', CONTENT_CACHE)
  res.set('X-Data-Source', entry.dataSourceId)
  res.json(rows)
}))

// GET /api/topics?subject=fizika
router.get('/topics', contentLimit, wrap(async (req, res) => {
  const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined
  const entry    = resolveSubject(subject)
  const provider = getProvider(entry.dataSourceId)
  const rows = await provider.getTopics()
  res.set('Cache-Control', CONTENT_CACHE)
  res.json(rows)
}))

const ExplanationQuery = z.object({
  lang: z.enum(['uz', 'ru']).default('uz'),
})

/**
 * GET /api/questions/:questionId/explanation?lang=uz
 *
 * FREE foydalanuvchilar uchun statik tushuntirish (AI Tutor premium-only
 * bo'lgani uchun muqobil). 404 — ushbu savolga izoh yozilmagan.
 * Kontent kam o'zgaradi — CDN cache OK.
 */
router.get('/questions/:questionId/explanation', wrap(async (req, res) => {
  const id = Number(req.params.questionId)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Noto\'g\'ri questionId' })
    return
  }
  const parsed = ExplanationQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri lang (uz|ru)' })
    return
  }

  // Hozircha barcha dataSource'lar YHQ bazasiga ishora qiladi — subject
  // parametri kerak emas (questionId global unique). Yangi provider'lar
  // kelganda per-subject explain endpoint'lari qo'shiladi.
  const row = await questionsRepository.findExplanation(id)
  if (!row) {
    res.status(404).json({ error: 'explanation_not_found' })
    return
  }
  res.set('Cache-Control', CONTENT_CACHE)
  res.json({ questionId: id, text: parsed.data.lang === 'ru' ? row.explanationRu : row.explanationUz })
}))

export default router
