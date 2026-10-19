import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Darslik progress — HAR BIR foydalanuvchi uchun alohida saqlanadi.
 * Boshqa akkauntga kirganda o'z progressi ko'rsatiladi.
 */
interface LessonsState {
  /**
   * userId → moduleId → tugallangan dars indekslari (0-based).
   * Rus tili darsligida bu — testdan o'tilgan mavzular; YHQ darsligida
   * avvalgidek o'qib bo'lingan darslar.
   */
  byUser: Record<string, Record<number, number[]>>
  /**
   * userId → moduleId → o'qilgan, lekin testdan hali o'tilmagan mavzular.
   * Darslikning keyingi mavzusi faqat oldingi mavzu `byUser` ga tushgach
   * ochiladi; shuning uchun "o'qildi" va "tugallandi" alohida saqlanadi.
   */
  readByUser: Record<string, Record<number, number[]>>
  markDone: (userId: string, moduleId: number, lessonIdx: number) => void
  markRead: (userId: string, moduleId: number, lessonIdx: number) => void
  doneFor:  (userId: string, moduleId: number) => number[]
  readFor:  (userId: string, moduleId: number) => number[]
  totalDoneFor: (userId: string) => number
}

export const useLessonsStore = create<LessonsState>()(
  persist(
    (set, get) => ({
      byUser: {},
      readByUser: {},

      markDone(userId, moduleId, lessonIdx) {
        if (!userId) return
        const userMap   = get().byUser[userId] ?? {}
        const list      = userMap[moduleId] ?? []
        if (list.includes(lessonIdx)) return
        set((s) => ({
          byUser: {
            ...s.byUser,
            [userId]: {
              ...userMap,
              [moduleId]: [...list, lessonIdx].sort((a, b) => a - b),
            },
          },
        }))
      },

      markRead(userId, moduleId, lessonIdx) {
        if (!userId) return
        const userMap   = get().readByUser[userId] ?? {}
        const list      = userMap[moduleId] ?? []
        if (list.includes(lessonIdx)) return
        set((s) => ({
          readByUser: {
            ...s.readByUser,
            [userId]: {
              ...userMap,
              [moduleId]: [...list, lessonIdx].sort((a, b) => a - b),
            },
          },
        }))
      },

      doneFor(userId, moduleId) {
        return get().byUser[userId]?.[moduleId] ?? []
      },

      readFor(userId, moduleId) {
        return get().readByUser[userId]?.[moduleId] ?? []
      },

      totalDoneFor(userId) {
        const map = get().byUser[userId]
        if (!map) return 0
        return Object.values(map).reduce((s, arr) => s + arr.length, 0)
      },
    }),
    { name: 'yhq-lessons-store' }
  )
)
