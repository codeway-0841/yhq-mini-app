/**
 * Kunlik faollik (Intizom streak) — client store.
 *
 * Server — haqiqat manbai (multi-device), bu store esa uning tezkor
 * lokal oynasi (UI flash'siz + offline fallback).
 * Streaklar FAN BO'YICHA saqlanadi: `streaks[subjectId]` — fan
 * almashtirilganda har fan o'z seriyasini ko'rsatadi.
 * Streak sharti: kuniga kamida 1 savol YOKI 1 dars (`touchActivity`).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api'

/** Lokal sana — 'YYYY-MM-DD' (foydalanuvchi vaqt zonasi) */
export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function doneKeyOf(date: string, subjectId: string): string {
  return `${date}|${subjectId}`
}

interface DailyChargeMeta {
  chargeSaved?: boolean
  chargeEarned?: boolean
  streakCharges?: number
  suppressCelebration?: boolean
}

interface DailyState {
  /** Fan bo'yicha kunlik seriyalar — `streaks[subjectId]` */
  streaks: Record<string, number>
  /** Fan bo'yicha Seriya Zaryadlari (0..2) — `charges[subjectId]` */
  charges: Record<string, number>
  /** Bugungi faollik belgilangan fan: `${date}|${subjectId}` */
  activityKey: string | null
  /**
   * Streak coin-save yuz berdi — server uzilgan seriyani coin evaziga saqladi.
   */
  coinSaved: boolean
  /**
   * Bugungi birinchi faollikda seriya ochilganda Brilliant Streak + Streak Charge
   * modalini ko'rsatish uchun bir martalik qiymat (persist qilinmaydi).
   */
  celebrationStreak: number | null
  celebrationMeta: {
    showCharge: boolean
    charges: number
    chargeSaved: boolean
    chargeEarned: boolean
  } | null

  /** Serverdan bugungi holatni tortadi (xato bo'lsa sokin o'tkazadi) */
  sync: (userId: string, date: string, subjectId: string) => Promise<void>
  touchActivity: (userId: string, date: string, subjectId: string) => Promise<void>
  applyServerResult: (
    date: string,
    subjectId: string,
    dailyStreak: number,
    coinSaved?: boolean,
    meta?: DailyChargeMeta,
  ) => void
  clearCoinSaved: () => void
  clearCelebration: () => void
  triggerStreakCelebration: (
    streak: number,
    meta?: { showCharge?: boolean; charges?: number; chargeSaved?: boolean; chargeEarned?: boolean },
  ) => void
  resetAccount: () => void
}

export const useDailyStore = create<DailyState>()(
  persist(
    (set) => ({
      streaks: {},
      charges: {},
      activityKey: null,
      coinSaved: false,
      celebrationStreak: null,
      celebrationMeta: null,

      sync: async (userId, date, subjectId) => {
        if (!userId || userId === '0') return // ghost user — faqat lokal
        try {
          const data = await api.getDaily(userId, date, subjectId)
          set((s) => ({
            streaks: { ...s.streaks, [subjectId]: data.dailyStreak },
            charges: { ...s.charges, [subjectId]: data.streakCharges ?? (s.charges[subjectId] ?? 0) },
          }))
        } catch { /* offline — eski lokal holatda qolamiz */ }
      },

      touchActivity: async (userId, date, subjectId) => {
        if (!userId || userId === '0') return
        const key = doneKeyOf(date, subjectId)
        if (useDailyStore.getState().activityKey === key) return
        try {
          const res = await api.touchDailyActivity(userId, { subjectId })
          set((s) => ({
            streaks: { ...s.streaks, [subjectId]: res.dailyStreak },
            coinSaved: res.coinSaved === true ? true : s.coinSaved,
          }))
        } catch { /* offline */ }
      },

      resetAccount: () => set({
        streaks: {},
        charges: {},
        activityKey: null,
        coinSaved: false,
        celebrationStreak: null,
        celebrationMeta: null,
      }),

      applyServerResult: (date, subjectId, dailyStreak, coinSaved, meta) => {
        const key = doneKeyOf(date, subjectId)
        set((s) => {
          const nextCharges = typeof meta?.streakCharges === 'number'
            ? meta.streakCharges
            : (s.charges[subjectId] ?? 0)
          const shouldCelebrate = !meta?.suppressCelebration && s.activityKey !== key && dailyStreak > 0
          const showCharge = Boolean(meta?.chargeSaved || meta?.chargeEarned || nextCharges > 0)
          return {
            activityKey: key,
            streaks: { ...s.streaks, [subjectId]: dailyStreak },
            charges: { ...s.charges, [subjectId]: nextCharges },
            coinSaved: coinSaved === true ? true : s.coinSaved,
            celebrationStreak: shouldCelebrate ? dailyStreak : s.celebrationStreak,
            celebrationMeta: shouldCelebrate
              ? {
                  showCharge,
                  charges: nextCharges,
                  chargeSaved: Boolean(meta?.chargeSaved),
                  chargeEarned: Boolean(meta?.chargeEarned),
                }
              : s.celebrationMeta,
          }
        })
      },

      clearCoinSaved: () => set({ coinSaved: false }),
      clearCelebration: () => set({ celebrationStreak: null, celebrationMeta: null }),
      triggerStreakCelebration: (streak, meta) => {
        if (streak <= 0) return
        set((s) => ({
          celebrationStreak: streak,
          celebrationMeta: {
            showCharge: Boolean(meta?.showCharge ?? (meta?.chargeSaved || meta?.chargeEarned || (meta?.charges ?? 0) > 0)),
            charges: meta?.charges ?? s.celebrationMeta?.charges ?? 0,
            chargeSaved: Boolean(meta?.chargeSaved),
            chargeEarned: Boolean(meta?.chargeEarned),
          },
        }))
      },
    }),
    {
      name:    'yhq-daily',
      version: 3,
      migrate: (state: unknown) => {
        const s = (state ?? {}) as { doneKey?: string | null; dailyStreak?: number; streaks?: Record<string, number>; charges?: Record<string, number> }
        const streaks = s.streaks ?? {}
        const charges = s.charges ?? {}
        if (s.dailyStreak && s.doneKey) {
          const subjectId = s.doneKey.split('|')[1]
          if (subjectId && !streaks[subjectId]) streaks[subjectId] = s.dailyStreak
        }
        return { streaks, charges, activityKey: null, coinSaved: false, celebrationStreak: null, celebrationMeta: null }
      },
      partialize: (s) => ({ streaks: s.streaks, charges: s.charges, activityKey: s.activityKey }),
    },
  ),
)
