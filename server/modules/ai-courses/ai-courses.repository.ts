/**
 * AI Kurslar repository — DB qatlami.
 *
 * XAVFSIZLIK MODELI (ai-tests.repository.ts pattern'i):
 *  - 1 dars = 1 yozuv: uq_ai_course_progress_lesson + `ON CONFLICT DO NOTHING`
 *    (unique insertion lock) — parallel complete'lar serialize, mag'lub
 *    'already_completed' oladi va saqlangan grading qaytariladi.
 *  - Coin mint FAQAT complete CTE'da: award INSERT faqat progress INSERT
 *    g'olibiga + coins>0; ledger reason 'ai_course' + ref UNIQUE.
 *  - payload (javob kalitlari) bu qatlamdan tashqariga FAQAT router orqali
 *    toPublicCoursePayload()/toPublicCourseLesson() dan o'tib chiqadi.
 *  - Oylik limit: joriy Tashkent oyi bo'yicha COUNT (counter jadvali yo'q).
 */

import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { tashkentDate } from '../../utils/date'
import {
  AI_COURSE_COINS_PER_LESSON,
  AI_COURSE_LEDGER_REASON,
  aiCourseLedgerRef,
  type AiCourseAnswers,
  type AiCourseCreateInput,
  type AiCourseGrading,
  type AiCoursePayload,
} from '../../../shared/ai-courses'

export interface AiCourseRow {
  id: number
  userId: string
  title: string
  topic: string
  inputKind: string
  inputRef: string
  lessonLength: string
  language: string
  payload: AiCoursePayload
  createdAt: string
}

export interface AiCourseProgressRow {
  id: number
  courseId: number
  lessonId: string
  userId: string
  answers: AiCourseAnswers
  grading: AiCourseGrading
  scoreCorrect: number
  scoreTotal: number
  coinsAwarded: number
  clientToken: string
  completedAt: string
}

function mapCourse(r: Record<string, unknown>): AiCourseRow {
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    topic: String(r.topic),
    inputKind: String(r.input_kind),
    inputRef: String(r.input_ref ?? ''),
    lessonLength: String(r.lesson_length),
    language: String(r.language),
    payload: r.payload as AiCoursePayload,
    createdAt: String(r.created_at),
  }
}

function mapProgress(r: Record<string, unknown>): AiCourseProgressRow {
  return {
    id: Number(r.id),
    courseId: Number(r.course_id),
    lessonId: String(r.lesson_id),
    userId: String(r.user_id),
    answers: r.answers as AiCourseAnswers,
    grading: r.grading as AiCourseGrading,
    scoreCorrect: Number(r.score_correct),
    scoreTotal: Number(r.score_total),
    coinsAwarded: Number(r.coins_awarded),
    clientToken: String(r.client_token),
    completedAt: String(r.completed_at),
  }
}

/** 'YYYY-MM' (Tashkent) — oylik limit oynasi */
function currentMonthKey(): string {
  return tashkentDate().slice(0, 7)
}

export const aiCoursesRepository = {
  /** Joriy oyda user yaratgan kurslar soni (limit tekshiruvi uchun) */
  async countCreatedThisMonth(userId: string): Promise<number> {
    const month = currentMonthKey()
    const rows = await executeRows<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM ai_courses
      WHERE user_id = ${userId}
        AND to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM') = ${month}
    `)
    return Number(rows[0]?.n ?? 0)
  },

  async createCourse(input: {
    userId: string
    title: string
    data: AiCourseCreateInput
    payload: AiCoursePayload
  }): Promise<AiCourseRow> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      INSERT INTO ai_courses (user_id, title, topic, input_kind, input_ref, lesson_length, language, payload)
      VALUES (
        ${input.userId}, ${input.title}, ${input.data.topic},
        ${input.data.inputKind}, ${input.data.inputRef},
        ${input.data.lessonLength}, ${input.data.language},
        ${JSON.stringify(input.payload)}::jsonb
      )
      RETURNING id, user_id, title, topic, input_kind, input_ref, lesson_length, language, payload, created_at
    `)
    if (!rows[0]) throw new Error('AI course insert failed')
    return mapCourse(rows[0])
  },

  /** Faqat O'Z kurslarim (hub ro'yxati — eng yangisi birinchi) */
  async listMine(userId: string, limit = 50): Promise<AiCourseRow[]> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, user_id, title, topic, input_kind, input_ref, lesson_length, language, payload, created_at
      FROM ai_courses
      WHERE user_id = ${userId}
      ORDER BY id DESC
      LIMIT ${limit}
    `)
    return rows.map(mapCourse)
  },

  /** Hub ro'yxati: kurs meta + yakunlangan dars soni (bitta query) */
  async listMineWithProgress(userId: string, limit = 50): Promise<
    Array<AiCourseRow & { completedLessons: number }>
  > {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT c.id, c.user_id, c.title, c.topic, c.input_kind, c.input_ref,
             c.lesson_length, c.language, c.payload, c.created_at,
             COUNT(p.id)::int AS completed_lessons
      FROM ai_courses c
      LEFT JOIN ai_course_progress p
        ON p.course_id = c.id AND p.user_id = ${userId}
      WHERE c.user_id = ${userId}
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT ${limit}
    `)
    return rows.map((r) => ({ ...mapCourse(r), completedLessons: Number(r.completed_lessons ?? 0) }))
  },

  async getById(id: number): Promise<AiCourseRow | null> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, user_id, title, topic, input_kind, input_ref, lesson_length, language, payload, created_at
      FROM ai_courses WHERE id = ${id}
    `)
    return rows[0] ? mapCourse(rows[0]) : null
  },

  /** Kurs bo'yicha mening yakunlangan darslarim (lessonId → progress) */
  async getProgressMap(courseId: number, userId: string): Promise<Map<string, AiCourseProgressRow>> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, course_id, lesson_id, user_id, answers, grading,
             score_correct, score_total, coins_awarded, client_token, completed_at
      FROM ai_course_progress
      WHERE course_id = ${courseId} AND user_id = ${userId}
    `)
    return new Map(rows.map((r) => {
      const p = mapProgress(r)
      return [p.lessonId, p] as const
    }))
  },

  async getProgress(courseId: number, lessonId: string, userId: string): Promise<AiCourseProgressRow | null> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, course_id, lesson_id, user_id, answers, grading,
             score_correct, score_total, coins_awarded, client_token, completed_at
      FROM ai_course_progress
      WHERE course_id = ${courseId} AND lesson_id = ${lessonId} AND user_id = ${userId}
    `)
    return rows[0] ? mapProgress(rows[0]) : null
  },

  /**
   * Darsni yakunlash + coin mint — BITTA atomik CTE
   * (ai-tests submitAttempt pattern'i 1:1).
   */
  async completeLesson(input: {
    courseId: number; lessonId: string; userId: string
    answers: AiCourseAnswers; grading: AiCourseGrading; clientToken: string
  }): Promise<
    | { status: 'ok'; balance: number }
    | { status: 'already_completed' }
  > {
    const coins = AI_COURSE_COINS_PER_LESSON
    const refId = aiCourseLedgerRef(input.courseId, input.lessonId, input.userId)
    const rows = await executeRows<{
      inserted: boolean; balance: number | null; current_balance: number | null
    }>(sql`
      WITH progress AS (
        INSERT INTO ai_course_progress
          (course_id, lesson_id, user_id, answers, grading, score_correct, score_total, coins_awarded, client_token)
        VALUES (
          ${input.courseId}, ${input.lessonId}, ${input.userId},
          ${JSON.stringify(input.answers)}::jsonb, ${JSON.stringify(input.grading)}::jsonb,
          ${input.grading.correctCount}::int, ${input.grading.totalCount}::int,
          ${coins}::int, ${input.clientToken}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      ), award AS (
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT ${input.userId}, ${coins}::int, now()
        WHERE EXISTS (SELECT 1 FROM progress) AND ${coins}::int > 0
          AND EXISTS (SELECT 1 FROM users WHERE id = ${input.userId})
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance + ${coins}::int,
          updated_at = now()
        RETURNING balance
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${input.userId}, ${coins}::int, ${AI_COURSE_LEDGER_REASON}, ${refId}
        WHERE EXISTS (SELECT 1 FROM award)
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM progress) AS inserted,
        (SELECT balance::int FROM award) AS balance,
        (SELECT balance::int FROM user_coins WHERE user_id = ${input.userId}) AS current_balance
    `)
    const row = rows[0]
    if (!row?.inserted) return { status: 'already_completed' }
    return { status: 'ok', balance: Number(row.balance ?? row.current_balance ?? 0) }
  },
}
