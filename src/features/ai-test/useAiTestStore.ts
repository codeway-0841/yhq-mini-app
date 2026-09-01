/**
 * AI Kunlik Test — sessiya store (resume uchun persist).
 *
 * 45 topshiriq uzoq davom etadi — javoblar har o'zgarishda localStorage'ga
 * yoziladi; sahifa yopilib qayta ochilganda (yoki app restart) davom etadi.
 * `testId` mos kelmasa (yangi kun/yangi variant) — avtomatik tozalanadi.
 * Account switch'da ACCOUNT_STORAGE_KEYS ('yhq-ai-test') orqali tozalanadi.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiTestAnswers, AiTestPublicPayload } from '../../../shared/ai-daily-test'

const EMPTY: AiTestAnswers = { mcq: {}, matching: {}, short: {}, essay: '' }

interface AiTestSessionState {
  /** Qaysi test uchun javoblar (null = bo'sh) */
  testId: number | null
  answers: AiTestAnswers
  startedAt: number
  /** Yangi test sessiyasi (eski javoblar tozalanadi) */
  start: (testId: number) => void
  setMcq: (taskId: string, optionId: string) => void
  setMatching: (taskId: string, leftId: string, rightId: string) => void
  setShort: (taskId: string, text: string) => void
  setEssay: (text: string) => void
  /** Submit'dan keyin (yoki chiqib ketishda) tozalash */
  reset: () => void
}

export const useAiTestStore = create<AiTestSessionState>()(
  persist(
    (set, get) => ({
      testId: null,
      answers: EMPTY,
      startedAt: 0,

      start: (testId) => {
        if (get().testId !== testId) {
          set({ testId, answers: EMPTY, startedAt: Date.now() })
        }
      },

      setMcq: (taskId, optionId) =>
        set((s) => ({ answers: { ...s.answers, mcq: { ...s.answers.mcq, [taskId]: optionId } } })),

      setMatching: (taskId, leftId, rightId) =>
        set((s) => ({
          answers: {
            ...s.answers,
            matching: {
              ...s.answers.matching,
              [taskId]: { ...(s.answers.matching[taskId] ?? {}), [leftId]: rightId },
            },
          },
        })),

      setShort: (taskId, text) =>
        set((s) => ({ answers: { ...s.answers, short: { ...s.answers.short, [taskId]: text } } })),

      setEssay: (text) =>
        set((s) => ({ answers: { ...s.answers, essay: text } })),

      reset: () => set({ testId: null, answers: EMPTY, startedAt: 0 }),
    }),
    { name: 'yhq-ai-test' },
  ),
)

/** Javob berilgan topshiriqlar soni (progress "X/45"; matching to'liq tanlanganda hisoblanadi) */
export function countAnsweredTasks(answers: AiTestAnswers, payload: AiTestPublicPayload): number {
  let n = 0
  for (const t of payload.tasks) {
    switch (t.kind) {
      case 'mcq':
        if (answers.mcq[t.id]) n++
        break
      case 'matching': {
        const m = answers.matching[t.id]
        if (m && t.left.every((l) => m[l.id])) n++
        break
      }
      case 'short':
        if ((answers.short[t.id] ?? '').trim().length > 0) n++
        break
      case 'essay':
        if (answers.essay.trim().length > 0) n++
        break
    }
  }
  return n
}
