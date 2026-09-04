import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type AchievementStats } from '../../../src/shared/api'
import { fetchAchievements, getAchievementsCache, invalidateAchievementsCache } from '../../../src/shared/lib/achievements-cache'

const stats: AchievementStats = { totalCorrect: 10, totalAnswered: 12, octagonWins: 0, bestStreak: 2, totalFixed: 0, subjectAccuracy: [], allPassed80: false }

beforeEach(() => { invalidateAchievementsCache(); localStorage.clear(); vi.restoreAllMocks() })

describe('achievements cache', () => {
  it('shares prefetch with opening the screen and reuses the result on reopening', async () => {
    const request = vi.spyOn(api, 'getAchievements').mockResolvedValue({ stats })
    const first = fetchAchievements('1')
    const opening = fetchAchievements('1')
    await Promise.all([first, opening])
    expect(getAchievementsCache('1').peek()).toEqual(stats)
    await fetchAchievements('1')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not show another account data and clears on logout', async () => {
    vi.spyOn(api, 'getAchievements').mockResolvedValue({ stats })
    await fetchAchievements('1')
    expect(getAchievementsCache('2').peek()).toBeNull()
    await fetchAchievements('2')
    invalidateAchievementsCache()
    expect(getAchievementsCache('2').peek()).toBeNull()
  })

  it('rejects a missing stats payload instead of leaving the screen loading', async () => {
    vi.spyOn(api, 'getAchievements').mockResolvedValue({} as never)
    await expect(fetchAchievements('1')).rejects.toThrow('Invalid achievements response')
    expect(getAchievementsCache('1').peek()).toBeNull()
  })
})
