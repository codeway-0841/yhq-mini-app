import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, type ApiUser, type ApiProgress, type ApiSettings } from '@/lib/api'

export type { ApiUser, ApiProgress, ApiSettings }

interface AppState {
  user:           ApiUser | null
  settings:       ApiSettings
  streak:         number
  totalCorrect:   number
  totalWrong:     number
  totalAnswered:  number
  wrongByTicket:  Record<string, number>
  savedQuestions: number[]
  tariff:         'free' | 'premium'
  initialized:    boolean

  setUser:        (user: ApiUser | null) => void
  updateSettings: (patch: Partial<ApiSettings>) => void
  updatePhone:    (phone: string) => Promise<void>
  addResult:      (correct: boolean, ticketId?: number) => void
  resetProgress:  () => void
  toggleSaved:    (questionId: number) => void
  syncFromServer: (userId: string) => Promise<void>
}

const DEFAULT_SETTINGS: ApiSettings = {
  autoNextCorrect: true,
  autoNextWrong:   false,
  noAnimation:     false,
  shuffleOptions:  false,
  fontSize:        'medium',
  fontStyle:       'default',
  language:        'uz',
  theme:           'dark',
  offlineMode:     false,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user:           null,
      settings:       { ...DEFAULT_SETTINGS },
      streak:         0,
      totalCorrect:   0,
      totalWrong:     0,
      totalAnswered:  0,
      wrongByTicket:  {},
      savedQuestions: [],
      tariff:         'free',
      initialized:    false,

      setUser: (user) => set({ user, tariff: user?.tariff ?? 'free' }),

      updatePhone: async (phone) => {
        const userId = get().user?.id
        if (!userId) return
        const originalPhone = get().user?.phone
        set((s) => s.user ? { user: { ...s.user, phone } } : {})
        try {
          await api.updatePhone(userId, phone)
        } catch (err) {
          set((s) => s.user ? { user: { ...s.user, phone: originalPhone } } : {})
          throw err
        }
      },

      updateSettings: (patch) => {
        const prev   = get().settings
        const userId = get().user?.id
        set((s) => ({ settings: { ...s.settings, ...patch } }))
        if (userId) {
          api.patchSettings(userId, patch).catch(() => set({ settings: prev }))
        }
      },

      addResult: (correct, ticketId?) => {
        // Read userId BEFORE set() — never call side-effects inside set()
        const userId = get().user?.id
        set((s) => ({
          totalCorrect:  s.totalCorrect  + (correct ? 1 : 0),
          totalWrong:    s.totalWrong    + (correct ? 0 : 1),
          totalAnswered: s.totalAnswered + 1,
          streak:        correct ? s.streak + 1 : 0,
          wrongByTicket: (!correct && ticketId != null)
            ? { ...s.wrongByTicket, [ticketId]: (s.wrongByTicket[ticketId] ?? 0) + 1 }
            : s.wrongByTicket,
        }))
        if (userId) api.postResult(userId, correct, ticketId).catch(console.error)
      },

      resetProgress: () => {
        const userId = get().user?.id
        set({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, wrongByTicket: {} })
        if (userId) api.resetProgress(userId).catch(console.error)
      },

      toggleSaved: (questionId) => {
        let wasSaved = false
        let userId: string | undefined
        set((s) => {
          wasSaved = s.savedQuestions.includes(questionId)
          userId   = s.user?.id
          return {
            savedQuestions: wasSaved
              ? s.savedQuestions.filter((id) => id !== questionId)
              : [...s.savedQuestions, questionId],
          }
        })
        if (userId) {
          (wasSaved
            ? api.removeSaved(userId, questionId)
            : api.addSaved(userId, questionId)
          ).catch(console.error)
        }
      },

      syncFromServer: async (userId) => {
        try {
          const data = await api.getProfile(userId)
          set({
            user:           data.user,
            tariff:         data.user.tariff,
            settings:       data.settings,
            streak:         data.progress.streak,
            totalCorrect:   data.progress.totalCorrect,
            totalWrong:     data.progress.totalWrong,
            totalAnswered:  data.progress.totalAnswered,
            wrongByTicket:  data.progress.wrongByTicket,
            savedQuestions: data.savedQuestions,
          })
        } catch (err) {
          console.error('syncFromServer failed:', err)
        }
      },
    }),
    { name: 'yhq-app-store' }
  )
)
