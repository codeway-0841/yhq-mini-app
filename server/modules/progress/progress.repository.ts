/**
 * Progress repository — DB access for the `progress` table.
 */

import { eq, sql as sqlExpr } from 'drizzle-orm'
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
   * Atomic increment via SQL expressions — race-safe under concurrent requests.
   * Returns false if the progress row doesn't exist (caller should 404).
   */
  async addResult(
    userId:     bigint,
    correct:    boolean,
    questionId: number | null,
  ): Promise<boolean> {
    // Semantika: wrong_by_ticket — "hozirgi yechilmagan xatolar".
    //  - xato javob  → hisoblagich +1
    //  - to'g'ri javob → xato tuzatilgan, kalit jsonb'dan o'chiriladi (`-` operatori)
    //    Shunda "Xatolarni tuzatish" ro'yxati faqat HAL qilinmagan xatolarni ko'rsatadi,
    //    va qayta xato qilinsa hisob 1 dan qayta boshlanadi (umrbod yig'ilmasdan).
    const wrongPatch = (questionId !== null)
      ? correct
        ? {
            wrongByTicket: sqlExpr`wrong_by_ticket - ${String(questionId)}`,
          }
        : {
            wrongByTicket: sqlExpr`jsonb_set(
              wrong_by_ticket,
              ${`{${questionId}}`},
              (COALESCE((wrong_by_ticket->>${String(questionId)})::int, 0) + 1)::text::jsonb
            )`,
          }
      : {}

    const rows = await db.update(progress).set({
      totalCorrect:  sqlExpr`total_correct  + ${correct ? 1 : 0}`,
      totalWrong:    sqlExpr`total_wrong    + ${correct ? 0 : 1}`,
      totalAnswered: sqlExpr`total_answered + 1`,
      streak:        correct ? sqlExpr`streak + 1` : sqlExpr`0`,
      ...wrongPatch,
      updatedAt: new Date(),
    })
      .where(eq(progress.userId, userId))
      .returning({ id: progress.id })

    return rows.length > 0
  },

  /** Oktagon (PvP) g'alabasi — WS server match yakunida chaqiradi (Yutuqlar uchun) */
  async addOctagonWin(userId: bigint): Promise<void> {
    await db.update(progress).set({
      octagonWins: sqlExpr`octagon_wins + 1`,
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
