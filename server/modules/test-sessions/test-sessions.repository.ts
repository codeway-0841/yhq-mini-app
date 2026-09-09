import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db, executeRows, type DB } from '../../db/connection'
import { questions, savedQuestions, testAttempts, testSessions } from '../../schema'

export type TestSessionRow = typeof testSessions.$inferSelect
export type TestAttemptRow = typeof testAttempts.$inferSelect

export interface SessionQuestionRow {
  id: number
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  image: string | null
  topicId: number | null
  correctAnswer: string
}

export const testSessionsRepository = {
  async create(values: typeof testSessions.$inferInsert, txOrDb: DB = db): Promise<TestSessionRow> {
    const [row] = await txOrDb.insert(testSessions).values(values).returning()
    if (!row) throw new Error('test_session_insert_failed')
    return row
  },

  /** Bank row SHARE lock: admin CRUD versionni oshirishdan oldin shu rowga
   * FOR UPDATE oladi. Shuning uchun selection/scoring va content mutation
   * bir-birining yarmida ko'rinmaydi. */
  async lockBankVersion(bankId: string, txOrDb: DB): Promise<number | null> {
    const rows = await executeRows<{ contentVersion: number }>(sql`
      SELECT content_version AS "contentVersion"
      FROM question_banks
      WHERE id = ${bankId}
      FOR SHARE
    `, txOrDb)
    return rows[0] ? Number(rows[0].contentVersion) : null
  },

  /** Clientdagi deduplicateQuestions bilan bir xil mazmuniy signature:
   * normal matn + rasm + tartibdan mustaqil variant matnlari. Natijada
   * fizikadagi takroriy bloklar bitta session ichida qayta chiqmaydi. */
  async listQuestionIds(
    bankId: string,
    txOrDb: DB,
    topicId: number | undefined,
    language: 'uz' | 'ru',
  ): Promise<number[]> {
    const questionColumn = language === 'ru' ? sql.raw('q.question_ru') : sql.raw('q.question_uz')
    const optionsColumn = language === 'ru' ? sql.raw('q.options_ru') : sql.raw('q.options_uz')
    const topicFilter = topicId === undefined
      ? sql``
      : sql`AND q.topic_id = ${topicId}
          AND EXISTS (
            SELECT 1 FROM topics t WHERE t.id = q.topic_id AND t.bank_id = ${bankId}
          )`
    const rows = await executeRows<{ id: number }>(sql`
      SELECT MIN(candidate.id)::int AS id
      FROM (
        SELECT q.id, md5(
          regexp_replace(btrim(${questionColumn}), '\\s+', ' ', 'g') || '___' ||
          COALESCE(q.image, '') || '___' ||
          COALESCE((
            SELECT string_agg(
              regexp_replace(btrim(opt.option_value), '\\s+', ' ', 'g'),
              '|||'
              ORDER BY regexp_replace(btrim(opt.option_value), '\\s+', ' ', 'g')
            )
            FROM jsonb_each_text(${optionsColumn}) AS opt(option_key, option_value)
          ), '')
        ) AS content_key
        FROM questions q
        WHERE q.bank_id = ${bankId}
        ${topicFilter}
      ) candidate
      GROUP BY candidate.content_key
      ORDER BY id
    `, txOrDb)
    return rows.map((row) => Number(row.id))
  },

  /** Faqat authenticated userning joriy fan/bank bookmarklari. */
  async listSavedQuestionIds(
    userId: string,
    subjectId: string,
    bankId: string,
    txOrDb: DB,
  ): Promise<number[]> {
    const rows = await txOrDb.select({ id: questions.id })
      .from(savedQuestions)
      .innerJoin(questions, and(
        eq(savedQuestions.questionId, questions.id),
        eq(questions.bankId, bankId),
      ))
      .where(and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.subjectId, subjectId),
      ))
      .orderBy(savedQuestions.id)
    return rows.map((row) => row.id)
  },

  /** `wrong_by_ticket` serverdagi unresolved mistake SSOT: to'g'ri javob
   * berilganda progress CTE kalitni o'chiradi. Raw ID array qabul qilinmaydi. */
  async listMistakeQuestionIds(
    userId: string,
    subjectId: string,
    bankId: string,
    txOrDb: DB,
    topicId?: number,
  ): Promise<number[]> {
    const topicFilter = topicId !== undefined ? sql`AND q.topic_id = ${topicId}` : sql``
    const rows = await executeRows<{ id: number }>(sql`
      SELECT q.id::int AS id
      FROM progress p
      CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.wrong_by_ticket, '{}'::jsonb)) mistake
      JOIN questions q
        ON mistake.key = ${subjectId} || ':' || q.id::text
       AND q.bank_id = ${bankId}
       ${topicFilter}
      WHERE p.user_id = ${userId}
        AND mistake.value::int > 0
      ORDER BY q.id
    `, txOrDb)
    return rows.map((row) => Number(row.id))
  },

  async lockOwned(sessionId: string, userId: string, txOrDb: DB): Promise<TestSessionRow | null> {
    const rows = await executeRows<TestSessionRow>(sql`
      SELECT
        id,
        user_id AS "userId",
        subject_id AS "subjectId",
        bank_id AS "bankId",
        mode,
        selector,
        selection_seed AS "selectionSeed",
        bank_version AS "bankVersion",
        question_ids AS "questionIds",
        total_questions AS "totalQuestions",
        issued_through AS "issuedThrough",
        answered_count AS "answeredCount",
        status,
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        last_active_at AS "lastActiveAt"
      FROM test_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
      FOR UPDATE
    `, txOrDb)
    return rows[0] ?? null
  },

  async listAttempts(sessionId: string, txOrDb: DB = db): Promise<TestAttemptRow[]> {
    return txOrDb.select().from(testAttempts)
      .where(eq(testAttempts.sessionId, sessionId))
      .orderBy(testAttempts.position)
  },

  async findAttempt(
    sessionId: string,
    userId: string,
    position: number,
    clientToken: string,
    txOrDb: DB,
  ): Promise<TestAttemptRow | null> {
    const [row] = await txOrDb.select().from(testAttempts).where(and(
      eq(testAttempts.userId, userId),
      or(
        and(eq(testAttempts.sessionId, sessionId), eq(testAttempts.position, position)),
        eq(testAttempts.clientToken, clientToken),
      ),
    ))
    return row ?? null
  },

  async insertAttempt(values: typeof testAttempts.$inferInsert, txOrDb: DB): Promise<TestAttemptRow> {
    const [row] = await txOrDb.insert(testAttempts).values(values).returning()
    if (!row) throw new Error('test_attempt_insert_failed')
    return row
  },

  async completeAttempt(id: number, resultPayload: Record<string, unknown>, txOrDb: DB): Promise<void> {
    await txOrDb.update(testAttempts).set({ resultPayload }).where(eq(testAttempts.id, id))
  },

  async updateProgress(
    sessionId: string,
    values: { issuedThrough: number; answeredCount: number; status?: string },
    txOrDb: DB,
  ): Promise<void> {
    await txOrDb.update(testSessions).set({
      issuedThrough: values.issuedThrough,
      answeredCount: values.answeredCount,
      lastActiveAt: new Date(),
      ...(values.status ? { status: values.status } : {}),
    }).where(eq(testSessions.id, sessionId))
  },

  async setStatus(
    sessionId: string,
    userId: string,
    status: 'completed' | 'abandoned' | 'expired',
    txOrDb: DB = db,
  ): Promise<void> {
    await txOrDb.update(testSessions).set({ status, lastActiveAt: new Date() }).where(and(
      eq(testSessions.id, sessionId),
      eq(testSessions.userId, userId),
    ))
  },

  async getQuestions(ids: number[], bankId: string, txOrDb: DB = db): Promise<SessionQuestionRow[]> {
    if (ids.length === 0) return []
    const rows = await txOrDb.select({
      id: questions.id,
      questionUz: questions.questionUz,
      questionRu: questions.questionRu,
      optionsUz: questions.optionsUz,
      optionsRu: questions.optionsRu,
      image: questions.image,
      topicId: questions.topicId,
      correctAnswer: questions.correctAnswer,
    }).from(questions).where(and(eq(questions.bankId, bankId), inArray(questions.id, ids)))
    return rows
  },
}
