import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_SETTINGS = {
  autoNextCorrect: true,
  autoNextWrong: false,
  noAnimation: false,
  shuffleOptions: false,
  fontSize: 'medium',   // 'small' | 'medium' | 'large'
  fontStyle: 'default',
  language: 'uz',
  theme: 'dark',
}

export const useAppStore = create(
  persist(
    (set) => ({
      // User (from Telegram or mock)
      user: null,
      setUser: (user) => set({ user }),

      // Settings
      settings: { ...DEFAULT_SETTINGS },
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      // Streak & progress
      streak: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalAnswered: 0,
      addResult: (correct) =>
        set((s) => ({
          totalCorrect: s.totalCorrect + (correct ? 1 : 0),
          totalWrong: s.totalWrong + (correct ? 0 : 1),
          totalAnswered: s.totalAnswered + 1,
          streak: correct ? s.streak + 1 : 0,
        })),
      resetProgress: () =>
        set({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0 }),

      // Saved questions
      savedQuestions: [],
      toggleSaved: (questionId) =>
        set((s) => ({
          savedQuestions: s.savedQuestions.includes(questionId)
            ? s.savedQuestions.filter((id) => id !== questionId)
            : [...s.savedQuestions, questionId],
        })),

      // Tariff
      tariff: 'free',  // 'free' | 'premium'
    }),
    { name: 'yhq-app-store' }
  )
)
