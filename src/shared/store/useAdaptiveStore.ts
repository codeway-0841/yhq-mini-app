/**
 * Adaptive (Smart) test store — persists SR cards locally.
 * Separate from useAppStore to keep concerns clean.
 *
 * Kartalar FANGA QARAB ajratilgan (cardsBySubject) — question id'lari har bir
 * fan bankasida mustaqil raqamlanadi; aralash Kartalar (id collision) bo'lmasin.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type SRCard, createCard, updateCard, pickNext } from '../lib/spaced-repetition'
import { useQuestionsStore } from './useQuestionsStore'
import { useSubjectStore } from './useSubjectStore'
import { api } from '../api'
import { enqueueOutbox } from '../lib/outbox'

interface AdaptiveState {
  /** subjectId → (questionId → SRCard). */
  cardsBySubject: Record<string, Record<number, SRCard>>
  currentId:      number | null
  sessionCount:   number                  // answered this session

  startSession:        () => void
  /** Karta darhol yangilanadi (UI 800ms feedback'dan keyin advanceNext qiladi) */
  recordAnswer:        (questionId: number, quality: 0 | 1, userId?: string) => void
  advanceNext:         () => void
  syncCardsFromServer: (userId: string, subjectId?: string) => Promise<void>
  resetAll:            () => void
}

/** Persist formatiga o'girish helper */
const mapOf = (cards: Record<number, SRCard>) =>
  new Map(Object.entries(cards).map(([k, v]) => [Number(k), v]))

const objOf = (cards: Map<number, SRCard>) => {
  const o: Record<number, SRCard> = {}
  cards.forEach((v, k) => { o[k] = v })
  return o
}

export const useAdaptiveStore = create<AdaptiveState>()(
  persist(
    (set, get) => ({
      cardsBySubject: {},
      currentId:      null,
      sessionCount:   0,

      startSession: () => {
        const subjectId = useSubjectStore.getState().subjectId
        const cards     = mapOf(get().cardsBySubject[subjectId] ?? {})
        const allIds    = useQuestionsStore.getState().questions.map(q => q.id)
        const next      = pickNext(cards, allIds)
        set({ currentId: next ?? null, sessionCount: 0 })
      },

      recordAnswer: (questionId, quality, userId) => {
        const subjectId = useSubjectStore.getState().subjectId
        const cards     = mapOf(get().cardsBySubject[subjectId] ?? {})
        const card      = cards.get(questionId) ?? createCard(questionId)
        const updated   = updateCard(card, quality)
        cards.set(questionId, updated)
        set((s) => ({
          cardsBySubject: { ...s.cardsBySubject, [subjectId]: objOf(cards) },
          sessionCount:   s.sessionCount + 1,
        }))

        if (userId && userId !== '0') {
          enqueueOutbox(userId, 'card-review', {
            subjectId,
            questionId,
            ef:       updated.ef,
            interval: updated.interval,
            reps:     updated.reps,
            dueAt:    updated.dueAt,
          })
        }
      },

      syncCardsFromServer: async (userId, subjectId) => {
        if (!userId || userId === '0') return
        const subj = subjectId ?? useSubjectStore.getState().subjectId
        try {
          const res = await api.getCards(userId, subj)
          if (res?.cards) {
            set((s) => ({
              cardsBySubject: {
                ...s.cardsBySubject,
                [subj]: {
                  ...(s.cardsBySubject[subj] ?? {}),
                  ...res.cards,
                },
              },
            }))
          }
        } catch {
          // Offline yoki tarmoq xatosi — lokal saqlangan holat bilan davom etiladi
        }
      },

      advanceNext: () => {
        const subjectId = useSubjectStore.getState().subjectId
        const cards     = mapOf(get().cardsBySubject[subjectId] ?? {})
        const allIds    = useQuestionsStore.getState().questions.map(q => q.id)
        const next      = pickNext(cards, allIds, get().currentId ?? undefined)
        set({ currentId: next ?? null })
      },

      resetAll: () => set({ cardsBySubject: {}, currentId: null, sessionCount: 0 }),
    }),
    {
      name: 'yhq-adaptive-store',
      version: 1,
      // Session pointer vaqtinchalik; faqat uzoq muddatli SR kartalar persist bo'ladi.
      partialize: (s) => ({ cardsBySubject: s.cardsBySubject }) as AdaptiveState,
      // v0: tekis { cards, currentId, sessionCount } — barchasi YHQ (bitta real fan)
      // ga tegishli deb qabul qilinadi va ko'chiriladi.
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as { cards?: Record<number, SRCard>; cardsBySubject?: Record<string, Record<number, SRCard>> }
        if (p.cardsBySubject) return p as never
        return {
          cardsBySubject: p.cards ? { yhq: p.cards } : {},
          currentId:      null,
          sessionCount:   0,
        } as never
      },
    }
  )
)
