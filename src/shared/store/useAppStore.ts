import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, avatarSrcFor, type ApiUser, type ApiProgress, type ApiSettings, type FullProfile } from '@/shared/api'
import { enqueueOutbox } from '@/shared/lib/outbox'
import { questionKey, DEFAULT_SUBJECT_ID } from '../../../shared/subjects'
import { useSubjectStore } from './useSubjectStore'
import { useDailyStore, todayStr } from './useDailyStore'
import { settingsService } from '../services/settings-service'
import {
  answerService,
  type SubmitOutcome,
  type SubmitFatal,
  type SubmitResult,
} from '../services/answer-service'

export type { ApiUser, ApiProgress, ApiSettings }
export type { SubmitOutcome, SubmitFatal, SubmitResult }

/**
 * Custom avatar SINXRONLASH (hydrateFromProfile/syncFromServer'da umumiy):
 * server `hasCustomAvatar` — YAGONA manba (users.avatar_webp).
 */
function syncAvatarState(localAvatar: string | null, user: ApiUser): string | null {
  if (user.hasCustomAvatar) return avatarSrcFor(user)
  if (localAvatar?.startsWith('data:image/')) {
    if (user.id && user.id !== '0') void api.uploadAvatar(user.id, localAvatar).catch(() => {})
    return localAvatar
  }
  return null
}

export interface ApplyAnswerInput {
  questionId:   number
  correct:      boolean
  subjectId:    string
  date:         string
  dailyStreak:  number | null
  coinSaved?:   boolean
  coinBalance?: number | null
  xp?:          number | null
}

interface AppState {
  user:           ApiUser | null
  settings:       ApiSettings
  streak:         number
  /** Umrbod XP (server hisoblaydi) — level shundan (shared/xp.ts levelFromXp) */
  xp:             number
  /** Haftalik liga darajasi (server progress.league, cron yuritadi) */
  league:         'bronze' | 'silver' | 'gold' | 'platinum'
  totalCorrect:   number
  totalWrong:     number
  totalAnswered:  number
  wrongByTicket:  Record<string, number>
  /** Composite kalitlar: `${subjectId}:${questionId}` ('yhq:123') — multi-fan identity */
  savedQuestions: string[]
  /** Composite kalitlar: `${subjectId}:${questionId}` — unique yechilgan savollar to'plami */
  solvedQuestions: string[]
  tariff:         'free' | 'premium'
  initialized:    boolean
  /** User-set display name override (Telegram name o'rniga) */
  displayName:    string | null
  /** Avatar src keshi: 256px WebP data URL YOKI server URL */
  customAvatar:   string | null
  /** Aksent temasi id (src/config/themes.ts). Lokal pref. */
  accent:         string
  /** #40: coin balansi — SERVER SSOT cache */
  coins:          number
  /** #40: do'konda sotib olingan buyumlar id'lari */
  ownedItems:     string[]
  /** #40: joriy avatar ramkasi yoki null */
  avatarFrame:    string | null

  setUser:            (user: ApiUser | null) => void
  setDisplayName:     (name: string | null) => void
  setCustomAvatar:    (avatar: string | null) => void
  setAccent:          (accent: string) => void
  setCoins:           (coins: number) => void
  addOwnedItem:       (itemId: string) => void
  setAvatarFrame:     (frame: string | null) => void
  updateSettings:     (patch: Partial<ApiSettings>) => void
  updatePhone:        (phone: string, otp: string) => Promise<void>
  /** Javobni yuborish (answerService ga delegatsiya qiladi) */
  submitAnswer:       (questionId: number, selectedAnswer: string | null, elapsedMs?: number) => Promise<SubmitResult>
  /** Server tasdiqlagan javobni sinxron holatga qo'llash (submit va outbox replay uchun yagona) */
  applyAnswerMutation:(input: ApplyAnswerInput) => void
  resetProgress:      () => void
  toggleSaved:        (questionId: number) => void
  syncFromServer:     (userId: string) => Promise<void>
  hydrateFromProfile: (data: FullProfile) => void
  resetAccount:       () => void
}

/**
 * Persist (localStorage) uchun user obyektidan PII'ni ajratadi.
 */
export function stripUserPii(user: ApiUser | null): ApiUser | null {
  if (!user) return null
  const { phone: _phone, ...rest } = user
  return { ...rest, phone: undefined }
}

const DEFAULT_SETTINGS: ApiSettings = {
  autoNextCorrect:   true,
  autoNextWrong:     false,
  noAnimation:       false,
  shuffleOptions:    false,
  fontSize:          'medium',
  fontStyle:         'default',
  language:          'uz',
  theme:             'dark',
  offlineMode:       true,
  dailyReminder:     true,
  dailyReminderTime: '20:00',
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const applyAnswer = (input: ApplyAnswerInput) => {
        const { questionId, correct, subjectId, date, dailyStreak, coinSaved, coinBalance, xp } = input
        const wKey = questionKey(subjectId, questionId)
        const wasWrong = correct && (get().wrongByTicket[wKey] ?? 0) > 0

        set((s) => {
          const solved = s.solvedQuestions ?? []
          const nextSolved = solved.includes(wKey) ? solved : [...solved, wKey]
          return {
            totalCorrect:    s.totalCorrect  + (correct ? 1 : 0),
            totalWrong:      s.totalWrong    + (correct ? 0 : 1),
            totalAnswered:   s.totalAnswered + 1,
            solvedQuestions: nextSolved,
            streak:          correct ? s.streak + 1 : 0,
            wrongByTicket: correct
              ? (() => {
                  const next = { ...s.wrongByTicket }
                  delete next[wKey]
                  return next
                })()
              : { ...s.wrongByTicket, [wKey]: (s.wrongByTicket[wKey] ?? 0) + 1 },
            ...(typeof coinBalance === 'number' ? { coins: coinBalance } : {}),
            ...(typeof xp === 'number' ? { xp } : {}),
          }
        })

        if (dailyStreak !== null) {
          useDailyStore.getState().applyServerResult(date, subjectId, dailyStreak, coinSaved)
        }

        const userId = get().user?.id
        if (wasWrong && userId) {
          answerService.triggerDailyFix(userId, subjectId)
        }
      }

      return {
        user:           null,
        settings:       { ...DEFAULT_SETTINGS },
        streak:         0,
        xp:             0,
        league:         'bronze',
        totalCorrect:   0,
        totalWrong:     0,
        totalAnswered:  0,
        wrongByTicket:  {},
        savedQuestions:  [],
        solvedQuestions: [],
        tariff:          'free',
        initialized:    false,
        displayName:    null,
        customAvatar:   null,
        accent:         'kiwi',
        coins:          0,
        ownedItems:     [],
        avatarFrame:    null,

        setUser: (user) => set({ user, tariff: user?.tariff ?? 'free' }),
        setDisplayName: (name) => set({ displayName: name?.trim() || null }),
        setCustomAvatar: (avatar) => set({ customAvatar: avatar || null }),
        setAccent: (accent) => set({ accent }),
        setCoins: (coins) => set({ coins: Math.max(0, Math.floor(coins)) }),
        addOwnedItem: (itemId) => set((s) =>
          s.ownedItems.includes(itemId) ? {} : { ownedItems: [...s.ownedItems, itemId] }),
        setAvatarFrame: (frame) => set({ avatarFrame: frame }),

        applyAnswerMutation: applyAnswer,

        updatePhone: async (phone, otp) => {
          const userId = get().user?.id
          if (!userId) return
          const originalPhone = get().user?.phone
          set((s) => s.user ? { user: { ...s.user, phone } } : {})
          try {
            await api.updatePhone(userId, phone, otp)
          } catch (err) {
            set((s) => s.user ? { user: { ...s.user, phone: originalPhone } } : {})
            throw err
          }
        },

        updateSettings: (patch) => {
          const prev   = get().settings
          const userId = get().user?.id
          const next   = { ...prev, ...patch }
          set({ settings: next })

          if (patch.dailyReminder !== undefined || patch.dailyReminderTime !== undefined || patch.language !== undefined) {
            settingsService.syncNativeReminder(next)
          }

          settingsService.syncSettingsRemote(userId, patch, () => {
            set({ settings: prev })
          })
        },

        submitAnswer: async (questionId, selectedAnswer, elapsedMs) => {
          const userId = get().user?.id
          const subjectId = useSubjectStore.getState().subjectId
          if (!userId || userId === '0') return null

          const response = await answerService.submitAnswerToServer({
            userId,
            subjectId,
            questionId,
            selectedAnswer,
            elapsedMs,
          })

          if ('serverData' in response) {
            const { outcome, serverData } = response
            if (!outcome.duplicate) {
              const extras = {
                ...((outcome.coinsEarned ?? 0) > 0 && typeof serverData.coinBalance === 'number'
                  ? { coinBalance: serverData.coinBalance }
                  : {}),
                ...(typeof serverData.xp === 'number' ? { xp: serverData.xp } : {}),
              }
              if (serverData.correct !== null) {
                applyAnswer({
                  questionId,
                  correct: serverData.correct,
                  subjectId,
                  date: todayStr(),
                  dailyStreak: serverData.dailyStreak,
                  coinSaved: serverData.coinSaved,
                  ...extras,
                })
              } else if (extras.coinBalance !== undefined || extras.xp !== undefined) {
                set({
                  ...(extras.coinBalance !== undefined ? { coins: extras.coinBalance! } : {}),
                  ...(extras.xp !== undefined ? { xp: extras.xp! } : {}),
                })
              }
            }
            return outcome
          }

          return response.outcome
        },

        resetProgress: () => {
          const userId = get().user?.id
          set({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, xp: 0, wrongByTicket: {}, solvedQuestions: [] })
          if (userId && userId !== '0') api.resetProgress(userId).catch(console.error)
        },

        toggleSaved: (questionId) => {
          const userId    = get().user?.id
          const subjectId = useSubjectStore.getState().subjectId
          const key       = questionKey(subjectId, questionId)
          const wasSaved  = get().savedQuestions.includes(key)
          set((s) => ({
            savedQuestions: wasSaved
              ? s.savedQuestions.filter((k) => k !== key)
              : [...s.savedQuestions, key],
          }))
          if (userId && userId !== '0') {
            (wasSaved
              ? api.removeSaved(userId, questionId, subjectId)
              : api.addSaved(userId, questionId, subjectId)
            ).catch(() => {
              enqueueOutbox(userId, wasSaved ? 'saved-remove' : 'saved-add', { questionId, subjectId })
            })
          }
        },

        hydrateFromProfile: (data) => {
          settingsService.syncNativeReminder(data.settings)
          const customAvatar = syncAvatarState(get().customAvatar, data.user)
          set((s) => ({
            user:            data.user,
            tariff:          data.user.tariff,
            settings:        data.settings,
            streak:          data.progress.streak,
            xp:              data.progress.xp ?? s.xp,
            league:          data.progress.league ?? s.league,
            totalCorrect:    data.progress.totalCorrect,
            totalWrong:      data.progress.totalWrong,
            totalAnswered:   data.progress.totalAnswered,
            wrongByTicket:   data.progress.wrongByTicket,
            solvedQuestions: Array.from(new Set([...(s.solvedQuestions ?? []), ...(data.progress.solvedQuestions ?? [])])),
            savedQuestions:  data.savedQuestions,
            coins:           data.user.coins ?? 0,
            ownedItems:      data.user.ownedItems ?? [],
            avatarFrame:     data.user.avatarFrame ?? null,
            customAvatar,
          }))
        },

        resetAccount: () => set({
          user: null,
          settings: { ...DEFAULT_SETTINGS },
          streak: 0,
          xp: 0,
          league: 'bronze',
          totalCorrect: 0,
          totalWrong: 0,
          totalAnswered: 0,
          wrongByTicket: {},
          savedQuestions: [],
          solvedQuestions: [],
          tariff: 'free',
          initialized: false,
          displayName: null,
          customAvatar: null,
          coins: 0,
          ownedItems: [],
          avatarFrame: null,
        }),

        syncFromServer: async (userId) => {
          try {
            const data = await api.getProfile(userId)
            const customAvatar = syncAvatarState(get().customAvatar, data.user)
            set((s) => ({
              user:            data.user,
              tariff:          data.user.tariff,
              settings:        data.settings,
              streak:          data.progress.streak,
              xp:              data.progress.xp ?? s.xp,
              league:          data.progress.league ?? s.league,
              totalCorrect:    data.progress.totalCorrect,
              totalWrong:      data.progress.totalWrong,
              totalAnswered:   data.progress.totalAnswered,
              wrongByTicket:   data.progress.wrongByTicket,
              solvedQuestions: Array.from(new Set([...(s.solvedQuestions ?? []), ...(data.progress.solvedQuestions ?? [])])),
              savedQuestions:  data.savedQuestions,
              coins:           data.user.coins ?? 0,
              ownedItems:      data.user.ownedItems ?? [],
              avatarFrame:     data.user.avatarFrame ?? null,
              customAvatar,
            }))
          } catch (err) {
            console.error('syncFromServer failed:', err)
          }
        },
      }
    },
    {
      name: 'yhq-app-store',
      version: 2,
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Record<string, unknown> & {
          settings?: Record<string, unknown>
          wrongByTicket?: Record<string, number>
          savedQuestions?: Array<number | string>
        }
        const wrong: Record<string, number> = {}
        for (const [k, v] of Object.entries(p.wrongByTicket ?? {})) {
          wrong[k.includes(':') ? k : `${DEFAULT_SUBJECT_ID}:${k}`] = v
        }
        const saved = (p.savedQuestions ?? []).map((x) =>
          typeof x === 'number' ? `${DEFAULT_SUBJECT_ID}:${x}` : x)
        const solved = Array.isArray(p.solvedQuestions) ? p.solvedQuestions : []
        return {
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}), offlineMode: true },
          wrongByTicket: wrong,
          savedQuestions: saved,
          solvedQuestions: solved,
        } as never
      },
      partialize: (s) => ({
        user:           stripUserPii(s.user),
        settings:       s.settings,
        streak:         s.streak,
        xp:             s.xp,
        league:         s.league,
        totalCorrect:   s.totalCorrect,
        totalWrong:     s.totalWrong,
        totalAnswered:  s.totalAnswered,
        wrongByTicket:  s.wrongByTicket,
        savedQuestions: s.savedQuestions,
        displayName:    s.displayName,
        tariff:         s.tariff,
        accent:         s.accent,
        coins:          s.coins,
        ownedItems:     s.ownedItems,
        avatarFrame:    s.avatarFrame,
      }),
    }
  )
)
