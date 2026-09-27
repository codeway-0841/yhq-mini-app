import { create } from 'zustand'
import type { AchievementDef } from '../config/achievements'

interface AchievementCelebrationState {
  unlockedQueue: AchievementDef[]
  currentCelebration: AchievementDef | null
  inspectBadge: AchievementDef | null
  inspectBadgeStatsProgress?: { current: number; target: number; unlocked: boolean }

  /** Yangi yutuq(lar) ochilganda tantanani navbatga qo'shish */
  triggerCelebration: (badges: AchievementDef | AchievementDef[]) => void
  /** Joriy tantanani yopish yoki navbatdagi yutuqqa o'tish */
  dismissCurrent: () => void
  /** Profil yoki ro'yxatdan badgeni to'liq ko'rish sheet'ini ochish */
  openDetailSheet: (
    badge: AchievementDef,
    progress?: { current: number; target: number; unlocked: boolean }
  ) => void
  /** Detail sheetni yopish */
  closeDetailSheet: () => void
}

export const useAchievementCelebrationStore = create<AchievementCelebrationState>((set, get) => ({
  unlockedQueue: [],
  currentCelebration: null,
  inspectBadge: null,
  inspectBadgeStatsProgress: undefined,

  triggerCelebration: (input) => {
    const badges = Array.isArray(input) ? input : [input]
    if (badges.length === 0) return

    set((state) => {
      const nextQueue = [...state.unlockedQueue, ...badges]
      if (!state.currentCelebration) {
        return {
          unlockedQueue: nextQueue.slice(1),
          currentCelebration: nextQueue[0],
        }
      }
      return { unlockedQueue: nextQueue }
    })
  },

  dismissCurrent: () => {
    const { unlockedQueue } = get()
    if (unlockedQueue.length > 0) {
      set({
        currentCelebration: unlockedQueue[0],
        unlockedQueue: unlockedQueue.slice(1),
      })
    } else {
      set({
        currentCelebration: null,
        unlockedQueue: [],
      })
    }
  },

  openDetailSheet: (badge, progress) => {
    set({
      inspectBadge: badge,
      inspectBadgeStatsProgress: progress,
    })
  },

  closeDetailSheet: () => {
    set({
      inspectBadge: null,
      inspectBadgeStatsProgress: undefined,
    })
  },
}))
