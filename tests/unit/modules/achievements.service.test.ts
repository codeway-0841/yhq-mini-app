import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateSubjectAccuracy,
  checkAllPassed80,
  achievementsService,
  MIN_ANSWERED_PER_SUBJECT,
} from '../../../server/modules/achievements/achievements.service'
import { achievementsRepository } from '../../../server/modules/achievements/achievements.repository'

describe('achievements.service', () => {
  describe('calculateSubjectAccuracy', () => {
    it('hisoblash to\'g\'ri ishlaydi va foizni yaxlitlaydi', () => {
      const input = [
        { subjectId: 'yhq', answered: 25, correct: 21 }, // 21/25 = 84%
        { subjectId: 'rustili', answered: 3, correct: 1 },  // 1/3 = 33.33% -> 33%
      ]
      const res = calculateSubjectAccuracy(input)
      expect(res).toEqual([
        { subjectId: 'yhq', answered: 25, accuracy: 84 },
        { subjectId: 'rustili', answered: 3, accuracy: 33 },
      ])
    })

    it('0 ta savol yechilgan bo\'lsa 0 qaytaradi (nolga bo\'lishdan himoya)', () => {
      const input = [{ subjectId: 'fizika', answered: 0, correct: 0 }]
      const res = calculateSubjectAccuracy(input)
      expect(res).toEqual([{ subjectId: 'fizika', answered: 0, accuracy: 0 }])
    })
  })

  describe('checkAllPassed80', () => {
    const mockSubjects: any = [
      { id: 'yhq', isActive: true },
      { id: 'rustili', isActive: true },
      { id: 'fizika', isActive: false }, // nofaol fan hisobga olinmaydi
    ]

    it('barcha faol fanlardan kamida 20 savol va 80%+ bo\'lsa true qaytaradi', () => {
      const accuracy = [
        { subjectId: 'yhq', answered: 25, accuracy: 84 },
        { subjectId: 'rustili', answered: 20, accuracy: 80 },
      ]
      expect(checkAllPassed80(accuracy, mockSubjects)).toBe(true)
    })

    it('biror faol fandan savollar soni 20 dan kam bo\'lsa false qaytaradi', () => {
      const accuracy = [
        { subjectId: 'yhq', answered: 25, accuracy: 90 },
        { subjectId: 'rustili', answered: 19, accuracy: 95 }, // 19 < 20
      ]
      expect(checkAllPassed80(accuracy, mockSubjects)).toBe(false)
    })

    it('biror faol fandan aniqlik 80% dan past bo\'lsa false qaytaradi', () => {
      const accuracy = [
        { subjectId: 'yhq', answered: 30, accuracy: 85 },
        { subjectId: 'rustili', answered: 30, accuracy: 79 }, // 79 < 80
      ]
      expect(checkAllPassed80(accuracy, mockSubjects)).toBe(false)
    })

    it('biror faol fandan umuman ma\'lumot yo\'q bo\'lsa false qaytaradi', () => {
      const accuracy = [
        { subjectId: 'yhq', answered: 50, accuracy: 90 },
      ]
      expect(checkAllPassed80(accuracy, mockSubjects)).toBe(false)
    })
  })

  describe('achievementsService.getUserStats', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('repository ma\'lumotlarini qabul qilib to\'g\'ri formatda stats qaytaradi', async () => {
      vi.spyOn(achievementsRepository, 'getRawMetrics').mockResolvedValue({
        prog: { totalCorrect: 40, totalAnswered: 50, octagonWins: 5 },
        bestStreak: 12,
        totalFixed: 6,
        perSubject: [{ subjectId: 'yhq', answered: 50, correct: 40 }],
      })

      const stats = await achievementsService.getUserStats('12345')
      expect(stats).toMatchObject({
        totalCorrect: 40,
        totalAnswered: 50,
        octagonWins: 5,
        bestStreak: 12,
        totalFixed: 6,
      })
      expect(stats.subjectAccuracy).toEqual([
        { subjectId: 'yhq', answered: 50, accuracy: 80 },
      ])
    })

    it('prog bo\'lmagan yangi foydalanuvchida 0 qiymatlarni qaytaradi', async () => {
      vi.spyOn(achievementsRepository, 'getRawMetrics').mockResolvedValue({
        prog: undefined,
        bestStreak: 0,
        totalFixed: 0,
        perSubject: [],
      })

      const stats = await achievementsService.getUserStats('new-user')
      expect(stats).toEqual({
        totalCorrect: 0,
        totalAnswered: 0,
        octagonWins: 0,
        bestStreak: 0,
        totalFixed: 0,
        subjectAccuracy: [],
        allPassed80: false,
      })
    })
  })
})
