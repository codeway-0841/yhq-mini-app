/**
 * Achievements (Yutuqlar) — GET /api/achievements/:userId
 *
 * Server FOYDALANUVCHI METRIKALARINI yig'ib beradi (badge qoidalari client'da,
 * rawMetrics asosida — shu bilan yutuqlar konfiguratsiyasi bitta joyda bo'ladi va
 * eski client versiyalar ham ishlayveradi).
 *
 * Metrikalar:
 *  - totalCorrect / totalAnswered / octagonWins        → progress
 *  - bestStreak                                         → daily_streaks (max, fan bo'yicha)
 *  - totalFixed                                         → daily_records (sum fixed)
 *  - subjectAccuracy[], allPassed80                     → daily_records (fan kesimida)
 */

import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { wrap, AppError } from '../../middleware/error-handler'
import { parseUserId } from '../../utils/parse'
import { db } from '../../db/connection'
import { progress, dailyRecords, dailyStreaks } from '../../schema'
import { SUBJECT_REGISTRY } from '../../config/subjects'
import { requireSelf } from '../../middleware/auth'

const router = Router()

router.use('/achievements/:userId', requireSelf)

/** "Barcha fanlardan 80%+" sharti uchun minimum savollar soni (fan bo'yicha) */
const MIN_ANSWERED_PER_SUBJECT = 20

router.get(
  '/achievements/:userId',
  wrap(async (req, res) => {
    const uid = parseUserId(req.params['userId'])
    if (!uid) throw new AppError(400, 'Invalid userId')

    // READ-ONLY: progressRepository.ensureExists yozuvi (INSERT) GET handler'dan
    // o'chirildi — qator yo'q bo'lsa statistikalar 0 bilan qaytadi (pastda ?? 0).
    const [prog] = await db.select({
      totalCorrect:  progress.totalCorrect,
      totalAnswered: progress.totalAnswered,
      octagonWins:   progress.octagonWins,
    }).from(progress).where(eq(progress.userId, uid))

    const [best] = await db.select({
      bestStreak: sql<number>`COALESCE(MAX(${dailyStreaks.streak}), 0)`,
    }).from(dailyStreaks).where(eq(dailyStreaks.userId, uid))

    const [fix] = await db.select({
      totalFixed: sql<number>`COALESCE(SUM(${dailyRecords.fixed}), 0)`,
    }).from(dailyRecords).where(eq(dailyRecords.userId, uid))

    const perSubject = await db.select({
      subjectId: dailyRecords.subjectId,
      answered:  sql<number>`COALESCE(SUM(${dailyRecords.answered}), 0)`,
      correct:   sql<number>`COALESCE(SUM(${dailyRecords.correct}), 0)`,
    }).from(dailyRecords).where(eq(dailyRecords.userId, uid))
      .groupBy(dailyRecords.subjectId)

    const accuracy = perSubject.map((s) => ({
      subjectId: s.subjectId,
      answered:  Number(s.answered),
      accuracy:  Number(s.answered) > 0 ? Math.round((Number(s.correct) / Number(s.answered)) * 100) : 0,
    }))
    const accMap = new Map(accuracy.map((a) => [a.subjectId, a]))
    const allPassed80 = SUBJECT_REGISTRY.filter((s) => s.isActive).every((s) => {
      const a = accMap.get(s.id)
      return !!a && a.answered >= MIN_ANSWERED_PER_SUBJECT && a.accuracy >= 80
    })

    res.json({
      stats: {
        totalCorrect:  prog?.totalCorrect ?? 0,
        totalAnswered: prog?.totalAnswered ?? 0,
        octagonWins:   prog?.octagonWins ?? 0,
        bestStreak:    Number(best?.bestStreak ?? 0),
        totalFixed:    Number(fix?.totalFixed ?? 0),
        subjectAccuracy: accuracy,
        allPassed80,
      },
    })
  }),
)

export default router
