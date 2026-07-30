/**
 * Adaptive (Smart) test store — persists SR cards locally.
 * Separate from useAppStore to keep concerns clean.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type SRCard, createCard, updateCard, pickNext } from '../lib/spaced-repetition'
import { useQuestionsStore } from './useQuestionsStore'

interface AdaptiveState {
  cards:        Record<number, SRCard>  // questionId → SRCard
  currentId:    number | null
  sessionCount: number                  // answered this session

  startSession:    () => void
  submitAnswer:    (questionId: number, quality: 0 | 1) => void
  resetAll:        () => void
}

export const useAdaptiveStore = create<AdaptiveState>()(
  persist(
    (set, get) => ({
      cards:        {},
      currentId:    null,
      sessionCount: 0,

      startSession: () => {
        const cards = new Map(
          Object.entries(get().cards).map(([k, v]) => [Number(k), v])
        )
        const allIds = useQuestionsStore.getState().questions.map(q => q.id)
        const next = pickNext(cards, allIds)
        set({ currentId: next ?? null, sessionCount: 0 })
      },

      submitAnswer: (questionId, quality) => {
        const cards = new Map(
          Object.entries(get().cards).map(([k, v]) => [Number(k), v])
        )
        const card    = cards.get(questionId) ?? createCard(questionId)
        const updated = updateCard(card, quality)
        cards.set(questionId, updated)

        const allIds = useQuestionsStore.getState().questions.map(q => q.id)
        const next = pickNext(cards, allIds, questionId)

        // Persist as plain object
        const cardsObj: Record<number, SRCard> = {}
        cards.forEach((v, k) => { cardsObj[k] = v })

        set((s) => ({
          cards:        cardsObj,
          currentId:    next ?? null,
          sessionCount: s.sessionCount + 1,
        }))
      },

      resetAll: () => set({ cards: {}, currentId: null, sessionCount: 0 }),
    }),
    { name: 'yhq-adaptive-store' }
  )
)
