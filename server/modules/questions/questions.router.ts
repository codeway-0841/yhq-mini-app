import { Router } from 'express'
import { z } from 'zod'
import { wrap }   from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { getProvider } from '../../providers'
import { requireAuth } from '../../middleware/auth'
import { questionsRepository } from './questions.repository'
// Multi-instance umumiy limiter: prod'da DB counter (Neon), test/dev'da in-memory.
// Vercel serverless'da har so'rov yangi instansiya bo'lishi mumkin — in-memory
// bucket o'sha instansiya bilan birga yo'qoladi (no-op); DB counter umumiy.
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'

const router = Router()

/** Kontent endpointlari og'ir (to'liq savollar to'plami) — IP bo'yicha 60/min */
const contentLimit = rateLimit({ maxPerMinute: 60, bucket: 'content', keyFn: (req) => req.ip ?? 'unknown' })

const QuestionsQuery = z.object({
  topicId: z.string().regex(/^\d+$/).optional(),
  subject: z.string().max(32).optional(),
})

/**
 * Public content — CDN edge cache (10 min) + browser cache (5 min).
 * Admin CRUD mavjud bo'lgani uchun 24 soatlik cache endi ZIYO: tahrirlangan
 * savol foydalanuvchilarga bir kungacha eski holatda ko'rinardi.
 * stale-while-revalidate=1h: muddat o'tgach ham eski javob, orqada yangilanadi.
 */
const CONTENT_CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'

/**
 * Public savol payload'i TO'G'RI JAVOBSIZ — correctAnswer faqat serverda
 * qoladi (scoring trust boundary). Aks holda client javob kalitini o'qib
 * /result'ga "to'g'ri" variantni yuborib leaderboard'ni aldashi mumkin edi.
 * Feedback endi POST /progress/:userId/result javobidan olinadi
 * (post-answer reveal: foydalanuvchi allaqachon javob bergan).
 * Admin'ga to'liq qatorlar alohida GET /api/admin/questions orqali.
 */
function toPublic<T extends { correctAnswer: string }>(rows: T[]): Array<Omit<T, 'correctAnswer'>> {
  return rows.map(({ correctAnswer: _hidden, ...rest }) => rest)
}

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
  res.json(toPublic(rows))
}))

const OfflinePackageQuery = z.object({
  subject: z.string().max(32).optional(),
})

/**
 * GET /api/offline-package?subject=yhq
 *
 * Oflayn mashq uchun — javob kaliti (correctAnswer) BILAN qaytaradi.
 * DIQQAT: bu YAGONA joy repo bo'ylab — correctAnswer ataylab client'ga
 * yuboriladi. Xavfsiz, chunki oflayn-mashq javoblari HECH QACHON
 * /progress/:userId/result'ga yuborilmaydi: qorovul
 * src/shared/store/useAppStore.ts'dagi submitAnswer ichida (choke point),
 * ya'ni HAR QANDAY mashq ekrani — TestPage, Speed Round, Kunlik mashq va
 * keyin qo'shiladiganlari ham — avtomatik qamrab olinadi. Kalitni bilish
 * shu sababli reyting/coin'ni aldashga yaramaydi.
 * Regressiya qulfi: tests/unit/store/offline-practice-guard.test.ts.
 *
 * Yo'l ATAYLAB '/questions/...' PREFIKSSIZ: server/middleware/auth.ts'dagi
 * PUBLIC_GET birinchi segmenti 'questions' bo'lgan HAR QANDAY yo'lni
 * telegramAuth'da to'liq credential-tekshiruvsiz o'tkazadi — req.userId
 * hech qachon o'rnatilmaydi, requireAuth doim 401 qaytarardi.
 */
router.get('/offline-package', requireAuth, contentLimit, wrap(async (req, res) => {
  const parsed = OfflinePackageQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const entry    = resolveSubject(parsed.data.subject)
  const provider = getProvider(entry.dataSourceId)
  const rows     = await provider.getAllQuestions()

  res.set('Cache-Control', 'no-store')  // javob kalitlari CDN/browser'da qolmasin
  res.set('X-Data-Source', entry.dataSourceId)
  res.json(rows)   // toPublic() CHAQIRILMAYDI — correctAnswer qoladi
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
