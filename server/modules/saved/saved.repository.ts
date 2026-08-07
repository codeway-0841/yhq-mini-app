/**
 * Saved questions repository — bookmarklar FAN BO'YICHA ajratilgan
 * (multi-fan identity: bir xil questionId turli fanlarda mustaqil).
 */

import { and, eq }         from 'drizzle-orm'
import { db }              from '../../db/connection'
import { savedQuestions }  from '../../schema'
import { AppError }        from '../../middleware/error-handler'
import { DEFAULT_SUBJECT_ID } from '../../config/subjects'

/** Composite kalit: `${subjectId}:${questionId}` (shared/subjects.questionKey formati). */
function toKey(subjectId: string, questionId: number): string {
  return `${subjectId}:${questionId}`
}

export const savedRepository = {
  /** Composite kalitlar ro'yxati: ['yhq:12', 'fizika:12', ...] */
  async findByUserId(userId: bigint): Promise<string[]> {
    const rows = await db
      .select({ questionId: savedQuestions.questionId, subjectId: savedQuestions.subjectId })
      .from(savedQuestions)
      .where(eq(savedQuestions.userId, userId))
    return rows.map((r) => toKey(r.subjectId, r.questionId))
  },

  async add(userId: bigint, questionId: number, subjectId: string = DEFAULT_SUBJECT_ID): Promise<void> {
    try {
      await db.insert(savedQuestions).values({ userId, questionId, subjectId }).onConflictDoNothing()
    } catch (err) {
      // FK violation (23503): client eski/o'chirilgan savol ID'sini yubordi — 500 EMAS, 400
      if ((err as { code?: string })?.code === '23503') {
        throw new AppError(400, 'Bunday savol mavjud emas')
      }
      throw err
    }
  },

  async remove(userId: bigint, questionId: number, subjectId: string = DEFAULT_SUBJECT_ID): Promise<void> {
    await db.delete(savedQuestions).where(
      and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.subjectId, subjectId),
        eq(savedQuestions.questionId, questionId),
      ),
    )
  },
}
