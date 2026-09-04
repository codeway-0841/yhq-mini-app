import { api, type AchievementStats } from '../api'
import { createTtlCache, type TtlCache } from './ttl-cache'

let owner: string | undefined
let cache: TtlCache<AchievementStats> | undefined

export function getAchievementsCache(userId: string) {
  if (owner !== userId || !cache) {
    owner = userId
    cache = createTtlCache<AchievementStats>(30_000, { persistKey: `achievements:${userId}` })
  }
  return cache
}

export function fetchAchievements(userId: string) {
  const current = getAchievementsCache(userId)
  if (current.isFresh()) return Promise.resolve(current.peek()!)
  return current.fetch(async () => {
    const result = await api.getAchievements(userId)
    if (!result?.stats || !Array.isArray(result.stats.subjectAccuracy)) {
      throw new Error('Invalid achievements response')
    }
    return result.stats
  })
}

export function invalidateAchievementsCache() {
  cache?.invalidate()
  cache = undefined
  owner = undefined
}
