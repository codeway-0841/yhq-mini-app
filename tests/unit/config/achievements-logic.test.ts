import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, isUnlocked } from '../../../src/shared/config/achievements'
import type { AchievementStats } from '../../../src/shared/api'

describe('Achievements Unlocking Logic', () => {
  const baseStats: AchievementStats = {
    totalCorrect: 0,
    totalAnswered: 0,
    octagonWins: 0,
    bestStreak: 0,
    totalFixed: 0,
    subjectAccuracy: [],
    allPassed80: false,
  }

  it('25 000 ta test yechganda correct25000 badge ochiladi', () => {
    const ach25k = ACHIEVEMENTS.find((a) => a.id === 'correct25000')!
    expect(ach25k).toBeDefined()
    expect(ach25k.target).toBe(25000)

    // 24,999 ta bo'lsa — qulflangan (false)
    expect(isUnlocked(ach25k, { ...baseStats, totalCorrect: 24999 })).toBe(false)

    // 25,000 ta bo'lsa — ochiladi (true)
    expect(isUnlocked(ach25k, { ...baseStats, totalCorrect: 25000 })).toBe(true)

    // 30,000 ta bo'lsa ham ochiq qoladi
    expect(isUnlocked(ach25k, { ...baseStats, totalCorrect: 30000 })).toBe(true)
  })

  it('100 ta xatoni tuzatganda errorHunter badge ochiladi', () => {
    const achHunter = ACHIEVEMENTS.find((a) => a.id === 'errorHunter')!
    expect(achHunter).toBeDefined()
    expect(achHunter.target).toBe(100)

    // 99 ta xato tuzatilgan bo'lsa — qulflangan (false)
    expect(isUnlocked(achHunter, { ...baseStats, totalFixed: 99 })).toBe(false)

    // 100 ta xato tuzatilganda — ochiladi (true)
    expect(isUnlocked(achHunter, { ...baseStats, totalFixed: 100 })).toBe(true)
  })

  it('Matematika fanidan 100 ta test yechganda subject_matematika_100 ochiladi', () => {
    const achMath = ACHIEVEMENTS.find((a) => a.id === 'subject_matematika_100')!
    expect(achMath).toBeDefined()
    expect(achMath.target).toBe(100)

    // Matematikada 50 ta yechilgan bo'lsa — qulflangan
    expect(isUnlocked(achMath, {
      ...baseStats,
      subjectAccuracy: [{ subjectId: 'matematika', answered: 50, accuracy: 90 }],
    })).toBe(false)

    // Matematikada 100 ta yechilganda — ochiladi
    expect(isUnlocked(achMath, {
      ...baseStats,
      subjectAccuracy: [{ subjectId: 'matematika', answered: 100, accuracy: 90 }],
    })).toBe(true)
  })

  it('10 ta duel g\'alabasida winStreak10 ochiladi', () => {
    const achDuel = ACHIEVEMENTS.find((a) => a.id === 'winStreak10')!
    expect(achDuel).toBeDefined()
    expect(achDuel.target).toBe(10)

    expect(isUnlocked(achDuel, { ...baseStats, octagonWins: 9 })).toBe(false)
    expect(isUnlocked(achDuel, { ...baseStats, octagonWins: 10 })).toBe(true)
  })

  it('7 kunlik seriyada streak7 ochiladi', () => {
    const achStreak = ACHIEVEMENTS.find((a) => a.id === 'streak7')!
    expect(achStreak).toBeDefined()
    expect(achStreak.target).toBe(7)

    expect(isUnlocked(achStreak, { ...baseStats, bestStreak: 6 })).toBe(false)
    expect(isUnlocked(achStreak, { ...baseStats, bestStreak: 7 })).toBe(true)
  })
})
