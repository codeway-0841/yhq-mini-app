/**
 * AI Kunlik Test repository — DB qatlami.
 *
 * XAVFSIZLIK MODELI:
 *  - 1 test = 1 urinish: uq_ai_attempt_test_user + `ON CONFLICT DO NOTHING`
 *    (unique insertion lock) — parallel submit'lar serialize, mag'lub
 *    'already_attempted' oladi va saqlangan grading qaytariladi.
 *  - Coin mint FAQAT submit CTE'da: award INSERT faqat attempt INSERT g'olibiga
 *    tegishli; ledger reason 'ai_test' + ref UNIQUE — retry/replay xavfsiz.
 *  - payload (javob kalitlari) bu qatlamdan tashqariga FAQAT router orqali
 *    toPublicAiTest() dan o'tib chiqadi.
 */

import { sql, and, eq, inArray } from 'drizzle-orm'
import { db, executeRows } from '../../db/connection'
import { aiDailyTestAttempts } from '../../schema'
import {
  AI_TEST_LEDGER_REASON,
  aiTestLedgerRef,
  type AiTestAnswers,
  type AiTestGrading,
  type AiTestPayload,
} from '../../../shared/ai-daily-test'

export interface AiDailyTestRow {
  id: number
  subjectId: string
  date: string
  slot: number
  title: string
  payload: AiTestPayload
  createdAt: string
}

export interface AiDailyTestAttemptRow {
  id: number
  testId: number
  userId: string
  answers: AiTestAnswers
  grading: AiTestGrading
  scoreCorrect: number
  essayScore: number
  coinsAwarded: number
  clientToken: string
  createdAt: string
}

function mapTest(r: Record<string, unknown>): AiDailyTestRow {
  return {
    id: Number(r.id),
    subjectId: String(r.subject_id),
    date: String(r.date),
    slot: Number(r.slot),
    title: String(r.title),
    payload: r.payload as AiTestPayload,
    createdAt: String(r.created_at),
  }
}

function mapAttempt(r: Record<string, unknown>): AiDailyTestAttemptRow {
  return {
    id: Number(r.id),
    testId: Number(r.test_id),
    userId: String(r.user_id),
    answers: r.answers as AiTestAnswers,
    grading: r.grading as AiTestGrading,
    scoreCorrect: Number(r.score_correct),
    essayScore: Number(r.essay_score),
    coinsAwarded: Number(r.coins_awarded),
    clientToken: String(r.client_token),
    createdAt: String(r.created_at),
  }
}

export const aiTestsRepository = {
  /** Shu sanadagi barcha variantlar (slot tartibida) */
  async getTestsForDate(subjectId: string, date: string): Promise<AiDailyTestRow[]> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, subject_id, date, slot, title, payload, created_at
      FROM ai_daily_tests
      WHERE subject_id = ${subjectId} AND date = ${date}
      ORDER BY slot
    `)
    return rows.map(mapTest)
  },

  async getTestById(id: number): Promise<AiDailyTestRow | null> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, subject_id, date, slot, title, payload, created_at
      FROM ai_daily_tests WHERE id = ${id}
    `)
    return rows[0] ? mapTest(rows[0]) : null
  },

  /** Scheduler/admin: mavjud bo'lmasa yozadi (ON CONFLICT — idempotent). */
  async insertGeneratedTest(input: {
    subjectId: string; date: string; slot: number; title: string; payload: AiTestPayload
  }): Promise<'inserted' | 'exists'> {
    const rows = await executeRows<{ id: number }>(sql`
      INSERT INTO ai_daily_tests (subject_id, date, slot, title, payload)
      VALUES (${input.subjectId}, ${input.date}, ${input.slot}, ${input.title}, ${JSON.stringify(input.payload)}::jsonb)
      ON CONFLICT (subject_id, date, slot) DO NOTHING
      RETURNING id
    `)
    return rows.length > 0 ? 'inserted' : 'exists'
  },

  async getAttempt(testId: number, userId: string): Promise<AiDailyTestAttemptRow | null> {
    const rows = await executeRows<Record<string, unknown>>(sql`
      SELECT id, test_id, user_id, answers, grading, score_correct, essay_score, coins_awarded, client_token, created_at
      FROM ai_daily_test_attempts
      WHERE test_id = ${testId} AND user_id = ${userId}
    `)
    return rows[0] ? mapAttempt(rows[0]) : null
  },

  /** /today ro'yxati uchun: shu testlar bo'yicha user urinishlari (testId → attempt) */
  async getAttemptsForTests(testIds: number[], userId: string): Promise<Map<number, AiDailyTestAttemptRow>> {
    if (testIds.length === 0) return new Map()
    const rows = await db.select().from(aiDailyTestAttempts)
      .where(and(eq(aiDailyTestAttempts.userId, userId), inArray(aiDailyTestAttempts.testId, testIds)))
    return new Map(rows.map((r) => {
      const a: AiDailyTestAttemptRow = {
        id: r.id, testId: r.testId, userId: r.userId,
        answers: r.answers, grading: r.grading,
        scoreCorrect: r.scoreCorrect, essayScore: r.essayScore,
        coinsAwarded: r.coinsAwarded, clientToken: r.clientToken,
        createdAt: r.createdAt.toISOString(),
      }
      return [a.testId, a]
    }))
  },

  /**
   * Urinishni yozish + coin mint — BITTA atomik CTE:
   *  1) attempt INSERT ON CONFLICT DO NOTHING — 1-urinish strukturaviy cheklovi
   *     (parallel submit'larda faqat g'olib qator oladi)
   *  2) award FAQAT g'olibga + coins>0 (chk_delta_nonzero himoyasi)
   *  3) ledger 'ai_test' + ref UNIQUE — qo'shimcha idempotency qatlami
   */
  async submitAttempt(input: {
    testId: number; userId: string; answers: AiTestAnswers
    grading: AiTestGrading; clientToken: string
  }): Promise<
    | { status: 'ok'; balance: number }
    | { status: 'already_attempted' }
  > {
    const coins = input.grading.coinsAwarded
    const refId = aiTestLedgerRef(input.testId, input.userId)
    const rows = await executeRows<{
      inserted: boolean; balance: number | null; current_balance: number | null
    }>(sql`
      WITH attempt AS (
        INSERT INTO ai_daily_test_attempts
          (test_id, user_id, answers, grading, score_correct, essay_score, coins_awarded, client_token)
        VALUES (
          ${input.testId}, ${input.userId},
          ${JSON.stringify(input.answers)}::jsonb, ${JSON.stringify(input.grading)}::jsonb,
          ${input.grading.correctCount}::int, ${input.grading.essayScore}::int,
          ${coins}::int, ${input.clientToken}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      ), award AS (
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT ${input.userId}, ${coins}::int, now()
        WHERE EXISTS (SELECT 1 FROM attempt) AND ${coins}::int > 0
          AND EXISTS (SELECT 1 FROM users WHERE id = ${input.userId})
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance + ${coins}::int,
          updated_at = now()
        RETURNING balance
      ), ledger AS (
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT ${input.userId}, ${coins}::int, ${AI_TEST_LEDGER_REASON}, ${refId}
        WHERE EXISTS (SELECT 1 FROM award)
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM attempt) AS inserted,
        (SELECT balance::int FROM award) AS balance,
        (SELECT balance::int FROM user_coins WHERE user_id = ${input.userId}) AS current_balance
    `)
    const row = rows[0]
    if (!row?.inserted) return { status: 'already_attempted' }
    return { status: 'ok', balance: Number(row.balance ?? row.current_balance ?? 0) }
  },
}
