/**
 * Kunlik topshiriq (Daily Challenge) — client store.
 *
 * Server — haqiqat manbai (multi-device), bu store esa uning tezkor
 * lokal oynasi (UI flash'siz + offline fallback). doneKey formati:
 * `${date}|${subjectId}` — bir kunda har fan uchun alohida topshiriq.
 * Streaklar ham FAN BO'YICHA saqlanadi: `streaks[subjectId]` — fan
 * almashtirilganda har fan o'z seriyasini ko'rsatadi.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

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

interface DailyState {
  /** Bugun bajarilgan fan: `${date}|${subjectId}` (bajarilmagan bo'lsa null) */
  doneKey: string | null
  /** Fan bo'yicha kunlik seriyalar — `streaks[subjectId]` */
  streaks: Record<string, number>

  /** Serverdan bugungi holatni tortadi (xato bo'lsa sokin o'tkazadi) */
  sync:     (userId: string, date: string, subjectId: string) => Promise<void>
  /** Test yakuni — serverga yuboradi + lokalni yangilaydi */
  complete: (userId: string, date: string, subjectId: string, answered: number, correct: number) => Promise<void>
}

export const useDailyStore = create<DailyState>()(
  persist(
    (set) => ({
      doneKey: null,
      streaks: {},

      sync: async (userId, date, subjectId) => {
        if (!userId || userId === '0') return // ghost user — faqat lokal
        try {
          const data = await api.getDaily(userId, date, subjectId)
          set((s) => ({
            streaks: { ...s.streaks, [subjectId]: data.dailyStreak },
            doneKey: data.record ? doneKeyOf(date, subjectId) : null,
          }))
        } catch { /* offline — eski lokal holatda qolamiz */ }
      },

      complete: async (userId, date, subjectId, answered, correct) => {
        // Optimistik lokal belgilash (server xatosi kunda ham UI buzilmasin)
        set({ doneKey: doneKeyOf(date, subjectId) })
        if (!userId || userId === '0') return
        try {
          const res = await api.completeDaily(userId, { date, subjectId, answered, correct })
          set((s) => ({ streaks: { ...s.streaks, [subjectId]: res.dailyStreak } }))
        } catch (err) {
          console.warn('daily complete sync xatosi (lokal saqlandi):', err)
        }
      },
    }),
    {
      name:    'yhq-daily',
      version: 2,
      // v1 → v2: bitta `dailyStreak` → fan bo'yicha `streaks` xaritasi
      migrate: (state: unknown) => {
        const s = (state ?? {}) as { doneKey?: string | null; dailyStreak?: number; streaks?: Record<string, number> }
        const streaks = s.streaks ?? {}
        // Eski umumiy streak'ni faol fanga ko'chiramiz (doneKey: `date|subject`)
        if (s.dailyStreak && s.doneKey) {
          const subjectId = s.doneKey.split('|')[1]
          if (subjectId && !streaks[subjectId]) streaks[subjectId] = s.dailyStreak
        }
        return { doneKey: s.doneKey ?? null, streaks }
      },
    },
  ),
)
