/**
 * Achievements (Yutuqlar) — Business Logic & Service Layer.
 * Aniqlik foizi hisoblash, yutuq qoidalari (80%+ barcha fanlar) va
 * metrikalarni agregatsiya qilish shu yerda bajariladi.
 */

import { SUBJECT_REGISTRY } from '../../config/subjects'
import {
  achievementsRepository,
  type RawSubjectRecordRow,
} from './achievements.repository'

/** "Barcha fanlardan 80%+" sharti uchun minimum savollar soni (fan bo'yicha) */
export const MIN_ANSWERED_PER_SUBJECT = 20

export interface SubjectAccuracyItem {
  subjectId: string
  answered:  number
  accuracy:  number
}

export interface AchievementStats {
  totalCorrect:    number
  totalAnswered:   number
  octagonWins:     number
  bestStreak:      number
  totalFixed:      number
  subjectAccuracy: SubjectAccuracyItem[]
  allPassed80:     boolean
}

/**
 * Har bir fan bo'yicha to'g'ri javoblar foizini (accuracy) hisoblaydi.
 * Pure funksiya (testlanadi).
 */
export function calculateSubjectAccuracy(records: RawSubjectRecordRow[]): SubjectAccuracyItem[] {
  return records.map((s) => ({
    subjectId: s.subjectId,
    answered:  s.answered,
    accuracy:  s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0,
  }))
}

/**
 * Barcha faol fanlardan kamida MIN_ANSWERED_PER_SUBJECT yechilgani va
 * har birida 80%+ aniqlik mavjudligini tekshiradi.
 * Pure funksiya (testlanadi).
 */
export function checkAllPassed80(
  accuracy: SubjectAccuracyItem[],
  subjects: typeof SUBJECT_REGISTRY = SUBJECT_REGISTRY,
): boolean {
  const accMap = new Map(accuracy.map((a) => [a.subjectId, a]))
  const activeSubjects = subjects.filter((s) => s.isActive)
  if (activeSubjects.length === 0) return false

  return activeSubjects.every((s) => {
    const a = accMap.get(s.id)
    return !!a && a.answered >= MIN_ANSWERED_PER_SUBJECT && a.accuracy >= 80
  })
}

export const achievementsService = {
  /**
   * Foydalanuvchining to'liq yutuq statistikasini hisoblab beradi.
   */
  async getUserStats(uid: string): Promise<AchievementStats> {
    const raw = await achievementsRepository.getRawMetrics(uid)
    const subjectAccuracy = calculateSubjectAccuracy(raw.perSubject)
    const allPassed80 = checkAllPassed80(subjectAccuracy)

    return {
      totalCorrect:    raw.prog?.totalCorrect ?? 0,
      totalAnswered:   raw.prog?.totalAnswered ?? 0,
      octagonWins:     raw.prog?.octagonWins ?? 0,
      bestStreak:      raw.bestStreak,
      totalFixed:      raw.totalFixed,
      subjectAccuracy,
      allPassed80,
    }
  },
}
