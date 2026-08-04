/**
 * Saved questions repository.
 */

import { and, eq }       from 'drizzle-orm'
import { db }             from '../../db/connection'
import { savedQuestions } from '../../schema'
import { AppError }       from '../../middleware/error-handler'

export const savedRepository = {
  async findByUserId(userId: bigint): Promise<number[]> {
    const rows = await db
      .select({ questionId: savedQuestions.questionId })
      .from(savedQuestions)
      .where(eq(savedQuestions.userId, userId))
    return rows.map((r) => r.questionId)
  },

  async add(userId: bigint, questionId: number): Promise<void> {
    try {
      await db.insert(savedQuestions).values({ userId, questionId }).onConflictDoNothing()
    } catch (err) {
      // FK violation (23503): client eski/o'chirilgan savol ID'sini yubordi — 500 EMAS, 400
      if ((err as { code?: string })?.code === '23503') {
        throw new AppError(400, 'Bunday savol mavjud emas')
      }
      throw err
    }
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
