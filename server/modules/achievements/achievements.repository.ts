/**
 * Achievements (Yutuqlar) — Database Access Layer.
 * Drizzle ORM / SQL so'rovlari faqat shu yerda bajariladi.
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/connection'
import { progress, dailyRecords, dailyStreaks } from '../../schema'

export interface RawProgressRow {
  totalCorrect:  number
  totalAnswered: number
  octagonWins:   number
}

export interface RawSubjectRecordRow {
  subjectId: string
  answered:  number
  correct:   number
}

export interface RawAchievementMetrics {
  prog?:       RawProgressRow
  bestStreak:  number
  totalFixed:  number
  perSubject:  RawSubjectRecordRow[]
}

export const achievementsRepository = {
  /**
   * Foydalanuvchining yutuqlar uchun xom (raw) metrikalarini DB dan yig'ib beradi.
   * Read-only: qatorlar mavjud bo'lmasa xato tashlamaydi (service fallback qiymatlarni qo'llaydi).
   */
  async getRawMetrics(uid: string): Promise<RawAchievementMetrics> {
    const [progQuery, bestQuery, fixQuery, perSubjectQuery] = await Promise.all([
      db
        .select({
          totalCorrect:  progress.totalCorrect,
          totalAnswered: progress.totalAnswered,
          octagonWins:   progress.octagonWins,
        })
        .from(progress)
        .where(eq(progress.userId, uid)),

      db
        .select({
          bestStreak: sql<number>`COALESCE(MAX(${dailyStreaks.streak}), 0)`,
        })
        .from(dailyStreaks)
        .where(eq(dailyStreaks.userId, uid)),

      db
        .select({
          totalFixed: sql<number>`COALESCE(SUM(${dailyRecords.fixed}), 0)`,
        })
        .from(dailyRecords)
        .where(eq(dailyRecords.userId, uid)),

      db
        .select({
          subjectId: dailyRecords.subjectId,
          answered:  sql<number>`COALESCE(SUM(${dailyRecords.answered}), 0)`,
          correct:   sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)`,
        })
        .from(dailyRecords)
        .where(eq(dailyRecords.userId, uid))
        .groupBy(dailyRecords.subjectId),
    ])

    const prog = progQuery[0]
    const best = bestQuery[0]
    const fix  = fixQuery[0]

    return {
      prog: prog ? {
        totalCorrect:  prog.totalCorrect,
        totalAnswered: prog.totalAnswered,
        octagonWins:   prog.octagonWins,
      } : undefined,
      bestStreak: Number(best?.bestStreak ?? 0),
      totalFixed: Number(fix?.totalFixed ?? 0),
      perSubject: perSubjectQuery.map((s) => ({
        subjectId: s.subjectId,
        answered:  Number(s.answered),
        correct:   Number(s.correct),
      })),
    }
  },
}
