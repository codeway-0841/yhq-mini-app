import { Router } from 'express'
import { z } from 'zod'
import { AppError, wrap }   from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { ticketQuestionCount } from '../../../shared/test-access'
import { getProvider } from '../../providers'
import { questionsRepository } from './questions.repository'
import { testSessionsRepository } from '../test-sessions/test-sessions.repository'
import { db } from '../../db/connection'
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
import { identityKey } from '../../middleware/rate-limiter'
import { config } from '../../config'
import { issueLaunchToken } from '../test-sessions/launch-token'

const router = Router()

const SearchQuerySchema = z.object({
  subjectId: z.string().min(1).max(32),
  query: z.string().min(2).max(100),
  language: z.enum(['uz', 'ru']).default('uz'),
})

/**
 * Kontent endpointlari og'ir (to'liq savollar to'plami) — 60/min.
 *
 * Kalit FOYDALANUVCHI bo'yicha, IP bo'yicha emas: mobil operatorlar CGNAT
 * ishlatadi va bitta public IP ortida minglab abonent bo'ladi, ya'ni IP
 * chelagi begona odamlar o'rtasida bo'linib ketardi. Anonim so'rov uchungina
 * IP'ga qaytamiz.
 */
const contentLimit = rateLimit({
  maxPerMinute: 60,
  bucket: 'content',
  keyFn: identityKey,
})

/**
 * Search enumeration pacing — launch-token entry point.
 *
 * Umumiy `content` bucket'dan ALOHIDA: search har so'rovda origin'ga tegadi
 * (CDN yo'q — javob per-user launch token tutadi) va avtomatlashtirilgan
 * savol-matni yig'ishning eng arzon yo'li. 30/min/user yetarli (odam
 * qo'lda bundan tez qidirmaydi), skript'ni esa sekinlashtiradi.
 */
const searchLimit = rateLimit({
  maxPerMinute: 30,
  bucket: 'search',
  keyFn: identityKey,
})

const QuestionsQuery = z.object({
  topicId: z.string().regex(/^\d+$/).optional(),
  subject: z.string().max(32).optional(),
})

/**
 * Public content — CDN edge cache (10 min) + browser cache (5 min).
 * Savol matni ommaviy kontent (correctAnswer strip qilinadi) — asl IP server'da
 * (javoblar + izohlar). CDN haqiqiy so'rovlarning ko'pini yutadi, origin'ga esa
 * faqat CDN-miss tushadi — IP cap quyida shuning uchun real user'larga tegmaydi.
 */
const CONTENT_CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'

/** Kuniga bir IP dan necha marta BUTUN bank (topicId'siz) tortish mumkin —
 *  massa-yig'ish SIgnali (script'dan yuzlab refetch). Normal user CDN + client
 *  session cache tufayli origin'ga deyarli tushmaydi → limit urmaydi. */
const FULL_BANK_DAILY_CAP = 20

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
  // Legacy contraction (v2 Phase 4): flag o'chiq bo'lsa full-bank delivery
  // YO'Q — 410 + machine-readable code (v2 client server session'ga o'tadi).
  // Default ON (prod o'zgarishsiz); rollback = env o'chirish.
  if (!config.legacy.questionBankEnabled) {
    res.status(410).json({ error: 'legacy_question_bank_disabled' })
    return
  }
  const parsed = QuestionsQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const { topicId, subject } = parsed.data

  // Massa-yig'ish SIgnali (audit): BUTUN bankni (topicId'siz) bir IP dan kuniga
  // FULL_BANK_DAILY_CAP martadan ko'p tortish — skript-refetch alomati. Normal
  // userlar CDN'dan oladi (origin'ga tushmaydi) → limit ularga tegmaydi.
  // userId bo'lsa (best-effort auth resolve) audit log'da ham yoziladi.
  // KUZATUV rejimi — bloklamaydi, faqat signal yozadi.
  //
  // Ilgari cap oshsa 429 + retryAfterSeconds 86400 qaytarardi. Ikki sabab
  // bilan olib tashlandi:
  //
  //  1) Kalit IP edi, mobil operatorlar esa CGNAT ishlatadi. Bitta public IP
  //     ortidagi HAMMA foydalanuvchi kuniga jami 20 ta sovuq ochish ulashardi,
  //     keyin butun ilova ular uchun 24 soatga o'lardi. Hech kim qoidabuzarlik
  //     qilmasa ham.
  //  2) Himoyalanayotgan narsa maxfiy emas: `toPublic()` `correctAnswer` ni
  //     olib tashlaydi, ya'ni bu javobsiz savollar — ochiq kontent. Hujumchi
  //     IP'ni arzonga almashtiradi, haqiqiy foydalanuvchi esa qamalib qoladi.
  //     Noto'g'ri pozitivning narxi foydasidan katta.
  //
  // Signal (audit log + Sentry) SAQLANADI. Haqiqiy suiiste'mol ko'rinsa,
  // qayta yoqishda kalit `userId` bo'lishi shart, IP emas.
  if (isAuthEnforced() && !topicId) {
    const userId = (req as { userId?: string }).userId
    const ip = req.ip ?? 'unknown'
    // Limiter DB'si yiqilsa kontent berilaveradi — bu yerda fail-OPEN.
    // Ilgari xato yuqoriga otilib 500 qaytarardi, ya'ni DB uzilishi savollarni
    // butunlay o'chirardi.
    try {
      const key = userId ? `qbank:user:${userId}` : `qbank:ip:${ip}`
      const window = await dbRateConsumeWindow(key, FULL_BANK_DAILY_CAP, 24 * 3600)
      if (!window.allowed) {
        const abuse = await dbRateConsumeWindow(`qbank-abuse:${key}`, 3, 7 * 24 * 3600)
        void authRepository.createAuditLog({
          userId,
          action: 'questions_fullbank_abuse',
          resourceType: 'question_bank',
          changes: { ip, key, count: window.count, cap: FULL_BANK_DAILY_CAP, abuseCount7d: abuse.count, repeatOffender: !abuse.allowed, enforced: false },
          ipAddress: ip,
        }).catch(() => {})
        Sentry.captureMessage('questions full-bank fetch over cap (observe-only)', {
          level: !abuse.allowed ? 'warning' : 'info',
          tags: { ip, userId: userId ?? 'anon', count: window.count, abuseCount7d: abuse.count },
        })
      }
    } catch { /* limiter yiqildi — kontent bloklanmaydi */ }
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

// GET /api/questions/search?subjectId=yhq&query=to'xtash&language=uz
//
// Xavfsiz launch-token entry point (question-bank-protection v2):
//   - AUTH MAJBURIY (production'dan qat'i nazar 401): token o'sha user'ga
//     bound — 'anonymous' fallback YO'Q (begona user token'ni ishlatolmaydi,
//     chunki `single` session yaratishda verifyLaunchToken userId solishtiradi);
//   - FAIL-CLOSED secret: proof secret bo'lmasa 503 — statik fallback string
//     bilan imzolash token forge yo'lini ochardi (source ochiq);
//   - javobda master ID/correctAnswer YO'Q — faqat display text + topicId +
//     launchToken (keyingi qadam: `single` selector bilan server session).
router.get('/questions/search', searchLimit, wrap(async (req, res) => {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') {
    res.status(401).json({ error: 'authentication_required' })
    return
  }
  const parsed = SearchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const secret = config.testSessions.proofSecret
  if (!secret) throw new AppError(503, 'test_sessions_unavailable')
  const { subjectId, query, language } = parsed.data
  const entry = resolveSubject(subjectId)

  const rows = await questionsRepository.search(entry.dataSourceId, query, language)
  const hits = rows.map((r) => {
    const { launchToken, expiresAt } = issueLaunchToken(secret, {
      userId,
      subjectId: entry.id,
      questionId: r.id,
    })
    return {
      text: r.text,
      topicId: r.topicId,
      launchToken,
      expiresAt,
    }
  })

  res.set('Cache-Control', 'private, no-store')
  res.json({ hits })
}))

// GET /api/topics?subject=fizika
//
// Public katalog metadata — savol matni/option/javob YO'Q, faqat mavzu
// nomi + questionCount (v2: learner UI katalogni full-bank'siz chizadi).
router.get('/topics', contentLimit, wrap(async (req, res) => {
  const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined
  const entry    = resolveSubject(subject)
  const provider = getProvider(entry.dataSourceId)
  const [rows, counts] = await Promise.all([
    provider.getTopics(),
    // Count yiqilsa katalog baribir qaytadi (fail-open metadata — xavfsizlik
    // chegarasi emas, faqat UI soni).
    questionsRepository.countByTopic(entry.dataSourceId).catch(() => new Map<number, number>()),
  ])
  res.set('Cache-Control', CONTENT_CACHE)
  res.json(rows.map((topic) => ({ ...topic, questionCount: counts.get(topic.id) ?? 0 })))
}))

const TicketCatalogQuery = z.object({
  subject: z.string().max(32).optional(),
  language: z.enum(['uz', 'ru']).default('uz'),
})

/**
 * GET /api/ticket-catalog?subject=yhq&language=uz
 *
 * Bilet KATALOGI (v2): faqat sonlar — ticketSize, ticketCount, totalQuestions.
 * Savol matni/option/javob/ID YO'Q. Hisob ticket session bilan BITTA manbadan
 * (dedup'langan candidate ro'yxat) — katalogdagi N-bilet session'dagi N-bilet
 * bilan bir xil tarkibda (404 yo'q). Public CDN (topics kabi).
 */
router.get('/ticket-catalog', contentLimit, wrap(async (req, res) => {
  const parsed = TicketCatalogQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const entry = resolveSubject(parsed.data.subject)
  const size = ticketQuestionCount(entry.id)
  const ids = await testSessionsRepository.listQuestionIds(
    entry.dataSourceId, db, undefined, parsed.data.language,
  )
  const totalQuestions = ids.length
  res.set('Cache-Control', CONTENT_CACHE)
  res.json({
    subjectId: entry.id,
    ticketSize: size,
    ticketCount: Math.floor(totalQuestions / size),
    totalQuestions,
  })
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
