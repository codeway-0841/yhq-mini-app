/**
 * Progress repository — DB access for the `progress` table.
 */

import { eq, sql } from 'drizzle-orm'
import { db }                  from '../../db/connection'
import { progress }            from '../../schema'

export const progressRepository = {
  async ensureExists(userId: bigint): Promise<void> {
    await db.insert(progress).values({ userId }).onConflictDoNothing()
  },

  async findByUserId(userId: bigint) {
    const [row] = await db.select().from(progress).where(eq(progress.userId, userId))
    return row ?? null
  },

  /**
   * Test javobini yozish — BITTA atomik SQL statement'da (CTE):
   *  1) progress counterlari (total/streak/wrongByTicket) — race-safe inkrement;
   *  2) shu kuning daily_records qatori (+1 javob);
   *  3) daily_streaks seriyasi (premium "freeze" logikasi bilan).
   * Streka/streak SQL semantikasi daily.repository.touchActivity bilan bir xil —
   * o'zgarish kiritilsa ikkalasini ham yangilash shart.
   *
   * Semantika: wrong_by_ticket — "hozirgi yechilmagan xatolar".
   *  - xato javob  → hisoblagich +1
   *  - to'g'ri javob → xato tuzatilgan, kalit jsonb'dan o'chiriladi (`-` operatori)
   *
   * `updated=false` bo'lsa progress qatori (va user) yo'q — daily yozuvlar
   * ham yozilmaydi va router 404 qaytaradi (eski behavior bilan bir xil).
   */
  async recordAnswer(input: {
    userId:     bigint
    correct:    boolean
    questionId: number | null
    date:       string
    subjectId:  string
  }): Promise<{ updated: boolean; dailyStreak: number | null }> {
    const { userId, correct, questionId, date, subjectId } = input
    const qKey = questionId !== null ? String(questionId) : null
    const qPath = questionId !== null ? `{${questionId}}` : null
    const correctDelta = correct ? 1 : 0
    const wrongDelta   = correct ? 0 : 1

    const result = await db.execute(sql<{ prog_updated: number; daily_streak: number }>`
      WITH entitlement AS (
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
            WHEN ${qKey}::text IS NULL THEN wrong_by_ticket
            WHEN ${correct} THEN wrong_by_ticket - ${qKey}::text
            ELSE jsonb_set(
              wrong_by_ticket,
              ${qPath}::text[],
              (COALESCE((wrong_by_ticket->>${qKey}::text)::int, 0) + 1)::text::jsonb
            )
          END,
          updated_at = now()
        WHERE user_id = ${userId}
        RETURNING id
      ), record_upsert AS (
        -- Progress qatori (=> user) mavjud bo'lgandagina kunlik yozuv yoziladi:
        // ro'yxatdan o'tmagan usulda FK violation o'rniga toza "not found" qaytadi.
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
          last_daily_date = GREATEST(daily_streaks.last_daily_date, EXCLUDED.last_daily_date),
          updated_at = now()
        RETURNING streak
      )
      SELECT
        (SELECT COUNT(*)::int FROM prog) AS prog_updated,
        (SELECT streak::int FROM streak_upsert) AS daily_streak
    `)

    const row = result.rows[0]
    const updated = Number(row?.prog_updated) > 0
    const streakRaw = row?.daily_streak
    // updated=false → daily_yozuvlar yozilmagan, streak NULL qoladi — router 404 qaytaradi.
    const dailyStreak = streakRaw == null ? null : Number(streakRaw)
    if (updated && !Number.isFinite(dailyStreak)) throw new Error('recordAnswer returned no streak value')
    return { updated, dailyStreak }
  },

  /** Oktagon (PvP) g'alabasi — WS server match yakunida chaqiradi (Yutuqlar uchun) */
  async addOctagonWin(userId: bigint): Promise<void> {
    await db.update(progress).set({
      octagonWins: sql`octagon_wins + 1`,
      updatedAt:   new Date(),
    }).where(eq(progress.userId, userId))
  },

  async reset(userId: bigint): Promise<void> {
    await db.update(progress).set({
      totalCorrect:  0,
      totalWrong:    0,
      totalAnswered: 0,
      streak:        0,
      wrongByTicket: {},
      updatedAt:     new Date(),
    }).where(eq(progress.userId, userId))
  },
}
