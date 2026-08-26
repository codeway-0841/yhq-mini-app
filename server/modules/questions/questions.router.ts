import { Router } from 'express'
import { z } from 'zod'
import { wrap }   from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { getProvider } from '../../providers'
import { questionsRepository } from './questions.repository'
import { isAuthEnforced } from '../../middleware/auth'
import { dbRateConsumeWindow } from '../../middleware/db-rate-limiter'
import { authRepository } from '../auth/auth.repository'
import { Sentry } from '../../utils/sentry'
import { executeRows } from '../../db/connection'
import { sql } from 'drizzle-orm'
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
 * AUTH-ONLY kontent (audit 2026-08-26: /questions + /topics public'dan olindi) —
 * CDN public cache ZIYO: edge cache auth cheklovini aylanib o'tardi (URL-keyed
 * cache birinchi authed user javobini anonim so'rovga ham berardi). Endi
 * kontent faqat authed userga; client session'da bir marta yuklaydi
 * (useQuestionsStore), server providerlar in-memory pool — DB bosimi oshmaydi.
 */
const CONTENT_CACHE = 'private, no-store'

/** Kuniga bir user necha marta BUTUN bankni qayta tortishi mumkin (audit:
 *  massa-yig'ish signal — normal user client cache tufayli 1 marta yuklaydi). */
const FULL_BANK_DAILY_CAP = 5

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

  // Massa-yig'ish himoyasi (audit): BUTUN bankni (topicId'siz) bir user kuniga
  // FULL_BANK_DAILY_CAP martadan ko'p tortishi — shubhali scraping alomati.
  // Limit oshsa: 429 + audit_logs 'questions_fullbank_abuse' + Sentry signal.
  // Dev/test'da (auth enforce EMAS) o'tkaziladi.
  const userId = (req as { userId?: string }).userId
  if (isAuthEnforced() && userId && !topicId) {
    const window = await dbRateConsumeWindow(`qbank:${userId}`, FULL_BANK_DAILY_CAP, 24 * 3600)
    if (!window.allowed) {
      // Repeat-offender kuzatuvi (7 kunlik oyna): bitta kalendariy kunlik chekka
      // emas, tizimli pattern'ni admin ko'rsin — 3+ overage = scrape shubhasi.
      const abuse = await dbRateConsumeWindow(`qbank-abuse:${userId}`, 3, 7 * 24 * 3600)
      void authRepository.createAuditLog({
        userId,
        action: 'questions_fullbank_abuse',
        resourceType: 'question_bank',
        changes: { count: window.count, cap: FULL_BANK_DAILY_CAP, abuseCount7d: abuse.count, repeatOffender: !abuse.allowed },
      }).catch(() => {})
      Sentry.captureMessage('questions full-bank fetch abuse', {
        level: !abuse.allowed ? 'error' : 'warning',
        tags: { userId, count: window.count, abuseCount7d: abuse.count },
      })
      res.status(429).json({ error: 'too_many_requests', retryAfterSeconds: 86_400 })
      return
    }
  }

  const entry    = resolveSubject(subject)
  const provider = getProvider(entry.dataSourceId)

  const rows = topicId
    ? await provider.getQuestionsByTopic(Number(topicId))
    : await provider.getAllQuestions()

  res.set('Cache-Control', CONTENT_CACHE)
  res.set('X-Data-Source', entry.dataSourceId)
  res.json(toPublic(rows))
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

  // Post-answer GATING (audit H-4): izoh matni to'g'ri javobni oshkor qilishi
  // mumkin ("Nima uchun A4 to'g'ri...") — public ochiq endpoint cheater skriptiga
  // har savolda fresh-correct + coin/XP/liga farm yo'lini berardi. Izoh FAQAT shu
  // savolga ALLAQACHON javob bergan (progress_questions'da qatori bor) user'ga
  // ko'rsatiladi (/result post-answer reveal semantikasi bilan bir xil).
  // Auth enforce qilinmagan dev/test muhitda gate o'tkazib yuboriladi.
  const userId = (req as { userId?: string }).userId
  if (isAuthEnforced()) {
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const answered = await executeRows(sql`
      SELECT 1 AS x FROM progress_questions
      WHERE user_id = ${userId} AND question_id = ${id}
      LIMIT 1
    `)
    if (answered.length === 0) {
      res.status(403).json({ error: 'explanation_locked' })
      return
    }
  }

  // Hozircha barcha dataSource'lar YHQ bazasiga ishora qiladi — subject
  // parametri kerak emas (questionId global unique). Yangi provider'lar
  // kelganda per-subject explain endpoint'lari qo'shiladi.
  const row = await questionsRepository.findExplanation(id)
  if (!row) {
    res.status(404).json({ error: 'explanation_not_found' })
    return
  }
  // Per-user gate — CDN public cache ZIYO (403 per user farq qiladi).
  res.set('Cache-Control', 'private, no-store')
  res.json({ questionId: id, text: parsed.data.lang === 'ru' ? row.explanationRu : row.explanationUz })
}))

export default router
