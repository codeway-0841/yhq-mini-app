/**
 * AI Kunlik Test router (rustili, Milliy sertifikat formati).
 *
 *  GET  /api/ai-tests/today?subject=rustili — bugungi variantlar + mening holatim
 *  GET  /api/ai-tests/:id                   — to'liq test (javob kalitlarisiz; slot 2 = premium)
 *  POST /api/ai-tests/:id/submit            — javoblarni topshirish (baholash + coin)
 *  GET  /api/ai-tests/:id/result            — mening baholangan urinishim (post-submit reveal)
 *  POST /api/admin/ai-tests/generate        — admin manual trigger (cron zaxirasi)
 *
 * QOIDALAR (shared/ai-daily-test.ts SSOT):
 *  - correctAnswer HECH QACHON client'ga chiqmaydi — toPublicAiTest() (trust boundary);
 *    reveal FAQAT submit'dan keyin /result orqali o'z egasiga.
 *  - 1 test = 1 urinish (DB UNIQUE); submit idempotent (clientToken).
 *  - AI baholash kvotasi FAQAT haqiqatan AI kerak bo'lganda sarflanadi
 *    (needsAiReview → tryConsume); kvota tugasa esse baholanmaydi, lekin
 *    urinish yo'qolmaydi (deterministik ball + coin saqlanadi).
 */

import { Router } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { tashkentDate } from '../../utils/date'
import { isPremiumUser } from '../../utils/premium'
import { tutorUsageRepository } from '../tutor/tutor.repository'
import { SUBJECT_IDS } from '../../config/subjects'
import {
  AI_TEST_SUBJECT_ID,
  AI_TEST_PREMIUM_SLOT,
  AI_TEST_DAILY_GRADE_LIMIT,
  AI_TEST_GRADE_GLOBAL_USER_ID,
  AI_TEST_SLOTS,
  AiTestAnswersSchema,
  toPublicAiTest,
} from '../../../shared/ai-daily-test'
import { aiTestsRepository } from './ai-tests.repository'
import { gradeAiDailyTest, needsAiReview } from './grader'
import { generateAiDailyTest } from './generator'

const router = Router()

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') {
    throw new AppError(401, 'AUTH_REQUIRED')
  }
  return userId
}

function parseTestId(raw: unknown): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, 'INVALID_TEST_ID')
  return id
}

function rejectFutureTest(test: { date: string }): void {
  if (test.date > tashkentDate()) throw new AppError(404, 'TEST_NOT_FOUND')
}

const SubmitSchema = z.object({
  answers: AiTestAnswersSchema,
  clientToken: z.string().min(8).max(64),
})

const AdminGenerateSchema = z.object({
  /** Default: ertangi kun (scheduler pattern'i bilan bir xil) */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot: z.union([z.literal(1), z.literal(2)]).optional(),
})

// ── GET /api/ai-tests/today ──────────────────────────────────────────────────
router.get(
  '/ai-tests/today',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const subject = typeof req.query.subject === 'string' ? req.query.subject : AI_TEST_SUBJECT_ID
    if (!SUBJECT_IDS.includes(subject)) throw new AppError(404, 'UNKNOWN_SUBJECT')

    const date = tashkentDate()
    const tests = await aiTestsRepository.getTestsForDate(subject, date)
    const attempts = await aiTestsRepository.getAttemptsForTests(tests.map((t) => t.id), userId)

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      date,
      tests: tests.map((t) => {
        const a = attempts.get(t.id)
        return {
          id: t.id,
          slot: t.slot,
          title: t.title,
          taskCount: t.payload.tasks.length,
          premiumRequired: t.slot >= AI_TEST_PREMIUM_SLOT,
          attempted: !!a,
          scoreCorrect: a?.scoreCorrect ?? null,
          essayScore: a?.essayScore ?? null,
          coinsAwarded: a?.coinsAwarded ?? null,
        }
      }),
    })
  }),
)

// ── GET /api/ai-tests/:id ────────────────────────────────────────────────────
router.get(
  '/ai-tests/:id',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const id = parseTestId(req.params.id)
    const test = await aiTestsRepository.getTestById(id)
    if (!test) throw new AppError(404, 'TEST_NOT_FOUND')
    rejectFutureTest(test)

    if (test.slot >= AI_TEST_PREMIUM_SLOT && !(await isPremiumUser(userId))) {
      throw new AppError(403, 'premium_required')
    }
    if (await aiTestsRepository.getAttempt(id, userId)) {
      throw new AppError(409, 'already_attempted')
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      test: {
        id: test.id,
        slot: test.slot,
        date: test.date,
        ...toPublicAiTest(test.payload),
      },
    })
  }),
)

// ── POST /api/ai-tests/:id/submit ────────────────────────────────────────────
router.post(
  '/ai-tests/:id/submit',
  rateLimit({
    maxPerMinute: 6,
    bucket: 'ai-test-submit',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: SubmitSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const id = parseTestId(req.params.id)
    const { answers, clientToken } = req.body as z.infer<typeof SubmitSchema>

    const test = await aiTestsRepository.getTestById(id)
    if (!test) throw new AppError(404, 'TEST_NOT_FOUND')
    rejectFutureTest(test)
    if (test.slot >= AI_TEST_PREMIUM_SLOT && !(await isPremiumUser(userId))) {
      throw new AppError(403, 'premium_required')
    }

    // Idempotency fast-path: shu test allaqachon yechilgan — saqlangan natija
    const existing = await aiTestsRepository.getAttempt(id, userId)
    if (existing) {
      res.json({ ok: true, duplicate: true, grading: existing.grading, coinsAwarded: existing.coinsAwarded })
      return
    }

    // AI kvotasi FAQAT kerak bo'lganda (esse yoki qisqa javob qayta-ko'rig'i)
    let aiAllowed = false
    if (needsAiReview(test.payload, answers)) {
      aiAllowed = await tutorUsageRepository.tryConsume(
        AI_TEST_GRADE_GLOBAL_USER_ID, tashkentDate(), AI_TEST_DAILY_GRADE_LIMIT,
      )
    }

    const grading = await gradeAiDailyTest(test.payload, answers, aiAllowed)
    const result = await aiTestsRepository.submitAttempt({ testId: id, userId, answers, grading, clientToken })

    if (result.status === 'already_attempted') {
      // Parallel/race mag'lubi — g'olib yozgan natijani qaytaramiz (bir xil javob)
      const winner = await aiTestsRepository.getAttempt(id, userId)
      if (!winner) throw new AppError(500, 'ATTEMPT_STATE_ERROR')
      res.json({ ok: true, duplicate: true, grading: winner.grading, coinsAwarded: winner.coinsAwarded })
      return
    }

    res.json({ ok: true, duplicate: false, grading, coinsAwarded: grading.coinsAwarded, balance: result.balance })
  }),
)

// ── GET /api/ai-tests/:id/result ─────────────────────────────────────────────
router.get(
  '/ai-tests/:id/result',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const id = parseTestId(req.params.id)
    const test = await aiTestsRepository.getTestById(id)
    if (!test) throw new AppError(404, 'TEST_NOT_FOUND')
    const attempt = await aiTestsRepository.getAttempt(id, userId)
    if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND')

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      attempt: {
        testId: attempt.testId,
        title: test.title,
        grading: attempt.grading,
        answers: attempt.answers,
        scoreCorrect: attempt.scoreCorrect,
        essayScore: attempt.essayScore,
        coinsAwarded: attempt.coinsAwarded,
        createdAt: attempt.createdAt,
      },
      // Review UI self-sufficient bo'lishi uchun public payload ham qaytariladi
      // (javob kalitlari grading ichida — bu POST-SUBMIT reveal, o'z egasiga).
      test: { id: test.id, slot: test.slot, date: test.date, ...toPublicAiTest(test.payload) },
    })
  }),
)

// ── POST /api/admin/ai-tests/generate ────────────────────────────────────────
// Diqqat: app.ts'da adminRouter BUndan OLDIN mount qilingan — /admin/* path'lar
// requireAdmin'dan o'tib keladi. Manual zaxira: scheduler ishlamay qolsa
// (yoki launch kuni) shu yerda qo'lda generatsiya qilinadi.
// Vercel 60s limitiga e'tibor bering — parallel chaqiriqlar odatda ~40s.
router.post(
  '/admin/ai-tests/generate',
  rateLimit({ maxPerMinute: 2, bucket: 'ai-test-generate', keyFn: (request) => (request as { userId?: string }).userId ?? request.ip }),
  validate({ body: AdminGenerateSchema }),
  wrap(async (req, res) => {
    const { date, slot } = req.body as z.infer<typeof AdminGenerateSchema>
    const targetDate = date ?? tashkentDate(new Date(Date.now() + 24 * 3600_000))
    const slots = slot ? [slot] : [...AI_TEST_SLOTS]

    const results: { slot: number; status: 'inserted' | 'exists' }[] = []
    for (const s of slots) {
      const payload = await generateAiDailyTest(s as 1 | 2)
      const status = await aiTestsRepository.insertGeneratedTest({
        subjectId: AI_TEST_SUBJECT_ID, date: targetDate, slot: s, title: payload.title, payload,
      })
      results.push({ slot: s, status })
    }
    res.json({ ok: true, date: targetDate, results })
  }),
)

export default router
