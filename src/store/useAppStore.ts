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
  /** User-set display name override (Telegram name o'rniga) */
  displayName:    string | null

  setUser:        (user: ApiUser | null) => void
  setDisplayName: (name: string | null) => void
  updateSettings: (patch: Partial<ApiSettings>) => void
  updatePhone:    (phone: string) => Promise<void>
  addResult:      (correct: boolean, questionId?: number) => void
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
  offlineMode:     true,   // eski default (false) noto'g'ri edi — SW avval hamma uchun ishlardi
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
      displayName:    null,

      setUser: (user) => set({ user, tariff: user?.tariff ?? 'free' }),
      setDisplayName: (name) => set({ displayName: name?.trim() || null }),

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
        if (userId && userId !== '0') {
          // Mahalliy tanlov UI da darhol qo'llanadi; tarmoq xatosi bo'lsa
          // SERVERga qaytarilmaydi (rollback "tepada qirish" UX'ni yoq qilardi) —
          // keyingi ochilishda init/syncing server bilan tekislaydi.
          api.patchSettings(userId, patch).catch((err) => {
            console.warn('Settings sync xatosi (mahalliy tanlov saqlandi):', err?.message ?? err)
            // Faqat validatsiya xatosida (400) eski qiymatga qaytaramiz
            if (String(err?.message ?? '').includes(' 400')) set({ settings: prev })
          })
        }
      },

      addResult: (correct, questionId?) => {
        // Read userId BEFORE set() — never call side-effects inside set()
        const userId = get().user?.id
        set((s) => ({
          totalCorrect:  s.totalCorrect  + (correct ? 1 : 0),
          totalWrong:    s.totalWrong    + (correct ? 0 : 1),
          totalAnswered: s.totalAnswered + 1,
          streak:        correct ? s.streak + 1 : 0,
          wrongByTicket: questionId != null
            ? correct
              ? (() => {
                  // Xato tuzatildi — ro'yxatdan o'chir ("Xatolarni tuzatish"dan yo'qoladi)
                  const next = { ...s.wrongByTicket }
                  delete next[questionId]
                  return next
                })()
              : { ...s.wrongByTicket, [questionId]: (s.wrongByTicket[questionId] ?? 0) + 1 }
            : s.wrongByTicket,
        }))
        if (userId && userId !== '0') api.postResult(userId, correct, questionId).catch(console.error)
      },

      resetProgress: () => {
        const userId = get().user?.id
        set({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, wrongByTicket: {} })
        if (userId && userId !== '0') api.resetProgress(userId).catch(console.error)
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
        if (userId && userId !== '0') {
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
    {
      name: 'yhq-app-store',
      version: 1,
      // Eski versiya (0) → yangi: settings'ni DEFAULT bilan birlashtirish
      // (yangi kalitlar qo'shilganda undefined bo'lib qolmasligi uchun)
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Record<string, unknown> & { settings?: Record<string, unknown> }
        // v0: offlineMode eski toggle HECH NIMA QILMASDI — foydalanuvchi aslida
        // uni o'chirmagan (SW baribir ishlardi), shuning uchun true'ga ko'taramiz.
        return {
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}), offlineMode: true },
        } as never
      },
      // initialized va user PERSIST QILINMAYDI — har reload'da serverdan yangi
      // holat keladi; aks holda eski (stale) stats bir soniyaga "flash" bo'lardi.
      partialize: (s) => ({
        settings:       s.settings,
        streak:         s.streak,
        totalCorrect:   s.totalCorrect,
        totalWrong:     s.totalWrong,
        totalAnswered:  s.totalAnswered,
        wrongByTicket:  s.wrongByTicket,
        savedQuestions: s.savedQuestions,
        displayName:    s.displayName,
        tariff:         s.tariff,
      }),
    }
  )
)
