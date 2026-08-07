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
  /** Fan bo'yicha kunlik seriyalar — `streaks[subjectId]` */
  streaks: Record<string, number>
  /** Bugungi faollik belgilangan fan: `${date}|${subjectId}` (kunda 1 marta yuborish uchun) */
  activityKey: string | null
  /** Bugun HAMMA fanlarda JAMI javoblangan savollar (kunlik maqsad ringi uchun) */
  todayAnswered: number

  /** Serverdan bugungi holatni tortadi (xato bo'lsa sokin o'tkazadi) */
  sync: (userId: string, date: string, subjectId: string) => Promise<void>
  /**
   * Kunlik faollik — kamida 1 savol yoki dars. Streak shu bilan yoziladi.
   * `delta` bersa (har javob) HAR SAFAR yuboriladi (kunlik JAMI → heat map);
   * berilmasa (sof faollik, masalan dars) kunda 1 marta dedupe qilinadi.
   */
  touchActivity: (userId: string, date: string, subjectId: string, delta?: { answered: number; correct: number }) => Promise<void>
}

export const useDailyStore = create<DailyState>()(
  persist(
    (set) => ({
      streaks: {},
      activityKey: null,
      todayAnswered: 0,

      sync: async (userId, date, subjectId) => {
        if (!userId || userId === '0') return // ghost user — faqat lokal
        try {
          const data = await api.getDaily(userId, date, subjectId)
          set((s) => ({
            streaks: { ...s.streaks, [subjectId]: data.dailyStreak },
            // Server bugungi JAMI savollar sonini qaytaradi (record.answered)
            todayAnswered: data.record?.answered ?? 0,
          }))
        } catch { /* offline — eski lokal holatda qolamiz */ }
      },

      touchActivity: async (userId, date, subjectId, delta) => {
        if (!userId || userId === '0') return
        const key = doneKeyOf(date, subjectId)
        // Sof faollik (dars) kunda 1 marta; savol delta'lari esa har safar
        if (!delta?.answered && useDailyStore.getState().activityKey === key) return
        try {
          const res = await api.touchDailyActivity(userId, {
            date, subjectId,
            answered: delta?.answered ?? 0,
            correct:  delta?.correct ?? 0,
          })
          set((s) => ({
            activityKey: key,
            streaks: { ...s.streaks, [subjectId]: res.dailyStreak },
            todayAnswered: s.todayAnswered + (delta?.answered ?? 0),
          }))
        } catch { /* offline — keyingi urinishda belgilanadi */ }
      },
    }),
    {
      name:    'yhq-daily',
      version: 3,
      // v1/v2 → v3: doneKey o'chirildi (kunlik topshiriq endi yo'q);
      // faqat fan bo'yicha streaklar saqlanadi.
      migrate: (state: unknown) => {
        const s = (state ?? {}) as { doneKey?: string | null; dailyStreak?: number; streaks?: Record<string, number> }
        const streaks = s.streaks ?? {}
        // Eski umumiy streak'ni faol fanga ko'chiramiz (doneKey: `date|subject`)
        if (s.dailyStreak && s.doneKey) {
          const subjectId = s.doneKey.split('|')[1]
          if (subjectId && !streaks[subjectId]) streaks[subjectId] = s.dailyStreak
        }
        return { streaks, activityKey: null }
      },
    },
  ),
)
