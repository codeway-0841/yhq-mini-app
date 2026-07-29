/**
 * Saved questions repository.
 */

import { and, eq }       from 'drizzle-orm'
import { db }             from '../../db/connection'
import { savedQuestions } from '../../schema'

export const savedRepository = {
  async findByUserId(userId: bigint): Promise<number[]> {
    const rows = await db
      .select({ questionId: savedQuestions.questionId })
      .from(savedQuestions)
      .where(eq(savedQuestions.userId, userId))
    return rows.map((r) => r.questionId)
  },

  async add(userId: bigint, questionId: number): Promise<void> {
    await db.insert(savedQuestions).values({ userId, questionId }).onConflictDoNothing()
  },

  async remove(userId: bigint, questionId: number): Promise<void> {
    await db.delete(savedQuestions).where(
      and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.questionId, questionId),
      ),
    )
  },
}
