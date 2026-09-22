/**
 * AI Kurslar router (user-created courses, Wondering-style).
 *
 *  POST /api/ai-courses                              — kurs yaratish (mock outline)
 *  GET  /api/ai-courses                              — mening kurslarim (progress bilan)
 *  GET  /api/ai-courses/:id                          — kurs tafsiloti (public payload + progress)
 *  DELETE /api/ai-courses/:id                       — kursni o'chirish (faqat egasi)
 *  POST /api/ai-courses/:id/lessons/:lessonId/complete — darsni yakunlash (baho + coin)
 *
 * QOIDALAR (shared/ai-courses.ts SSOT):
 *  - correctAnswer HECH QACHON client'ga chiqmaydi — toPublicCoursePayload/
 *    toPublicCourseLesson (trust boundary); reveal FAQAT complete'dan keyin
 *    o'z egasiga (grading ichida).
 *  - 1 dars = 1 yozuv (DB UNIQUE); complete idempotent (clientToken).
 *  - Oylik limit: free 2 / premium 15 (Tashkent oyi). 429 COURSE_LIMIT_REACHED.
 *  - Yakunlash sharti: BARCHA mashqlarga javob (INCOMPLETE 400).
 */

import { Router, type Request } from 'express'
import { z } from 'zod'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit as rateLimit } from '../../middleware/db-rate-limiter'
import { isPremiumUser } from '../../utils/premium'
import { db } from '../../db/connection'
import { users } from '../../schema'
import { eq } from 'drizzle-orm'
import {
  AI_COURSE_COINS_PER_LESSON,
  AI_COURSE_FREE_MONTHLY_LIMIT,
  AI_COURSE_PREMIUM_MONTHLY_LIMIT,
  AiCourseCompleteSchema,
  AiCourseCreateSchema,
  AiCoursePayloadSchema,
  aiCourseLessonCount,
  findCourseLesson,
  gradeCoursePractices,
  isLessonFullyAnswered,
  toPublicCourseLesson,
  toPublicCoursePayload,
} from '../../../shared/ai-courses'
import { aiCoursesRepository } from './ai-courses.repository'
import { generateCourseOutline, hydrateCourseSections } from './meta-generator'
import {
  GoldenCourseRequestSchema,
  GoldenCourseRunSchema,
  GOLDEN_COURSE_STEP_ORDER,
  convertGoldenCourseToAiCoursePayload,
} from '../../../shared/golden-course'
import {
  executeGoldenCoursePipeline,
  updateGoldenCourseStep,
} from './golden-pipeline'

const router = Router()

function requireUserId(req: unknown): string {
  const userId = (req as { userId?: string }).userId
  if (!userId || userId === '0') {
    throw new AppError(401, 'AUTH_REQUIRED')
  }
  return userId
}

function parseCourseId(raw: unknown): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, 'INVALID_COURSE_ID')
  return id
}

const LessonParamsSchema = z.object({
  id: z.string().regex(/^\d+$/),
  lessonId: z.string().min(1).max(32),
})

const CourseParamsSchema = z.object({
  id: z.string().regex(/^\d+$/),
})

// ── POST /api/ai-courses ─────────────────────────────────────────────────────
router.post(
  '/ai-courses',
  rateLimit({
    maxPerMinute: 5,
    bucket: 'ai-course-create',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ body: AiCourseCreateSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const data = req.body as z.infer<typeof AiCourseCreateSchema>

    const [userRow] = await db.select({ isAdmin: users.isAdmin, tariff: users.tariff }).from(users).where(eq(users.id, userId)).limit(1)
    const isAdmin = userRow?.isAdmin ?? false
    const premium = userRow?.tariff === 'premium' || await isPremiumUser(userId)
    const limit = isAdmin ? 9999 : (premium ? AI_COURSE_PREMIUM_MONTHLY_LIMIT : AI_COURSE_FREE_MONTHLY_LIMIT)
    const used = await aiCoursesRepository.countCreatedThisMonth(userId)
    if (!isAdmin && used >= limit) {
      throw new AppError(429, 'COURSE_LIMIT_REACHED')
    }

    // Real Meta AI tezkor blueprint (4-6s) yoki mock fallback — hech qachon 500 emas.
    // Sarlavha — AI tozalagan topic (xom gap emas); xom matn topic ustunida saqlanadi.
    const { payload, generator, title, blueprint } = await generateCourseOutline(data)
    const course = await aiCoursesRepository.createCourse({
      userId,
      title,
      data,
      payload,
    })

    // Agar blueprint Meta AI orqali olingan bo'lsa, orqa fonda chuqur darslarni sintez qilamiz (background hydration)
    if (blueprint && generator === 'meta') {
      hydrateCourseSections(course.id, data, blueprint).catch((err) => {
        console.warn(`[ai-courses] background hydration for course ${course.id} error:`, err)
      })
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        inputKind: course.inputKind,
        lessonLength: course.lessonLength,
        language: course.language,
        totalLessons: aiCourseLessonCount(payload),
        completedLessons: 0,
        createdAt: course.createdAt,
        /** 'meta' = real AI, 'mock' = zaxira outline (kalit/kvota bo'lmasa) */
        generator,
        limit: { used: used + 1, total: limit, premium },
      },
    })
  }),
)

// ── GET /api/ai-courses ──────────────────────────────────────────────────────
router.get(
  '/ai-courses',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const courses = await aiCoursesRepository.listMineWithProgress(userId)
    const premium = await isPremiumUser(userId)
    const limitTotal = premium ? AI_COURSE_PREMIUM_MONTHLY_LIMIT : AI_COURSE_FREE_MONTHLY_LIMIT
    const limitUsed = await aiCoursesRepository.countCreatedThisMonth(userId)

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      limit: { used: limitUsed, total: limitTotal, premium },
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        topic: c.topic,
        inputKind: c.inputKind,
        language: c.language,
        totalLessons: aiCourseLessonCount(c.payload),
        completedLessons: c.completedLessons,
        createdAt: c.createdAt,
      })),
    })
  }),
)

// ── GET /api/ai-courses/:id ──────────────────────────────────────────────────
router.get(
  '/ai-courses/:id',
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const id = parseCourseId(req.params.id)
    const course = await aiCoursesRepository.getById(id)
    // Faqat egasi (private kurslar — MVP'da public explore YO'Q)
    if (!course || course.userId !== userId) throw new AppError(404, 'COURSE_NOT_FOUND')

    const progress = await aiCoursesRepository.getProgressMap(id, userId)

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({
      ok: true,
      course: {
        id: course.id,
        title: course.title,
        topic: course.topic,
        inputKind: course.inputKind,
        lessonLength: course.lessonLength,
        language: course.language,
        totalLessons: aiCourseLessonCount(course.payload),
        completedLessons: progress.size,
        completedLessonIds: [...progress.keys()],
        createdAt: course.createdAt,
        ...toPublicCoursePayload(course.payload),
      },
    })
  }),
)

// ── DELETE /api/ai-courses/:id ──────────────────────────────────────────────
router.delete(
  '/ai-courses/:id',
  rateLimit({
    maxPerMinute: 10,
    bucket: 'ai-course-delete',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ params: CourseParamsSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const id = parseCourseId(req.params.id)
    const deleted = await aiCoursesRepository.deleteCourse(id, userId)
    if (!deleted) throw new AppError(404, 'COURSE_NOT_FOUND')
    res.json({ ok: true })
  }),
)

// ── POST /api/ai-courses/:id/lessons/:lessonId/complete ──────────────────────
router.post(
  '/ai-courses/:id/lessons/:lessonId/complete',
  rateLimit({
    maxPerMinute: 20,
    bucket: 'ai-course-complete',
    keyFn: (request) => (request as { userId?: string }).userId ?? request.ip,
  }),
  validate({ params: LessonParamsSchema, body: AiCourseCompleteSchema }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const courseId = parseCourseId(req.params.id)
    const { lessonId } = req.params as { lessonId: string }
    const { answers, clientToken } = req.body as z.infer<typeof AiCourseCompleteSchema>

    const course = await aiCoursesRepository.getById(courseId)
    if (!course || course.userId !== userId) throw new AppError(404, 'COURSE_NOT_FOUND')

    // DB payload har doim javob kalitli (server-side); sxema — data integrity darvozasi
    const parsed = AiCoursePayloadSchema.safeParse(course.payload)
    if (!parsed.success) throw new AppError(500, 'COURSE_DATA_ERROR')
    const found = findCourseLesson(parsed.data, lessonId)
    if (!found) throw new AppError(404, 'LESSON_NOT_FOUND')
    const lesson = found.lesson
    if (!isLessonFullyAnswered(lesson.practices, answers)) {
      throw new AppError(400, 'LESSON_INCOMPLETE')
    }

    // Idempotency fast-path: allaqachon yakunlangan — saqlangan natija
    const existing = await aiCoursesRepository.getProgress(courseId, lessonId, userId)
    if (existing) {
      res.json({
        ok: true, duplicate: true, grading: existing.grading,
        coinsAwarded: existing.coinsAwarded,
      })
      return
    }

    const grading = gradeCoursePractices(lesson.practices, answers)
    const result = await aiCoursesRepository.completeLesson({
      courseId, lessonId, userId, answers, grading, clientToken,
    })

    if (result.status === 'already_completed') {
      const winner = await aiCoursesRepository.getProgress(courseId, lessonId, userId)
      if (!winner) throw new AppError(500, 'PROGRESS_STATE_ERROR')
      res.json({
        ok: true, duplicate: true, grading: winner.grading,
        coinsAwarded: winner.coinsAwarded,
      })
      return
    }

    res.json({
      ok: true,
      duplicate: false,
      grading,
      coinsAwarded: AI_COURSE_COINS_PER_LESSON,
      balance: result.balance,
      // Reveal: yakunlangach bilim kartalari + to'g'ri javoblar o'z egasiga
      knowledgeCards: lesson.knowledgeCards,
      lesson: toPublicCourseLesson(lesson),
    })
  }),
)

// ── GOLDEN COURSE PIPELINE (Flagship 7-Step Autonomous Production) ───────────

router.post(
  '/ai-courses/golden-run',
  rateLimit({
    bucket: 'ai_course_golden_run',
    maxPerMinute: 5,
    keyFn: (req: Request) => (req as { userId?: string }).userId ?? req.ip,
  }),
  validate({ body: GoldenCourseRequestSchema }),
  wrap(async (req, res) => {
    requireUserId(req)
    const { run, payload } = await executeGoldenCoursePipeline(req.body)
    res.json({ ok: true, run, payload })
  }),
)

router.post(
  '/ai-courses/golden-update',
  rateLimit({
    bucket: 'ai_course_golden_update',
    maxPerMinute: 10,
    keyFn: (req: Request) => (req as { userId?: string }).userId ?? req.ip,
  }),
  validate({
    body: z.object({
      request: GoldenCourseRequestSchema,
      run: GoldenCourseRunSchema,
      stepId: z.enum(GOLDEN_COURSE_STEP_ORDER),
      instruction: z.string().max(1000),
    }),
  }),
  wrap(async (req, res) => {
    requireUserId(req)
    const updatedRun = await updateGoldenCourseStep(req.body)
    res.json({ ok: true, run: updatedRun })
  }),
)

router.post(
  '/ai-courses/golden-publish',
  rateLimit({
    bucket: 'ai_course_golden_publish',
    maxPerMinute: 5,
    keyFn: (req: Request) => (req as { userId?: string }).userId ?? req.ip,
  }),
  validate({ body: z.object({ run: GoldenCourseRunSchema }) }),
  wrap(async (req, res) => {
    const userId = requireUserId(req)
    const payload = convertGoldenCourseToAiCoursePayload(req.body.run)
    const title = req.body.run.finalCourse.name
    const row = await aiCoursesRepository.createCourse({
      userId,
      title,
      data: {
        topic: title,
        inputKind: 'topic',
        inputRef: '',
        lessonLength: 'standard',
        language: 'uz',
        learningGoal: req.body.run.normalizedBrief,
      },
      payload,
    })
    res.status(201).json({ ok: true, course: row })
  }),
)

export default router
