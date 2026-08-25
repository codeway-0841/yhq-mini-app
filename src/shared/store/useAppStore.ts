import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, ApiError, avatarSrcFor, type ApiUser, type ApiProgress, type ApiSettings, type FullProfile } from '@/shared/api'
import { enqueueOutbox, setResultSyncHandler, newId } from '@/shared/lib/outbox'
import { questionKey, DEFAULT_SUBJECT_ID } from '../../../shared/subjects'
import { useSubjectStore } from './useSubjectStore'
import { useDailyStore, todayStr } from './useDailyStore'
import { scheduleDailyStreakReminder, cancelDailyStreakReminder } from '../../platform/native'

export type { ApiUser, ApiProgress, ApiSettings }

/** submitAnswer natijasi — null bo'lsa OFFLINE (outbox'ga yozildi, keyin hisoblanadi) */
export interface SubmitOutcome {
  /** duplicate'da null — server counterlarni qayta yozmagan, natija noma'lum */
  correct:       boolean | null
  /** Post-answer reveal — FAQAT yangi javobda; duplicate replay'da null */
  correctAnswer: string | null
  /** Server bu javobni avval qabul qilgan (idempotent replay) — counterlar tegmang */
  duplicate:     boolean
  /** #40: shu javob server'da mint qilgan tangalar (0/1) — UI toast uchun */
  coinsEarned:   number
}

/** Fatal: server javobni QAT'IY rad etdi (retryable bo'lmagan 4xx) —
 *  outbox'ga YOZILMADI (flush birinchi urunishda tashlab yuborardi) va javob
 *  saqlanMADI. UI "offline queued" deb YOLG'ON ko'rsatmasligi shart — xato
 *  toast + tanlov rollback (qayta urinish mumkin). */
export interface SubmitFatal { fatal: true; code?: string }

/** null = OFFLINE (outbox'da); SubmitFatal = rad etildi; SubmitOutcome = server baholadi */
export type SubmitResult = SubmitOutcome | SubmitFatal | null

/**
 * Custom avatar SINXRONLASH (hydrateFromProfile/syncFromServer'da umumiy):
 * server `hasCustomAvatar` — YAGONA manba (users.avatar_webp).
 *  - Server'da BOR → lokal kesh server URL'iga yangilanadi (hamma qurilmada bir xil).
 *  - Server'da YO'Q + lokal data URL bor → BIR MARTALIK backfill upload (eski
 *    qurilmalar migratsiyasi, fire-and-forget/offline-safe); lokal qoldiriladi —
 *    keyingi hydrate'da server `true` qaytarib URL'ga almashtiradi.
 *  - Ikkalasida ham yo'q → lokal tozalanadi (boshqa qurilmada o'chirilgan).
 */
function syncAvatarState(localAvatar: string | null, user: ApiUser): string | null {
  if (user.hasCustomAvatar) return avatarSrcFor(user)
  if (localAvatar?.startsWith('data:image/')) {
    if (user.id && user.id !== '0') void api.uploadAvatar(user.id, localAvatar).catch(() => {})
    return localAvatar
  }
  return null
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
  /** Avatar src keshi: 256px WebP data URL (yangi yuklash) YOKI server URL
   *  ('/api/avatar/:id'). Server manba: users.avatar_webp (syncAvatarState). */
  customAvatar:   string | null
  /** Aksent temasi id (src/config/themes.ts). Lokal pref — serverga yuborilmaydi.
   *  Premium/coin temalar faqat App.tsx dagi resolveAccent (egalik bilan) orqali qo'llanadi. */
  accent:         string
  /** #40: coin balansi — SERVER SSOT cache (client hech qachon o'zi mint qilmaydi) */
  coins:          number
  /** #40: do'konda sotib olingan buyumlar id'lari (shared/shop-items) */
  ownedItems:     string[]
  /** #40: joriy avatar ramkasi (avatar-frames config id) yoki null */
  avatarFrame:    string | null

  setUser:        (user: ApiUser | null) => void
  setDisplayName: (name: string | null) => void
  setCustomAvatar: (avatar: string | null) => void
  setAccent:      (accent: string) => void
  /** #40: server javobidan coin holatini qo'llash (result mint / purchase / profile) */
  setCoins:       (coins: number) => void
  addOwnedItem:   (itemId: string) => void
  setAvatarFrame: (frame: string | null) => void
  updateSettings: (patch: Partial<ApiSettings>) => void
  updatePhone:    (phone: string, otp: string) => Promise<void>
  /**
   * Javobni SERVER'ga yuboradi va tekshiruv natijasini qaytaradi.
   * correctAnswer client'da yo'q (public /questions javobsiz) — feedback
   * FAQAT shu natijaga tayanadi. null = offline (outbox'ga yozildi);
   * { fatal } = server QAT'IY rad etdi (4xx) — outbox'siz, javob yo'qoldi.
   */
  submitAnswer:   (questionId: number, selectedAnswer: string | null, elapsedMs?: number) => Promise<SubmitResult>
  resetProgress:  () => void
  toggleSaved:    (questionId: number) => void
  syncFromServer: (userId: string) => Promise<void>
  /**
   * Serverdan kelgan TO'LIQ profilni (init / /auth/me / login / link javobi)
   * store'ga bir setState'da qo'llaydi — TG init va auth yo'llari BIR XIL
   * mapping'ni ishlatadi (desync xavfi yo'q).
   */
  hydrateFromProfile: (data: FullProfile) => void
  resetAccount:   () => void
}

/**
 * Persist (localStorage) uchun user obyektidan PII'ni ajratadi.
 * Telefon raqam faqat xotirada/about:init server javobida yashiradi —
 * localStorage'da uzoq muddat yotgan PII shared qurilmada xavf.
 * Warm-start UI uchun firstName/username/photoUrl yetarli.
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
  offlineMode:       true,   // eski default (false) noto'g'ri edi — SW avval hamma uchun ishlardi
  dailyReminder:     true,
  dailyReminderTime: '20:00',
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Server tasdiqlagan javobni lokal counterlarga qo'llash
       *  (submitAnswer muvaffaqiyati VA outbox replay'da — bir xil yo'l). */
      const applyAnswer = (input: { questionId: number; correct: boolean; subjectId: string; date: string; dailyStreak: number | null; coinSaved?: boolean }) => {
        const { questionId, correct, subjectId, date, dailyStreak, coinSaved } = input
        // Multi-fan identity: xato qaydlari fan bo'yicha composite kalitda
        const wKey = questionKey(subjectId, questionId)
        // Xato savol to'g'rilandimi? (Intizom sahifasidagi "TUZATILDI" hisoblagichi)
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
                  // Xato tuzatildi — ro'yxatdan o'chir ("Xatolarni tuzatish"dan yo'qoladi)
                  const next = { ...s.wrongByTicket }
                  delete next[wKey]
                  return next
                })()
              : { ...s.wrongByTicket, [wKey]: (s.wrongByTicket[wKey] ?? 0) + 1 },
          }
        })
        if (dailyStreak !== null) useDailyStore.getState().applyServerResult(date, subjectId, dailyStreak, coinSaved)
        const userId = get().user?.id
        if (wasWrong && userId && userId !== '0') {
          api.addDailyFix(userId, { subjectId }).catch(() => {
            enqueueOutbox(userId, 'daily-fix', { subjectId })
          })
        }
      }

      // Outbox'dan replay bo'lgan javob lokal counterlarni ham yangilasin
      // (offline javob qayta yuborilganda UI server bilan tekislansin).
      setResultSyncHandler((info) => {
        if (info.duplicate) return   // server allaqachon hisoblagan
        applyAnswer({
          questionId: info.questionId, correct: info.correct,
          subjectId: info.subjectId, date: info.date, dailyStreak: info.dailyStreak,
          coinSaved: info.coinSaved,
        })
      })

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
          if (next.dailyReminder !== false) {
            void scheduleDailyStreakReminder(next.dailyReminderTime || '20:00', next.language)
          } else {
            void cancelDailyStreakReminder()
          }
        }

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

      submitAnswer: async (questionId, selectedAnswer, elapsedMs) => {
        // Read userId BEFORE set() — never call side-effects inside set()
        const userId = get().user?.id
        const subjectId = useSubjectStore.getState().subjectId
        if (!userId || userId === '0') return null   // anonim — tekshirish imkonsiz

        // Idempotency kaliti JAVOBGA bog'lanadi — outbox replay shu bilan.
        const clientToken = newId()
        try {
          const res = await api.postResult(userId, { questionId, selectedAnswer, subjectId, clientToken, ...(elapsedMs != null ? { elapsedMs } : {}) })
          // duplicate'da correct null bo'ladi — applyAnswer counter'larni qayta yozmasligi shart
          if (!res.duplicate && res.correct !== null) applyAnswer({ questionId, correct: res.correct, subjectId, date: todayStr(), dailyStreak: res.dailyStreak, coinSaved: res.coinSaved })
          // #40: mint bo'lgan tanga — server balansi bilan sinxron (client o'zi mint qilmaydi)
          if (!res.duplicate && (res.coinsEarned ?? 0) > 0 && typeof res.coinBalance === 'number') {
            set({ coins: res.coinBalance })
          }
          // XP ham SERVER hisobidan (kunlik shift tufayli 0 bo'lishi mumkin)
          if (!res.duplicate && typeof res.xp === 'number') set({ xp: res.xp })
          return { correct: res.correct, correctAnswer: res.correctAnswer, duplicate: !!res.duplicate, coinsEarned: res.duplicate ? 0 : (res.coinsEarned ?? 0) }
        } catch (err) {
          // FATAL 4xx — server qat'iy rad etdi (validatsiya/auth/noto'g'ri so'rov):
          // outbox'ga yozish BEFOYDA (flush ilk urunishda tashlab yuborardi) va
          // "offline"ga yutish javobni jimgina YO'QOTARDI. Caller xato ko'rsatadi.
          if (err instanceof ApiError && !err.retryable) {
            console.warn('postResult rad etildi (fatal, outbox\'siz):', err.message)
            return { fatal: true, code: err.code }
          }
          // OFFLINE SYNC CENTER: javob outbox'ga yoziladi — internet
          // qaytganda flushOutbox serverga yetkazadi (progress yo'qolmaydi,
          // clientToken tufayli ikki marta ham yozilmaydi).
          console.warn('postResult muvaffaqiyatsiz — outbox\'ga yozildi:', (err as Error)?.message ?? err)
          enqueueOutbox(userId, 'result', { questionId, selectedAnswer, subjectId, date: todayStr(), clientToken, ...(elapsedMs != null ? { elapsedMs } : {}) })
          return null
        }
      },

      resetProgress: () => {
        const userId = get().user?.id
        set({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, xp: 0, wrongByTicket: {}, solvedQuestions: [] })
        if (userId && userId !== '0') api.resetProgress(userId).catch(console.error)
      },

      toggleSaved: (questionId) => {
        // Read BEFORE set() — side-effect'lar set() ichida bo'lmasligi kerak
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
            // Bookmark offline — outbox'ga; qaytganda serverga yetkaziladi
            enqueueOutbox(userId, wasSaved ? 'saved-remove' : 'saved-add', { questionId, subjectId })
          })
        }
      },

      hydrateFromProfile: (data) => {
        if (data.settings.dailyReminder !== false) {
          void scheduleDailyStreakReminder(data.settings.dailyReminderTime || '20:00', data.settings.language)
        }
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
      // v0 → v1: settings'ni DEFAULT bilan birlashtirish
      // (yangi kalitlar qo'shilganda undefined bo'lib qolmasligi uchun)
      // v1 → v2: multi-fan identity — wrongByTicket/savedQuestions kalitlari
      // composite formatga ('<subjectId>:<qid>') o'tadi; eski tekis kalitlar
      // ('123') default fanga (yhq) tegishli deb qabul qilinadi.
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
        // v0: offlineMode eski toggle HECH NIMA QILMASDI — foydalanuvchi aslida
        // uni o'chirmagan (SW baribir ishlardi), shuning uchun true'ga ko'taramiz.
        return {
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}), offlineMode: true },
          wrongByTicket: wrong,
          savedQuestions: saved,
          solvedQuestions: solved,
        } as never
      },
      // user endi PERSIST QILINADI — ilova 2+ marta ochilganda splash'SIZ
      // issiq start bo'ladi (cache bilan darhol UI, init fonda yangilanadi).
      // Akkaunt almashsa: init yangi user keltiradi, state almashadi
      // (qisqa flash yechimi — tezlik uchun qabul qilinadigan trade-off).
      partialize: (s) => ({
        // PII (telefon) disk'ga yozilmaydi — faqat xotirada yashiradi
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
        solvedQuestions: s.solvedQuestions ?? [],
        displayName:    s.displayName,
        customAvatar:   s.customAvatar,
        tariff:         s.tariff,
        accent:         s.accent,
        coins:          s.coins,
        ownedItems:     s.ownedItems,
        avatarFrame:    s.avatarFrame,
      }),
    }
  )
)
