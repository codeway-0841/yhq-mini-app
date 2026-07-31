import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LessonsState {
  /** moduleId → o'qib bo'lingan dars indekslari (0-based) */
  done: Record<number, number[]>
  markDone: (moduleId: number, lessonIdx: number) => void
  isDoneClient: (moduleId: number, lessonIdx: number) => boolean
}

export const useLessonsStore = create<LessonsState>()(
  persist(
    (set, get) => ({
      done: {},

      markDone(moduleId, lessonIdx) {
        const list = get().done[moduleId] ?? []
        if (list.includes(lessonIdx)) return
        set((s) => ({
          done: { ...s.done, [moduleId]: [...list, lessonIdx].sort((a, b) => a - b) },
        }))
      },

      isDoneClient(moduleId, lessonIdx) {
        return (get().done[moduleId] ?? []).includes(lessonIdx)
      },
    }),
    { name: 'yhq-lessons-store' }
  )
)
