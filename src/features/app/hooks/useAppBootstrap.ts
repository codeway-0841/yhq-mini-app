import { useEffect, useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { ensureAccountOwner, resetAccountToLoggedOut } from '../../../shared/store/account'
import { api } from '../../../shared/api'
import { flushOutbox } from '../../../shared/lib/outbox'
import { prefetchLeaderboardPreview } from '../../../shared/lib/leaderboard-cache'
import { prefetchDashboardCards } from '../../../shared/lib/dashboard-cache'
import { track } from '../../../shared/lib/analytics'
import {
  getSessionToken,
  SESSION_EXPIRED_EVENT,
  SESSION_CHANGED_EVENT,
} from '../../../shared/lib/session'
import {
  getStartParam,
  getTelegramUser,
  getTelegramWebApp,
  readyAndExpand,
  requestFreshInitData,
  INITDATA_DEAD_EVENT,
} from '../../../platform/telegram'
import { hideSplashScreen } from '../../../platform/native'
import type { Lang } from '../../../shared/i18n'
import { answerService } from '../../../shared/services/answer-service'

export interface AppBootstrapState {
  initialized:  boolean
  initDataDead: boolean
  isTelegram:   boolean
  hasSession:   boolean
  isAuthed:     boolean
  lang:         Lang
}

/**
 * Ilova startup, auth restore, session events va public data prefetch lifecycle boshqaruvi.
 */
export function useAppBootstrap(): AppBootstrapState {
  const syncFromServer = useAppStore((s) => s.syncFromServer)
  const initialized    = useAppStore((s) => s.initialized)
  const user           = useAppStore((s) => s.user)
  const lang           = useAppStore((s) => s.settings.language)

  // Telegram Mini App muhiti butun sessiya davomida o'zgarmaydi — bir marta tekshiramiz
  const [isTelegram]   = useState(() => Boolean(getTelegramUser()?.id))
  // Bearer sessiya holati — set/clear event'lari orqali kuzatiladi (LoginPage render qarori)
  const [hasSession, setHasSession] = useState(() => Boolean(getSessionToken()))
  // initData eskirgan va Telegram reload'da yangilamadi — faqat "yopib-qayta ochish"
  // yechim (2026-08-27 incident: cheksiz reload sikli). Blokirovka ekrani.
  const [initDataDead, setInitDataDead] = useState(false)

  // Session expire (401) → akkaunt reset + LoginPage; token set/clear → isAuthed yangilanadi
  useEffect(() => {
    const onExpired = () => { setHasSession(false); resetAccountToLoggedOut() }
    const onChanged = () => setHasSession(Boolean(getSessionToken()))
    const onInitDataDead = () => setInitDataDead(true)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.addEventListener(SESSION_CHANGED_EVENT, onChanged)
    window.addEventListener(INITDATA_DEAD_EVENT, onInitDataDead)
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
      window.removeEventListener(SESSION_CHANGED_EVENT, onChanged)
      window.removeEventListener(INITDATA_DEAD_EVENT, onInitDataDead)
    }
  }, [])

  // APK native splash — ilova o'z initini (initialized=true) bitkazgach yashiriladi.
  // Web/Telegram'da no-op. Ilgarigi JSX splash'dan native splash'ga uzluksiz o'tish.
  useEffect(() => {
    if (initialized) hideSplashScreen()
  }, [initialized])

  // Splash'dan chiqish GARANTIYASI — init 8s dan oshsa majburiy o'tish
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useAppStore.getState().initialized) {
        useAppStore.setState({ initialized: true })
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    readyAndExpand()

    track('app_open')

    // Fan almashuvi — multi-fan platformaning asosiy KPI signali
    let prevSubj = useSubjectStore.getState().subjectId
    const unsubSubject = useSubjectStore.subscribe((s) => {
      if (s.subjectId !== prevSubj) {
        prevSubj = s.subjectId
        track('subject_switch', { id: s.subjectId })
        const l = useAppStore.getState().settings?.language ?? 'uz'
        void useQuestionsStore.getState().load(l, s.subjectId)
      }
    })

    const tgUser = getTelegramUser()

    const loadQuestions = (l: 'uz' | 'ru') =>
      useQuestionsStore.getState().load(l, useSubjectStore.getState().subjectId)

    // /questions va /topics — PUBLIC endpoint'lar (questions.router.ts: auth
    // middleware yo'q, CDN kesh bor). Ya'ni ular auth javobini kutishi SHART
    // EMAS. Keshdagi til bilan DARHOL boshlaymiz — api.init()/getAuthMe() bilan
    // parallel ketadi va bitta to'liq round-trip yo'qoladi.
    void loadQuestions(useAppStore.getState().settings?.language ?? 'uz').catch(() => {})

    if (tgUser?.id) {
      // initData FRESHNESS GATE (regressiya fix): ilova Telegram fonda 1+ soat
      // turganida auth_date eskirgan bo'ladi — server'ning qat'iy replay oynasi
      // (INITDATA_MAX_AGE_SECONDS=3600) auth-only '/questions' uchun 401 qaytarib,
      // sahifa "yuklanmoqda"da qolib ketardi (2026-08-26 content-protection yoqilgach).
      // So'rov AVTASHISHdan OLDIN: initData 55+ daqiqalik bo'lsa ilovani BIR MARTA
      // qayta yuklaymiz — Telegram yangi initData (fresh auth_date) beradi.
      // Loop himoyasi requestFreshInitData'dagi 60s guard'da.
      const authDate = getTelegramWebApp()?.initDataUnsafe?.auth_date
      if (typeof authDate === 'number' && Date.now() - authDate * 1000 > 55 * 60_000) {
        requestFreshInitData()
        return
      }

      const verifiedId = String(tgUser.id)

      // Warm start FAQAT ayni Telegram akkauntining cache'i bo'lsa xavfsiz.
      // Account mismatch'da PII, progress va adaptive state atomik tozalanadi.
      const isOwner = ensureAccountOwner(verifiedId)
      if (isOwner && useAppStore.getState().user?.id) {
        useAppStore.setState({ initialized: true })
      }

      // Referal: ?ref=<id> query (bot tugmasidan) YOKI start_param (startapp link).
      const refQ = new URLSearchParams(window.location.search).get('ref')
      const startParam =
        getStartParam() ??
        (refQ && /^[A-Za-z0-9_]{2,40}$/.test(refQ) ? `ref_${refQ}` : undefined)
      api.init({
        id:         String(tgUser.id),
        first_name: tgUser.first_name,
        last_name:  tgUser.last_name  ?? '',
        username:   tgUser.username   ?? '',
        photo_url:  tgUser.photo_url  ?? '',
        ...(startParam ? { start_param: startParam } : {}),
      })
        .then(async (data) => {
          try {
            useAppStore.getState().hydrateFromProfile(data)
            void loadQuestions(data.settings.language).catch(() => {})
            void flushOutbox(verifiedId)
            prefetchLeaderboardPreview(data.user.id)
            prefetchDashboardCards()
          } finally {
            useAppStore.setState({ initialized: true })
          }
        })
        .catch(async () => {
          try {
            await syncFromServer(String(tgUser.id)).catch(() => {})
            const l = useAppStore.getState().settings?.language ?? 'uz'
            void loadQuestions(l).catch(() => {})
          } finally {
            useAppStore.setState({ initialized: true })
          }
        })
    } else {
      // MEHMON REJIM YO'Q: initData'siz muhitda (APK/brauzer) Bearer sessiya tekshiriladi.
      const sessionToken = getSessionToken()
      if (!sessionToken) {
        // Sessiya yo'q — toza login holati (oldingi akkaunt cache'i ko'rinmaydi)
        resetAccountToLoggedOut()
        loadQuestions('uz').catch(() => {})
        useAppStore.setState({ initialized: true })
      } else {
        // Optimistik warm start: token + cache birga yoziladi (localStorage)
        if (useAppStore.getState().user?.id) {
          useAppStore.setState({ initialized: true })
        }
        api.getAuthMe()
          .then(async (data) => {
            try {
              ensureAccountOwner(data.user.id)
              useAppStore.getState().hydrateFromProfile(data)
              void loadQuestions(data.settings.language).catch(() => {})
              void flushOutbox(data.user.id)
              prefetchLeaderboardPreview(data.user.id)
              prefetchDashboardCards()
            } finally {
              useAppStore.setState({ initialized: true })
            }
          })
          .catch(() => {})
          .finally(() => {
            useAppStore.setState({ initialized: true })
          })
      }
    }

    // Internet qaytganda yoki ilovaga qaytilganda outbox navbatini yuborish va store'ni yangilash
    const triggerSync = () => {
      const id = useAppStore.getState().user?.id
      if (id && id !== '0' && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        void flushOutbox(id).then(() => {
          void syncFromServer(id)
        })
      }
    }
    const onOnline = () => triggerSync()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerSync()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Outbox'dan replay bo'lgan javoblar sinxronizatsiyasi (explicit lifecycle)
    const unsubResultSync = answerService.subscribeResultSync((info) => {
      if (info.duplicate) return
      useAppStore.getState().applyAnswerMutation({
        questionId:   info.questionId,
        correct:      info.correct,
        subjectId:    info.subjectId,
        date:         info.date,
        dailyStreak:  info.dailyStreak,
        coinSaved:    info.coinSaved,
        coinBalance:  info.coinBalance,
        xp:           info.xp,
      })
    })

    return () => {
      unsubResultSync()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsubSubject()
    }
  }, [syncFromServer])

  const isAuthed = isTelegram || hasSession || Boolean(user?.id)

  return {
    initialized,
    initDataDead,
    isTelegram,
    hasSession,
    isAuthed,
    lang,
  }
}
