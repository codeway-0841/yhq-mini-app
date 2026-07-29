/**
 * Leaderboard repository.
 */

import { desc, eq, sql }  from 'drizzle-orm'
import { db }              from '../../db/connection'
import { users, progress } from '../../schema'

export interface LeaderboardEntry {
  rank:   number
  userId: string
  name:   string
  score:  number
  streak: number
  isYou:  boolean
}

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
}
