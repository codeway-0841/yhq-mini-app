/**
 * Leaderboard repository.
 */

import { desc, eq, sql } from 'drizzle-orm'
import { db }                 from '../../db/connection'
import { users, progress, dailyRecords } from '../../schema'

export interface LeaderboardEntry {
  rank:   number
  userId: string
  name:   string
  score:  number
  streak: number
  isYou:  boolean
}

export interface WeeklyEntry {
  rank:   number
  userId: string
  name:   string
  score:  number   // shu hafta yig'ilgan TO'G'RI javoblar
  league: string
  isYou:  boolean
}

/**
 * Joriy hafta boshi (dushanba, Asia/Tashkent = UTC+5, DST yo'q).
 * weekOffset: 0 — joriy hafta, 1 — o'tgan hafta.
 */
export function weekStartTashkent(weekOffset = 0): string {
  const d = new Date(Date.now() + 5 * 3_600_000)
  const dow = (d.getUTCDay() + 6) % 7   // dushanba = 0
  d.setUTCDate(d.getUTCDate() - dow - weekOffset * 7)
  return d.toISOString().slice(0, 10)
}

export const LEAGUE_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const

export const leaderboardRepository = {
  async topN(limit: number, callerUserId: bigint | null): Promise<LeaderboardEntry[]> {
    // Clamp here as well — defense in depth in case router validation is bypassed
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)

    // LEFT JOIN so users with no progress row are included (score = 0)
    // They won't appear in top-N in practice, but the caller's isYou still works correctly
    const rows = await db
      .select({
        userId:       users.id,
        firstName:    users.firstName,
        lastName:     users.lastName,
        totalCorrect: sql<number>`COALESCE(${progress.totalCorrect}, 0)`,
        streak:       sql<number>`COALESCE(${progress.streak}, 0)`,
      })
      .from(users)
      .leftJoin(progress, eq(progress.userId, users.id))
      .orderBy(
        desc(sql`COALESCE(${progress.totalCorrect}, 0)`),
        desc(sql`COALESCE(${progress.streak}, 0)`),
      )
      .limit(safeLimit)

    return rows.map((r, i) => ({
      rank:   i + 1,
      userId: String(r.userId),
      name:   `${r.firstName} ${r.lastName ?? ''}`.trim(),
      score:  r.totalCorrect,
      streak: r.streak,
      isYou:  callerUserId !== null && String(r.userId) === String(callerUserId),
    }))
  },

  /** Haftalik LIGA reytingi — score = joriy haftadagi to'g'ri javoblar summasi. */
  async weeklyTop(limit: number, callerUserId: bigint | null): Promise<{
    entries: WeeklyEntry[]
    myLeague: string | null
    weekStart: string
  }> {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
    const weekStart = weekStartTashkent()

    const rows = await db
      .select({
        userId:    users.id,
        firstName: users.firstName,
        lastName:  users.lastName,
        league:    sql<string>`COALESCE(${progress.league}, 'bronze')`,
        score:     sql<number>`COALESCE(SUM(CASE WHEN ${dailyRecords.date} >= ${weekStart} THEN ${dailyRecords.correct} ELSE 0 END), 0)`,
      })
      .from(users)
      .leftJoin(progress, eq(progress.userId, users.id))
      .leftJoin(dailyRecords, eq(dailyRecords.userId, users.id))
      .groupBy(users.id, users.firstName, users.lastName, progress.league, progress.totalCorrect)
      .orderBy(
        desc(sql`COALESCE(SUM(CASE WHEN ${dailyRecords.date} >= ${weekStart} THEN ${dailyRecords.correct} ELSE 0 END), 0)`),
        desc(sql`COALESCE(${progress.totalCorrect}, 0)`),
      )
      .limit(safeLimit)

    let myLeague: string | null = null
    if (callerUserId !== null) {
      const [mine] = await db.select({ league: progress.league })
        .from(progress).where(eq(progress.userId, callerUserId))
      myLeague = mine?.league ?? 'bronze'
    }

    return {
      weekStart,
      myLeague,
      entries: rows.map((r, i) => ({
        rank:   i + 1,
        userId: String(r.userId),
        name:   `${r.firstName} ${r.lastName ?? ''}`.trim(),
        score:  Number(r.score),
        league: r.league,
        isYou:  callerUserId !== null && String(r.userId) === String(callerUserId),
      })),
    }
  },
}
