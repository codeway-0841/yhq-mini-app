import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeliveredTestQuestion } from '../../../shared/test-session'

export type ServerAnswerStatus = 'correct' | 'wrong' | null
export type ServerPracticeMode = 'random20' | 'random50' | 'random100' | 'saved' | 'mistakes' | 'topic' | 'ticket' | 'mock' | 'exam' | 'single'

export interface ServerTestSnapshot {
  sessionId: string
  subjectId: string
  mode: ServerPracticeMode
  /** Parametrli selector (masalan topicId) boshqa session bilan aralashmasin. */
  selectorKey: string
  total: number
  /** Server deadline; reload vaqtni qayta boshlamaydi. */
  expiresAt: string
  current: number
  questions: DeliveredTestQuestion[]
  answers: ServerAnswerStatus[]
  selected: (string | null)[]
  correctOptions: (string | null)[]
  /** Tarmoq javobi yo'qolsa aynan shu idempotency token bilan retry. */
  pendingTokens: Record<number, string>
}

interface ServerTestSessionState {
  snapshot: ServerTestSnapshot | null
  save: (snapshot: ServerTestSnapshot) => void
  clear: () => void
}

export const useServerTestSessionStore = create<ServerTestSessionState>()(
  persist(
    (set) => ({
      snapshot: null,
      save: (snapshot) => set({ snapshot }),
      clear: () => set({ snapshot: null }),
    }),
    { name: 'yhq-server-test-session', version: 4 },
  ),
)
