/**
 * Math Board recognition proxy — POST /api/math-board/recognize.
 *
 * - Auth majburiy (global telegramAuth'dan req.userId).
 * - TEST REJIMI: kvota o'chirilgan (QUOTA_ENABLED=false) — hammaga bepul.
 * - Body 6mb (canvas PNG base64) — app.ts'da alohida limit.
 */

import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { CHECK_DETAILS } from '../../../src/shared/math-engine'
import { config } from '../../config'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { parseUserId } from '../../utils/parse'
import { db } from '../../db/connection'
import { users } from '../../schema'
import { tashkentDate } from '../../utils/date'
import { tutorUsageRepository } from '../tutor/tutor.repository'
import { recognizeHandwriting, askBoardHint, recognizeBlockImages } from './math-board.service'

const router = Router()

// P0-C: kvota env orqali (`MATH_BOARD_QUOTA_DISABLED=true` faqat test/dev).
// Production default: YOQILGAN. Prod'da o'chirilgan bo'lsa BOOT FATAL
// (Gemini byudjet himoyasiz qolmasligi uchun).
if (config.isProd && config.ai.mathBoardQuotaDisabled) {
  throw new Error('FATAL: MATH_BOARD_QUOTA_DISABLED=true in production — Gemini byudjet himoyasiz')
}
if (config.ai.mathBoardQuotaDisabled) {
  console.warn('[math-board] QUOTA DISABLED (MATH_BOARD_QUOTA_DISABLED=true) — faqat test uchun!')
}
const QUOTA_ENABLED = !config.ai.mathBoardQuotaDisabled

const RecognizeBodySchema = z.object({
  image: z.string().min(50).max(6_000_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/png'),
  category: z.enum(['algebra', 'fraction', 'root', 'power', 'logarithm']).optional(),
  language: z.enum(['uz', 'ru']).default('uz'),
})

async function isPremiumBoard(uid: string): Promise<boolean> {
  const [row] = await db.select({ tariff: users.tariff, premiumUntil: users.premiumUntil })
    .from(users).where(eq(users.id, uid))
  return !!row && (row.tariff === 'premium' || (row.premiumUntil != null && row.premiumUntil > new Date()))
}

router.post(
  '/math-board/recognize',
  rateLimit({
    maxPerMinute: 10,
    bucket: 'math_board',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: RecognizeBodySchema }),
  wrap(async (req, res) => {
    const verifiedId = (req as { userId?: string }).userId
    const uid = verifiedId ? parseUserId(verifiedId) : null
    if (!uid) throw new AppError(401, 'user_not_identified')

    if (QUOTA_ENABLED) {
      const date = tashkentDate()
      const userIsPremium = await isPremiumBoard(uid)
      const limit = userIsPremium ? 30 : 2
      const photoKey = `${uid}:photo`
      if (!(await tutorUsageRepository.tryConsume(photoKey, date, limit))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
      if (!(await tutorUsageRepository.tryConsume('0:photo', date, 500))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
    }

    const { image, mimeType, category, language } = req.body as z.infer<typeof RecognizeBodySchema>
    let result: Awaited<ReturnType<typeof recognizeHandwriting>>
    try {
      result = await recognizeHandwriting({ imageBase64: image, mimeType, category, language })
    } catch (e) {
      console.error('[math-board] recognize failed:', e instanceof Error ? e.message : e)
      throw e
    }

    res.json({ ok: true, ...result })
  }),
)

/**
 * POST /api/math-board/recognize-blocks — Faza 4 blokli recognition.
 *
 * Bitta Gemini chaqiruvida N blok (segmentlangan doska). Javob qat'iy schema
 * (`parseBlockResults` — per-block fail-closed): yaroqsiz item failed entry.
 * Kvota: bitta chaqiruv = bitta photo slot (QUOTA_ENABLED'da).
 */
const RecognizeBlocksBodySchema = z.object({
  blocks: z.array(z.object({
    blockId: z.string().min(1).max(64),
    image: z.string().min(50).max(6_000_000),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/png'),
  })).min(1).max(10),
  category: z.enum(['algebra', 'fraction', 'root', 'power', 'logarithm']).optional(),
  language: z.enum(['uz', 'ru']).default('uz'),
})

router.post(
  '/math-board/recognize-blocks',
  rateLimit({
    maxPerMinute: 10,
    bucket: 'math_board_blocks',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: RecognizeBlocksBodySchema }),
  wrap(async (req, res) => {
    const verifiedId = (req as { userId?: string }).userId
    const uid = verifiedId ? parseUserId(verifiedId) : null
    if (!uid) throw new AppError(401, 'user_not_identified')

    if (QUOTA_ENABLED) {
      const date = tashkentDate()
      const userIsPremium = await isPremiumBoard(uid)
      const limit = userIsPremium ? 30 : 2
      const photoKey = `${uid}:photo`
      if (!(await tutorUsageRepository.tryConsume(photoKey, date, limit))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
      if (!(await tutorUsageRepository.tryConsume('0:photo', date, 500))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
    }

    const { blocks, category, language } = req.body as z.infer<typeof RecognizeBlocksBodySchema>
    let results: Awaited<ReturnType<typeof recognizeBlockImages>>
    try {
      results = await recognizeBlockImages({
        blocks: blocks.map((b) => ({ blockId: b.blockId, imageBase64: b.image, mimeType: b.mimeType })),
        category,
        language,
      })
    } catch (e) {
      console.error('[math-board] recognize-blocks failed:', e instanceof Error ? e.message : e)
      throw e
    }

    res.json({ ok: true, results })
  }),
)

/**
 * POST /api/math-board/hint — Sokratik savol (Faza 5).
 *
 * Client avval lokal hint ko'rsatadi; LLM faqat xato takrorlanganda yoki
 * lokal hint topilmasa chaqiradi. TEST: kvota o'chirilgan (QUOTA_ENABLED).
 *
 * STALE-GUARD CONTRACT (aniqlashtirish): bu endpoint sessionRevision QABUL
 * QILMAYDI va SERVER tomonida staleness tekshiruvi YO'Q. Eskirgan javoblar
 * faqat CLIENT'da tashlanadi (`lib/request-guard.ts` — problemId/session/
 * ink/recognition/acceptedSteps revisionlari + requestId konteksti). Server
 * stateless: bir xil body → bir xil hint nomzodi.
 */
const HintBodySchema = z.object({
  problemId: z.string().min(1).max(64),
  promptLatex: z.string().min(1).max(500),
  assumptions: z.array(z.string().max(100)).max(10).default([]),
  acceptedSteps: z.array(z.string().max(200)).max(10).default([]),
  /** Joriy xato qadam (ASCII) — LLM shu formulani ko'rib savol beradi (P2) */
  candidateStep: z.string().min(1).max(200),
  checkStatus: z.enum(['wrong', 'invalid_transition', 'domain_error', 'syntax_error', 'unknown', 'uncertain']),
  /** Engine detail kodi — enum (shared CHECK_DETAILS'dan derive, desync yo'q) */
  checkDetail: z.enum(CHECK_DETAILS),
  knownBlockIds: z.array(z.string().max(64)).max(20).default([]),
  language: z.enum(['uz', 'ru']).default('uz'),
})

router.post(
  '/math-board/hint',
  rateLimit({
    maxPerMinute: 10,
    bucket: 'math_board_hint',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: HintBodySchema }),
  wrap(async (req, res) => {
    const verifiedId = (req as { userId?: string }).userId
    const uid = verifiedId ? parseUserId(verifiedId) : null
    if (!uid) throw new AppError(401, 'user_not_identified')

    if (QUOTA_ENABLED) {
      const date = tashkentDate()
      const userIsPremium = await isPremiumBoard(uid)
      const limit = userIsPremium ? 20 : 3
      const hintKey = `${uid}:board-hint`
      if (!(await tutorUsageRepository.tryConsume(hintKey, date, limit))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
      if (!(await tutorUsageRepository.tryConsume('0:board-hint', date, 1000))) {
        throw new AppError(429, userIsPremium ? 'daily_limit' : 'free_limit_exceeded')
      }
    }

    const { problemId, promptLatex, assumptions, acceptedSteps, candidateStep, checkStatus, checkDetail, knownBlockIds, language } = req.body as z.infer<typeof HintBodySchema>
    let answer: Awaited<ReturnType<typeof askBoardHint>>
    try {
      answer = await askBoardHint({
        problemId, promptLatex, assumptions, acceptedSteps, candidateStep,
        checkStatus, checkDetail, knownBlockIds, language,
      })
    } catch (e) {
      console.error('[math-board] hint failed:', e instanceof Error ? e.message : e)
      throw e
    }

    res.json({ ok: true, ...answer })
  }),
)

export default router
