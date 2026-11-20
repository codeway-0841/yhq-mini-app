import { ACHIEVEMENTS, isUnlocked, type AchievementDef } from '../config/achievements'
import { api, type AchievementStats } from '../api'
import { useAchievementCelebrationStore } from '../store/useAchievementCelebrationStore'

const STORAGE_KEY = 'kivvi_celebrated_badges'

export function getCelebratedBadgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function markBadgesCelebrated(ids: string[]): void {
  try {
    const set = getCelebratedBadgeIds()
    for (const id of ids) set.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

/**
 * Ilova ochilganda / profil yuklanganda mavjud yutuqlarni bazaviy holat sifatida saqlaydi,
 * shunda keyingi ochilgan har bir yangi yutuq tantanali ko'rsatiladi.
 */
export function seedCelebratedBaseline(stats: AchievementStats | null | undefined): void {
  if (!stats) return
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) return
    const currentlyUnlocked = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).map((a) => a.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentlyUnlocked))
  } catch {
    // ignore
  }
}

/**
 * Serverdan yangi yutuq statistikasini olib, yangi ochilgan yutuq bo'lsa tantanali modalni chiqaradi.
 */
export async function refreshAndCelebrateAchievements(userId: string | undefined | null): Promise<AchievementDef[]> {
  if (!userId || userId === '0') return []
  try {
    const { stats } = await api.getAchievements(userId)
    return checkAndCelebrateAchievements(stats)
  } catch {
    return []
  }
}

/**
 * Yangi ochilgan yutuqlarni aniqlaydi va Celebration store'ga tantana uchun yuboradi.
 *
 * @param stats Joriy yutuq metrikalari
 * @param options.forceCelebration Agar true bo'lsa, avval nishonlangan bo'lsa ham tantanani ochadi (masalan, preview uchun)
 */
export function checkAndCelebrateAchievements(
  stats: AchievementStats,
  options?: { forceCelebration?: boolean; deferCelebration?: boolean }
): AchievementDef[] {
  if (!stats) return []

  // Birinchi marta kirgan user uchun bazaviy holatni o'rnatish
  const isFirstRun = localStorage.getItem(STORAGE_KEY) === null
  const celebrated = getCelebratedBadgeIds()

  if (isFirstRun && !options?.forceCelebration) {
    const currentlyUnlocked = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).map((a) => a.id)
    markBadgesCelebrated(currentlyUnlocked)
    return []
  }

  const newlyUnlocked: AchievementDef[] = []

  for (const ach of ACHIEVEMENTS) {
    const unlocked = isUnlocked(ach, stats)
    if (unlocked) {
      if (options?.forceCelebration || !celebrated.has(ach.id)) {
        newlyUnlocked.push(ach)
      }
    }
  }

  if (newlyUnlocked.length > 0) {
    markBadgesCelebrated(newlyUnlocked.map((a) => a.id))
    if (!options?.deferCelebration) {
      useAchievementCelebrationStore.getState().triggerCelebration(newlyUnlocked)
    }
  }

  return newlyUnlocked
}
