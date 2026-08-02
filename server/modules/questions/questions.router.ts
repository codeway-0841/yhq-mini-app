import { Router } from 'express'
import { z } from 'zod'
import { wrap }   from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { getProvider } from '../../providers'

const router = Router()

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
router.get('/questions', wrap(async (req, res) => {
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
router.get('/topics', wrap(async (req, res) => {
  const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined
  const entry    = resolveSubject(subject)
  const provider = getProvider(entry.dataSourceId)
  const rows = await provider.getTopics()
  res.set('Cache-Control', CONTENT_CACHE)
  res.json(rows)
}))

export default router
