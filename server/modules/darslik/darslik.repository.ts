import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, executeRows } from '../../db/connection'
import { darslikChecks, darslikMastery } from '../../schema'
import {
  DARSLIK_CHECK_VERSION,
  DARSLIK_CHECK_VERSIONS,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'
import { XP_DAILY_CAP } from '../../../shared/xp'

export interface StoredDarslikCheck {
  version: number
  payload: DarslikCheck
}

export const darslikRepository = {
  /**
   * O'tilgan mavzular. v1 va v2 birga o'qiladi: versiya ko'tarilganda eski
   * foydalanuvchi progressi yo'qolmaydi va keyingi mavzu qulflanib qolmaydi.
   */
  async passed(userId: string): Promise<string[]> {
    const rows = await db.select({ topicId: darslikMastery.topicId }).from(darslikMastery)
      .where(and(
        eq(darslikMastery.userId, userId),
        inArray(darslikMastery.version, [...DARSLIK_CHECK_VERSIONS]),
      ))
    return [...new Set(rows.map(row => row.topicId))]
  },

  async check(topicId: string, version: number = DARSLIK_CHECK_VERSION) {
    const [row] = await db.select().from(darslikChecks)
      .where(and(eq(darslikChecks.topicId, topicId), eq(darslikChecks.version, version)))
      .limit(1)
    return row?.payload
  },

  /**
   * v2 ni afzal ko'radi, lekin deploy paytida yuklangan v1 darsni ham topadi —
   * foydalanuvchi yarim yo'lda bloklanib qolmasligi uchun.
   */
  async findCheck(topicId: string): Promise<StoredDarslikCheck | null> {
    for (const version of DARSLIK_CHECK_VERSIONS) {
      const payload = await this.check(topicId, version)
      if (payload) return { version, payload }
    }
    return null
  },

  async saveCheck(topicId: string, payload: DarslikCheck): Promise<DarslikCheck> {
    await db.insert(darslikChecks).values({ topicId, version: DARSLIK_CHECK_VERSION, payload }).onConflictDoNothing()
    // Concurrent generators must return the persisted winner, never their losing answer key.
    const saved = await this.check(topicId)
    if (!saved) throw new Error('Darslik check persistence failed')
    return saved
  },

  /**
   * Mastery + XP bitta atomik statementda.
   *
   * XP FAQAT birinchi passda beriladi: darslik_mastery insert'i
   * ON CONFLICT DO NOTHING bo'lgani uchun takroriy submit yoki parallel
   * so'rovlar ikkinchi marta XP yozmaydi. Kunlik shift daily_limits orqali
   * mavjud XP tizimidan olinadi (yangi XP tizimi yaratilmaydi).
   */
  async passWithXp(input: {
    userId: string
    topicId: string
    date: string
    xp: number
  }): Promise<{ passedNow: boolean; xp: number | null; xpEarned: number }> {
    const award = Math.max(0, Math.min(1000, Math.floor(input.xp)))
    const rows = await executeRows<{
      passed_now: boolean
      progress_updated: number
      xp: number | null
      xp_earned: number
    }>(sql`
      WITH pass AS (
        INSERT INTO darslik_mastery (user_id, topic_id, version)
        VALUES (${input.userId}, ${input.topicId}, ${DARSLIK_CHECK_VERSION})
        ON CONFLICT DO NOTHING
        RETURNING topic_id
      ), limits AS (
        SELECT xp_earned FROM daily_limits
        WHERE user_id = ${input.userId} AND date = ${input.date}
      ), xp_award AS (
        SELECT CASE WHEN EXISTS (SELECT 1 FROM pass)
          THEN GREATEST(0, LEAST(
            ${award}::int,
            ${XP_DAILY_CAP}::int - COALESCE((SELECT xp_earned FROM limits), 0)
          ))
          ELSE 0
        END AS amount
      ), prog AS (
        UPDATE progress SET
          xp = xp + (SELECT amount FROM xp_award),
          updated_at = now()
        WHERE user_id = ${input.userId} AND (SELECT amount FROM xp_award) > 0
        RETURNING xp
      ), limits_upsert AS (
        INSERT INTO daily_limits (user_id, date, xp_earned, coins_earned, updated_at)
        SELECT ${input.userId}, ${input.date}, (SELECT amount FROM xp_award), 0, now()
        WHERE (SELECT amount FROM xp_award) > 0
          AND EXISTS (SELECT 1 FROM prog)
        ON CONFLICT (user_id, date) DO UPDATE SET
          xp_earned = daily_limits.xp_earned + EXCLUDED.xp_earned,
          updated_at = now()
        RETURNING xp_earned
      )
      SELECT
        EXISTS (SELECT 1 FROM pass) AS passed_now,
        (SELECT COUNT(*)::int FROM prog) AS progress_updated,
        (SELECT xp::int FROM prog) AS xp,
        (SELECT amount::int FROM xp_award) AS xp_earned
    `)
    const row = rows[0]
    const progressUpdated = Number(row?.progress_updated ?? 0) > 0
    return {
      passedNow: row?.passed_now === true,
      xp: row?.xp != null ? Number(row.xp) : null,
      xpEarned: progressUpdated && row?.xp_earned != null ? Number(row.xp_earned) : 0,
    }
  },
}
