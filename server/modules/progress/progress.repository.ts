/**
 * Progress repository — DB access for the `progress` table.
 */

import { eq, sql } from 'drizzle-orm'
import { db, executeRows }     from '../../db/connection'
import { progress }            from '../../schema'

/**
 * H-3 (audit, TODO H4 variant 1 — kunlik kredit): bitta user kuniga shu
 * miqdordan ortiq javob BALL-counterlariga YOZILMAYDI (answered/correct/
 * streak/daily_records — League score manbai). Farming qiymati kuniga cheklangan
 * (haftada ×7), legit o'quvchi (marathon ham) 1000/javob'ga kamdan-kam yetadi.
 * Jimgina cap: javob "duplicate" no-op sifatida qaytariladi (xato YO'Q).
 */
export const DAILY_ANSWER_CREDIT = 1000

export const progressRepository = {
  async ensureExists(userId: string): Promise<void> {
    await db.insert(progress).values({ userId }).onConflictDoNothing()
  },

  async findByUserId(userId: string) {
    const [row] = await db.select().from(progress).where(eq(progress.userId, userId))
    return row ?? null
  },

  /**
   * Test javobini yozish — BITTA atomik SQL statement'da (CTE):
   *  1) idempotency token (clientToken) — replay counterlarni qayta yozmaydi;
   *  2) progress counterlari (total/streak/wrongByTicket) — race-safe inkrement;
   *  3) shu kuning daily_records qatori (+1 javob);
   *  4) daily_streaks seriyasi (premium "freeze" logikasi bilan).
   * Streka/streak SQL semantikasi daily.repository.touchActivity bilan bir xil —
   * o'zgarish kiritilsa ikkalasini ham yangilash shart.
   *
   * Semantika: wrong_by_ticket — "hozirgi yechilmagan xatolar".
   *  - xato javob  → hisoblagich +1
   *  - to'g'ri javob → xato tuzatilgan, kalit jsonb'dan o'chiriladi (`-` operatori)
   *
   * `updated=false` bo'lsa progress qatori (va user) yo'q — daily yozuvlar
   * ham yozilmaydi va router 404 qaytaradi (eski behavior bilan bir xil).
   * `duplicate=true` — shu clientToken allaqachon qabul qilingan: hech narsa
   * yozilmadi, lekin bu IDEMPOTENT muvaffaqiyat (router 200 + eski natija).
   */
  async recordAnswer(input: {
    userId:       string
    correct:      boolean
    questionId:   number | null
    date:         string
    subjectId:    string
    clientToken?: string
  }): Promise<{ updated: boolean; dailyStreak: number | null; duplicate: boolean }> {
    const { userId, correct, questionId, date, subjectId, clientToken } = input
    const token = clientToken ?? null
    // Multi-fan identity: kalit `${subjectId}:${questionId}` formatida —
    // fanlar orasida xato qaydlari chalkashmaydi.
    const qKey = questionId !== null ? `${subjectId}:${questionId}` : null
    const qPath = questionId !== null ? `{${subjectId}:${questionId}}` : null
    const correctDelta = correct ? 1 : 0
    const wrongDelta   = correct ? 0 : 1

    const rows = await executeRows<{ proceed: boolean; prog_updated: number; daily_streak: number }>(sql`
      WITH tok AS (
        -- Token user mavjud bo'lgandagina yaratiladi (FK himoyasi):
        -- ghost user'ning birinchi so'rovi ham "duplicate" emas, "not found".
        INSERT INTO answer_tokens (token, user_id)
        SELECT ${token}::text, ${userId}
        WHERE ${token}::text IS NOT NULL
          AND EXISTS (SELECT 1 FROM users WHERE id = ${userId})
        ON CONFLICT (token) DO NOTHING
        RETURNING token
      ), credit AS (
        -- H-3: kunlik javob krediti tugaganda keyingi yozuvlar jimgina no-op
        -- (bola ball farming'ni kunlik qiymatga qattiqlaydi; daily_records
        -- shu statement'dan OLDINGI holatda o'qiladi — snapshot izolyatsiyasi).
        SELECT (
          COALESCE(SUM(answered), 0) < ${DAILY_ANSWER_CREDIT}::int
        ) AS ok
        FROM daily_records
        WHERE user_id = ${userId} AND date = ${date}
      ), gate AS (
        SELECT (
          -- 1) clientToken replay YOKI token yo'q — o'tadi;
          (${token}::text IS NULL OR EXISTS (SELECT 1 FROM tok))
          -- 2) ANTI-FARM: ilgari TO'G'RI javob berilgan savolga takroriy
          --    to'g'ri javob counterlarga YOZILMAYDI. P2 (audit): gate endi
          --    progress_questions jadvaliga tayanadi (jsonb correct_questions
          --    o'rniga O(1) index EXISTS — quadratic rewrite yo'q).
          AND NOT (
            ${correct}
            AND ${questionId}::int IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM progress_questions pq
              WHERE pq.user_id = ${userId}
                AND pq.subject_id = ${subjectId}
                AND pq.question_id = ${questionId}::int
                AND pq.correct
            )
          )
          -- 3) H-3: kunlik kredit (DAILY_ANSWER_CREDIT) — farming kunlik chegarasi
          AND (SELECT ok FROM credit)
        ) AS proceed
      ), entitlement AS (
        SELECT (
          tariff = 'premium'
          OR (premium_until IS NOT NULL AND premium_until > now())
        ) AS premium
        FROM users
        WHERE id = ${userId}
      ), prog AS (
        UPDATE progress SET
          total_correct  = total_correct + ${correctDelta},
          total_wrong    = total_wrong + ${wrongDelta},
          total_answered = total_answered + 1,
          streak         = CASE WHEN ${correct} THEN streak + 1 ELSE 0 END,
          wrong_by_ticket = CASE
            WHEN ${qKey}::text IS NULL THEN COALESCE(wrong_by_ticket, '{}'::jsonb)
            WHEN ${correct} THEN COALESCE(wrong_by_ticket, '{}'::jsonb) - ${qKey}::text
            ELSE jsonb_set(
              COALESCE(wrong_by_ticket, '{}'::jsonb),
              ${qPath}::text[],
              (COALESCE((COALESCE(wrong_by_ticket, '{}'::jsonb)->>${qKey}::text)::int, 0) + 1)::text::jsonb
            )
          END,
          -- P2: solved/correct jsonb massivlar endi YOZILMAYDI — q_write CTE
          -- progress_questions jadvaliga O(1) upsert qiladi.
          updated_at = now()
        WHERE user_id = ${userId} AND (SELECT proceed FROM gate)
        RETURNING id
      ), q_write AS (
        -- P2: yechilgan savol qaydini jadvalga O(1) upsert (jsonb massiv o'rniga).
        -- correct bir marta true bo'lsa orqaga qaytmaydi (anti-farm gate manbai).
        INSERT INTO progress_questions (user_id, subject_id, question_id, correct, answered_at)
        SELECT ${userId}, ${subjectId}, ${questionId}::int, ${correct}::boolean, now()
        WHERE ${questionId}::int IS NOT NULL
          AND EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, subject_id, question_id) DO UPDATE
          SET correct = progress_questions.correct OR EXCLUDED.correct,
              answered_at = now()
        RETURNING user_id
      ), record_upsert AS (
        -- Progress qatori (=> user) mavjud bo'lgandagina kunlik yozuv yoziladi:
        -- ro'yxatdan o'tmagan usulda FK violation o'rniga toza "not found" qaytadi.
        INSERT INTO daily_records (user_id, date, subject_id, answered, correct, fixed)
        SELECT ${userId}, ${date}, ${subjectId}, 1, ${correctDelta}, 0
        WHERE EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, date, subject_id) DO UPDATE SET
          answered = daily_records.answered + EXCLUDED.answered,
          correct = daily_records.correct + EXCLUDED.correct
        RETURNING id
      ), streak_upsert AS (
        INSERT INTO daily_streaks (user_id, subject_id, streak, last_daily_date, updated_at)
        SELECT ${userId}, ${subjectId}, 1, ${date}, now()
        WHERE EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, subject_id) DO UPDATE SET
          streak = CASE
            WHEN daily_streaks.last_daily_date >= EXCLUDED.last_daily_date
              THEN daily_streaks.streak
            WHEN daily_streaks.last_daily_date = to_char(EXCLUDED.last_daily_date::date - 1, 'YYYY-MM-DD')
              THEN daily_streaks.streak + 1
            WHEN COALESCE((SELECT premium FROM entitlement), false)
              AND daily_streaks.last_daily_date = to_char(EXCLUDED.last_daily_date::date - 2, 'YYYY-MM-DD')
              THEN daily_streaks.streak + 1
            ELSE 1
          END,
          last_daily_date = GREATEST(COALESCE(daily_streaks.last_daily_date, EXCLUDED.last_daily_date), EXCLUDED.last_daily_date),
          updated_at = now()
        RETURNING streak
      )
      SELECT
        (SELECT proceed FROM gate) AS proceed,
        (SELECT COUNT(*)::int FROM prog) AS prog_updated,
        (SELECT streak::int FROM streak_upsert) AS daily_streak
    `)

    const row = rows[0]
    const proceed = row?.proceed !== false
    if (!proceed) {
      // Token replay (duplicate) YOKI user/progress yo'q — farqlaymiz:
      const existing = await this.findByUserId(userId)
      if (!existing) return { updated: false, dailyStreak: null, duplicate: false }
      return { updated: true, dailyStreak: null, duplicate: true }
    }
    const updated = Number(row?.prog_updated) > 0
    const streakRaw = row?.daily_streak
    const dailyStreak = streakRaw != null && Number.isFinite(Number(streakRaw)) ? Number(streakRaw) : (updated ? 1 : null)
    return { updated, dailyStreak, duplicate: false }
  },

  /** Oktagon (PvP) g'alabasi — WS server match yakunida chaqiradi (Yutuqlar uchun) */
  async addOctagonWin(userId: string): Promise<void> {
    await db.update(progress).set({
      octagonWins: sql`octagon_wins + 1`,
      updatedAt:   new Date(),
    }).where(eq(progress.userId, userId))
  },

  /** Profil API uchun yechilgan savollar ro'yxati (`${subjectId}:${questionId}` format — client kontrakti o'zgarmaydi) */
  async listSolvedKeys(userId: string): Promise<string[]> {
    const rows = await executeRows<{ k: string }>(sql`
      SELECT subject_id || ':' || question_id AS k
      FROM progress_questions
      WHERE user_id = ${userId}
    `)
    return rows.map((r) => r.k)
  },

  async reset(userId: string): Promise<void> {
    // P2: progress_questions jadvali ham tozalanadi (jsonb ustunlar bilan birga)
    await executeRows(sql`DELETE FROM progress_questions WHERE user_id = ${userId}`)
    await db.update(progress).set({
      totalCorrect:    0,
      totalWrong:      0,
      totalAnswered:   0,
      streak:          0,
      wrongByTicket:   {},
      solvedQuestions: [],
      correctQuestions: [],
      updatedAt:       new Date(),
    }).where(eq(progress.userId, userId))
  },

  /**
   * SR dashboard xulosasi (FIXPLAN #46) — "bugun tayyorlar" soni va prognoz.
   * Bitta GROUP BY'siz aggregate scan (idx_card_user_subject): karta soni
   * savollar sonidan oshmaydi — arzon.
   */
  async getCardsSummary(userId: string, subjectId: string): Promise<{
    total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null
  }> {
    const rows = await executeRows<{
      total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null
    }>(sql`
      SELECT
        COUNT(*)::int AS "total",
        -- EKSKLYUZIV oynalar: dueNow + dueNext24h + dueNext7d = 7 kunlik jami
        -- (kumulativ bo'lsa UI'dagi uchala son qo'shilganda adashtirardi)
        COUNT(*) FILTER (WHERE due_at <= now())::int AS "dueNow",
        COUNT(*) FILTER (WHERE due_at > now() AND due_at <= now() + interval '24 hours')::int AS "dueNext24h",
        COUNT(*) FILTER (WHERE due_at > now() + interval '24 hours' AND due_at <= now() + interval '7 days')::int AS "dueNext7d",
        ROUND(AVG(ef)::numeric, 2)::float AS "avgEf"
      FROM card_progress
      WHERE user_id = ${userId} AND subject_id = ${subjectId}
    `)
    return rows[0] ?? { total: 0, dueNow: 0, dueNext24h: 0, dueNext7d: 0, avgEf: null }
  },

  /** Moslashuvchan rejim (Spaced Repetition) kartalarini yuklash */
  async getCards(userId: string, subjectId: string) {
    const { cardProgress } = await import('../../schema')
    const { and } = await import('drizzle-orm')
    return db
      .select({
        questionId: cardProgress.questionId,
        ef:         cardProgress.ef,
        interval:   cardProgress.interval,
        reps:       cardProgress.reps,
        dueAt:      cardProgress.dueAt,
      })
      .from(cardProgress)
      .where(and(eq(cardProgress.userId, userId), eq(cardProgress.subjectId, subjectId)))
  },

  /** Moslashuvchan rejim kartasini yangilash (upsert) */
  async upsertCard(input: {
    userId:     string
    subjectId:  string
    questionId: number
    ef:         number
    interval:   number
    reps:       number
    dueAt:      Date
  }): Promise<void> {
    const { cardProgress } = await import('../../schema')
    await db
      .insert(cardProgress)
      .values({
        userId:     input.userId,
        subjectId:  input.subjectId,
        questionId: input.questionId,
        ef:         input.ef,
        interval:   input.interval,
        reps:       input.reps,
        dueAt:      input.dueAt,
      })
      .onConflictDoUpdate({
        target: [cardProgress.userId, cardProgress.subjectId, cardProgress.questionId],
        set: {
          ef:        input.ef,
          interval:  input.interval,
          reps:      input.reps,
          dueAt:     input.dueAt,
          updatedAt: new Date(),
        },
      })
  },
}
