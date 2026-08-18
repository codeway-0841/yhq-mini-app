/**
 * Admin repository — admin.router SQL'lari yagona joyda (repository pattern
 * restavratsiyasi, FIXPLAN #20). Router'da SQL YO'Q — faqat validation +
 * orchestration qoladi.
 */
import { asc, eq, sql } from 'drizzle-orm'
import { db, executeRows } from '../../db/connection'
import { questionBanks, questions, topics } from '../../schema'

export const adminRepository = {
  // ── Sorollar CRUD ──────────────────────────────────────────────────────

  async ensureBank(bankId: string): Promise<void> {
    await db.insert(questionBanks).values({ id: bankId, name: bankId }).onConflictDoNothing()
  },

  /** Keyingi erkin savol id'si (max+1) — race'da caller qayta urinadi (23505) */
  async nextQuestionId(): Promise<number> {
    const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(${questions.id}), 0)` }).from(questions)
    return row.maxId + 1
  },

  async insertQuestion(row: typeof questions.$inferInsert): Promise<number | null> {
    try {
      const [r] = await db.insert(questions).values(row).returning({ id: questions.id })
      return r.id
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') return null   // unique_violation — caller qayta id bilan urinadi
      throw err
    }
  },

  async bulkInsertQuestions(rows: Array<typeof questions.$inferInsert>, chunkSize = 100): Promise<void> {
    for (let i = 0; i < rows.length; i += chunkSize) {
      await db.insert(questions).values(rows.slice(i, i + chunkSize))
    }
  },

  /** Savol + bog'liq yozuvlar BITTA CTE'da (audit: avval 3 alohida DELETE — crash yarim holat qoldirardi) */
  async deleteQuestionCascade(id: number): Promise<boolean> {
    const rows = await executeRows<{ id: number }>(sql`
      WITH s AS (
        DELETE FROM saved_questions WHERE question_id = ${id} RETURNING question_id
      ), e AS (
        DELETE FROM question_explanations WHERE question_id = ${id} RETURNING question_id
      ), q AS (
        DELETE FROM questions WHERE id = ${id} RETURNING id
      )
      SELECT id FROM q
    `)
    return rows.length > 0
  },

  async updateQuestion(id: number, patch: Partial<typeof questions.$inferInsert>): Promise<boolean> {
    const updated = await db.update(questions).set(patch).where(eq(questions.id, id)).returning({ id: questions.id })
    return updated.length > 0
  },

  async listQuestionsByBank(bankId: string) {
    return db.select().from(questions).where(eq(questions.bankId, bankId)).orderBy(asc(questions.id))
  },

  async questionBankMeta(bankId: string): Promise<{ total: number; withTopic: number }> {
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        withTopic: sql<number>`COUNT(${questions.topicId})::int`,
      })
      .from(questions)
      .where(eq(questions.bankId, bankId))
    return { total: stats?.total ?? 0, withTopic: stats?.withTopic ?? 0 }
  },

  async listTopicsByBank(bankId: string) {
    return db.select().from(topics).where(eq(topics.bankId, bankId)).orderBy(asc(topics.id))
  },

  // ── Statistika ─────────────────────────────────────────────────────────

  async getStats(): Promise<{
    totalUsers: number
    premiumUsers: number
    todayActiveUsers: number
    totalQuestions: number
    totalAnswered: number
    totalPromoCodes: number
  }> {
    const [userStats] = await executeRows<{ totalUsers: number; premiumUsers: number }>(sql`
      SELECT
        COUNT(*)::int AS "totalUsers",
        COUNT(*) FILTER (WHERE tariff = 'premium' OR (premium_until IS NOT NULL AND premium_until > now()))::int AS "premiumUsers"
      FROM users
    `)
    const [questionStats] = await executeRows<{ totalQuestions: number }>(sql`
      SELECT COUNT(*)::int AS "totalQuestions" FROM questions
    `)
    const [progressStats] = await executeRows<{ totalAnswered: number }>(sql`
      SELECT COALESCE(SUM(total_answered), 0)::int AS "totalAnswered" FROM progress
    `)
    const [promoStats] = await executeRows<{ totalPromoCodes: number }>(sql`
      SELECT COUNT(*)::int AS "totalPromoCodes" FROM promo_codes
    `)
    const [dailyStats] = await executeRows<{ todayActiveUsers: number }>(sql`
      SELECT COUNT(DISTINCT user_id)::int AS "todayActiveUsers"
      FROM daily_records
      WHERE date = to_char(now() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')
    `)
    return {
      totalUsers:       userStats?.totalUsers ?? 0,
      premiumUsers:     userStats?.premiumUsers ?? 0,
      todayActiveUsers: dailyStats?.todayActiveUsers ?? 0,
      totalQuestions:   questionStats?.totalQuestions ?? 0,
      totalAnswered:    progressStats?.totalAnswered ?? 0,
      totalPromoCodes:  promoStats?.totalPromoCodes ?? 0,
    }
  },

  // ── User qidiruvi ──────────────────────────────────────────────────────

  async searchUsers(query: string) {
    const like = `%${query}%`
    return executeRows(sql`
      SELECT
        u.id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.username,
        u.photo_url AS "photoUrl",
        u.phone,
        u.tariff,
        u.premium_until AS "premiumUntil",
        u.is_admin AS "isAdmin",
        u.created_at AS "createdAt",
        COALESCE(p.total_answered, 0)::int AS answered,
        COALESCE(p.total_correct, 0)::int AS correct,
        COALESCE(p.league, 'bronze') AS league
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      WHERE ${query} = '' OR (
        u.id ILIKE ${like} OR
        COALESCE(u.first_name, '') ILIKE ${like} OR
        COALESCE(u.last_name, '') ILIKE ${like} OR
        COALESCE(u.username, '') ILIKE ${like} OR
        COALESCE(u.phone, '') ILIKE ${like}
      )
      ORDER BY u.created_at DESC
      LIMIT 50
    `)
  },

  // ── Premium grant (C-1 sentinel formati: days=null faqat lifetime) ─────

  async grantPremium(userId: string, tariff: 'free' | 'premium', days: number | null | undefined): Promise<void> {
    if (tariff === 'free') {
      await executeRows(sql`
        UPDATE users
        SET tariff = 'free', premium_until = NULL, updated_at = now()
        WHERE id = ${userId}
      `)
    } else if (days && days > 0) {
      // C-1: muddatli grant tariff'ga TEGMAYDI — premium_until yetarli
      await executeRows(sql`
        UPDATE users
        SET
          premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days}::int),
          updated_at = now()
        WHERE id = ${userId}
      `)
    } else {
      // Lifetime premium (yagona sentinel holati)
      await executeRows(sql`
        UPDATE users
        SET tariff = 'premium', premium_until = NULL, updated_at = now()
        WHERE id = ${userId}
      `)
    }
  },

  async getUserForGrant(userId: string) {
    const rows = await executeRows(sql`
      SELECT id, first_name AS "firstName", tariff, premium_until AS "premiumUntil"
      FROM users
      WHERE id = ${userId}
    `)
    return rows[0] ?? null
  },
}
