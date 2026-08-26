import { useEffect, lazy, Suspense, useRef, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from './shared/store/useAppStore'
import { useQuestionsStore } from './shared/store/useQuestionsStore'
import { useSubjectStore } from './shared/store/useSubjectStore'
import { ensureAccountOwner, resetAccountToLoggedOut } from './shared/store/account'
import { api } from './shared/api'
import { flushOutbox } from './shared/lib/outbox'
import { prefetchLeaderboardPreview } from './shared/lib/leaderboard-cache'
import { prefetchDashboardCards } from './shared/lib/dashboard-cache'
import { track } from './shared/lib/analytics'
import {
  getSessionToken, SESSION_EXPIRED_EVENT, SESSION_CHANGED_EVENT,
} from './shared/lib/session'
import PageLoader from './shared/components/PageLoader'
import { resolveAccent } from './shared/config/themes'
import { ensureFontLoaded } from './shared/lib/fonts'
import SplashScreen from './features/onboarding/SplashScreen'
import { useDailyStore } from './shared/store/useDailyStore'
import { useToast } from './shared/components/ToastContainer'
import { useT } from './shared/i18n'

// Lazy-loaded pages — each becomes its own chunk (code splitting)
// Dashboard — 100% userlar ko'radigan yagona sahifa. Uning chunk'i splash
// KO'RINIB TURGANDA (init so'rovlariga parallel) yuklanadi, aks holda splash
// tugagach yana bitta round-trip + PageLoader miltillashi bo'lardi.
const dashboardChunk = () => import('./features/dashboard/Dashboard')
void dashboardChunk()
const Dashboard       = lazy(dashboardChunk)
const TestPage        = lazy(() => import('./features/test/TestPage'))
const TestlarPage     = lazy(() => import('./features/testlar/TestlarPage'))
const Darslik         = lazy(() => import('./features/lessons/Darslik'))
const Biletlar        = lazy(() => import('./features/tickets/Biletlar'))
const Belgilar        = lazy(() => import('./features/signs/Belgilar'))
const SignsGamePage   = lazy(() => import('./features/signs-game/SignsGamePage'))
const Profil          = lazy(() => import('./features/profile/Profil'))
const TopicsPage      = lazy(() => import('./features/topics/TopicsPage'))
const AdaptivePage    = lazy(() => import('./features/adaptive/AdaptivePage'))
const OctagonPage    = lazy(() => import('./features/octagon/OctagonPage'))
const AdminPage      = lazy(() => import('./features/admin/AdminPage'))
const LeaderboardPage = lazy(() => import('./features/leaderboard/LeaderboardPage'))
const XatolarPage     = lazy(() => import('./features/mistakes/XatolarPage'))
const StreakPage      = lazy(() => import('./features/streak/StreakPage'))
const PremiumPage     = lazy(() => import('./features/premium/PremiumPage'))
const ShopPage        = lazy(() => import('./features/shop/ShopPage'))
const StatistikaPage  = lazy(() => import('./features/stats/StatistikaPage'))
const SpeedPage       = lazy(() => import('./features/speed/SpeedPage'))
const FlashcardsPage  = lazy(() => import('./features/flashcards/FlashcardsPage'))
const FormulasPage    = lazy(() => import('./features/formulas/FormulasPage'))
const SearchPage      = lazy(() => import('./features/search/SearchPage'))
const NotFound        = lazy(() => import('./shared/components/NotFound'))
// Onboarding — FAQAT birinchi kirishda ko'rinadi, lekin statik import bo'lgani
// uchun har bir userning entry bundle'ida yotardi.
const Onboarding      = lazy(() => import('./features/onboarding/Onboarding'))
// Auth (telefon+parol / TG Login Widget) — faqat initData'siz muhitda ko'rinadi
const LoginPage       = lazy(() => import('./features/auth/LoginPage'))
const VerifyEmailPage = lazy(() => import('./features/auth/pages/VerifyEmailPage'))
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage'))

import { getStartParam, getTelegramUser, getTelegramWebApp, readyAndExpand, requestFreshInitData } from './platform/telegram'
import { bindAppBackButton, hideSplashScreen } from './platform/native'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const atHome = location.pathname === '/'

  // Sahifa almashganda tepadan boshlash — body scroll (min-h-screen) saqlanmasin
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Duel invite-link (ikki manba):
  //  1) startapp deep-link: ?startapp=duel-xxxx yoki 6-digit PIN → start_param
  //  2) bot tugmasidan: URL'dagi ?duel=xxxx query param
  useEffect(() => {
    const sp = getStartParam()
    const fromTg = sp && (sp.startsWith('duel-') || /^\d{4,8}$/.test(sp)) ? sp : undefined
    const fromQuery = new URLSearchParams(window.location.search).get('duel') ?? undefined
    const rawCode = fromTg ?? fromQuery
    if (rawCode) {
      const cleanCode = rawCode.trim().toLowerCase().replace(/^(?:duel|room)-/, '')
      navigate(`/octagon/${cleanCode}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Platforma "orqaga" tugmasi — Telegram'da TG BackButton, APK'da hardware back.
  // Bosh sahifada tugma yashirinadi (ilova tasodifan yopilmaydi).
  useEffect(() => bindAppBackButton(!atHome, () => window.history.back()), [atHome])

  // Sahifa o'tishida scroll reset + transition — key={pathname} EMAS (audit L11b):
  // key har navigatsiyada BUTUN sahifani REMOUNT qilardi (komponent state'lari
  // yo'qolardi); animation endi class restart bilan (remount'siz, perf saqlanadi).
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    el.scrollTop = 0
    el.classList.remove('route-page')
    void el.offsetWidth            // reflow — CSS animatsiyani qayta boshlaydi
    el.classList.add('route-page')
  }, [location.pathname])

  return (
    <div className="relative flex flex-col min-h-screen bg-canvas text-fg overflow-hidden">
      {/* Har bir temaga moslashuvchi Dynamic Ambient Hero Glow */}
      <div className="ambient-mesh-glow" aria-hidden="true" />
      <div ref={pageRef} className="route-page relative z-10 flex-1 overflow-y-auto pb-4 max-w-3xl mx-auto w-full">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/testlar"    element={<TestlarPage />} />
            <Route path="/test/:id"   element={<TestPage />} />
            <Route path="/darslik"    element={<Darslik />} />
            <Route path="/biletlar"   element={<Biletlar />} />
            <Route path="/belgilar"   element={<Belgilar />} />
            <Route path="/belgilar-oyini" element={<SignsGamePage />} />
            <Route path="/profil"     element={<Profil />} />
            <Route path="/mavzular"   element={<TopicsPage />} />
            <Route path="/adaptive"   element={<AdaptivePage />} />
            <Route path="/octagon/:duelCode?" element={<OctagonPage />} />
            <Route path="/reyting"    element={<LeaderboardPage />} />
            <Route path="/xatolar"    element={<XatolarPage />} />
            <Route path="/streak"     element={<StreakPage />} />
            <Route path="/premium"    element={<PremiumPage />} />
            <Route path="/shop"       element={<ShopPage />} />
            <Route path="/statistika" element={<StatistikaPage />} />
            <Route path="/speed"      element={<SpeedPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/shpargalkalar" element={<FormulasPage />} />
            <Route path="/qidiruv"    element={<SearchPage />} />
            <Route path="/admin"      element={<AdminPage />} />
            <Route path="*"           element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}

/** Light/Dark tema — settings.theme o'zgarishi bilan body ga qo'llanadi.
 * 'system' tanlansa, qurilma sozlamasiga ergashiladi (matchMedia). */
function ThemeEffect() {
  const theme       = useAppStore((s) => s.settings.theme)
  const noAnimation = useAppStore((s) => s.settings.noAnimation)
  const language    = useAppStore((s) => s.settings.language)
  const accent      = useAppStore((s) => s.accent)
  const tariff      = useAppStore((s) => s.tariff)
  const ownedItems  = useAppStore((s) => s.ownedItems)
  const fontStyle   = useAppStore((s) => s.settings.fontStyle)
  useEffect(() => {
    // <html lang> — screen reader talaffuzi uchun; qattiq "uz" bilan boshlanadi (index.html),
    // foydalanuvchi tilni almashtirsa sinxronlanadi.
    document.documentElement.lang = language ?? 'uz'
  }, [language])
  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const apply = () => { document.body.dataset.theme = mq.matches ? 'light' : 'dark' }
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    document.body.dataset.theme = theme
  }, [theme])
  // Aksent temasi — yopiq temalar (premium/coin) egasiz foydalanuvchida default'ga tushadi
  useEffect(() => {
    document.body.dataset.accent = resolveAccent(accent, tariff === 'premium', new Set(ownedItems))
  }, [accent, tariff, ownedItems])
  useEffect(() => {
    // noAnimation setting — route transitionlar ham o'chadi (index.css)
    document.body.dataset.noAnimation = String(noAnimation)
  }, [noAnimation])
  useEffect(() => {
    // Ixtiyoriy oilalar boot'da emas, TANLANGANDA yuklanadi (shared/lib/fonts.ts)
    ensureFontLoaded(fontStyle)
    document.body.dataset.font = fontStyle || 'default'
  }, [fontStyle])
  return null
}

/** Streak coin-save bildirishnomasi — server uzilgan seriyani coin evaziga
 *  saqlaganda (`useDailyStore.coinSaved`) bir martalik toast ko'rsatadi. */
function StreakSaveToast() {
  const coinSaved      = useDailyStore((s) => s.coinSaved)
  const clearCoinSaved = useDailyStore((s) => s.clearCoinSaved)
  const language       = useAppStore((s) => s.settings.language)
  const { info } = useToast()
  const tt = useT(language)
  useEffect(() => {
    if (!coinSaved) return
    info(tt('streakSavedToast'))
    clearCoinSaved()
  }, [coinSaved, clearCoinSaved, info, tt])
  return null
}

export default function App() {
  const syncFromServer = useAppStore((s) => s.syncFromServer)
  const initialized    = useAppStore((s) => s.initialized)
  const user           = useAppStore((s) => s.user)
  // Telegram Mini App muhiti butun sessiya davomida o'zgarmaydi — bir marta tekshiramiz
  const [isTelegram]   = useState(() => Boolean(getTelegramUser()?.id))
  // Bearer sessiya holati — set/clear event'lari orqali kuzatiladi (LoginPage render qarori)
  const [hasSession, setHasSession] = useState(() => Boolean(getSessionToken()))

  // Session expire (401) → akkaunt reset + LoginPage; token set/clear → isAuthed yangilanadi
  useEffect(() => {
    const onExpired = () => { setHasSession(false); resetAccountToLoggedOut() }
    const onChanged = () => setHasSession(Boolean(getSessionToken()))
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.addEventListener(SESSION_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
      window.removeEventListener(SESSION_CHANGED_EVENT, onChanged)
    }
  }, [])

  // APK native splash — ilova o'z initini (initialized=true) bitkazgach yashiriladi.
  // Web/Telegram'da no-op. Ilgarigi JSX splash'dan native splash'ga uzluksiz o'tish.
  useEffect(() => {
    if (initialized) hideSplashScreen()
  }, [initialized])
  // Onboarding faqat birinchi kirishda ko'rsatiladi
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem('yhq-onboarded') === '1' } catch { return true }
  })

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
        const lang = useAppStore.getState().settings?.language ?? 'uz'
        void useQuestionsStore.getState().load(lang, s.subjectId)
      }
    })

    const tgUser = getTelegramUser()

    const loadQuestions = (lang: 'uz' | 'ru') =>
      useQuestionsStore.getState().load(lang, useSubjectStore.getState().subjectId)

    // /questions va /topics — PUBLIC endpoint'lar (questions.router.ts: auth
    // middleware yo'q, CDN kesh bor). Ya'ni ular auth javobini kutishi SHART
    // EMAS. Keshdagi til bilan DARHOL boshlaymiz — api.init()/getAuthMe() bilan
    // parallel ketadi va bitta to'liq round-trip yo'qoladi.
    // Profil kelgach loadQuestions(server tili) yana chaqiriladi: til bir xil
    // bo'lsa store guard'i no-op qiladi (uchib ketayotgan so'rov ham hisobga
    // olinadi — useQuestionsStore `inFlight`), boshqacha bo'lsa qayta yuklanadi.
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
      // Account mismatch'da PII, progress va adaptive state atomik tozalanadi
      // (ro'yxat — src/store/account.ts; yangi account-scoped store shu yerga
      // qo'shilishi shart, bu yerda takrorlanmaydi).
      const isOwner = ensureAccountOwner(verifiedId)
      if (isOwner && useAppStore.getState().user?.id) {
        useAppStore.setState({ initialized: true })
      }

      // Referal: ?ref=<id> query (bot tugmasidan) YOKI start_param (startapp link).
      // Canonical id HAR QANDAY shaklda (TG raqam, p_<digits>, e_<hex>) — telefon
      // akkauntli userlarning havolasi ham sanaladi.
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
            // Mapping auth (Bearer) yo'li bilan BIR XIL — hydrateFromProfile
            useAppStore.getState().hydrateFromProfile(data)
            // SAVOLLAR SPLASH'NI KUTIB TURMAYDI (boot perf): /questions + /topics
            // eng og'ir payload, lekin Dashboard'ga faqat SON uchun kerak.
            // `await` bo'lgani uchun splash shu ikki so'rov tugaguncha turardi.
            void loadQuestions(data.settings.language).catch(() => {})
            void flushOutbox(verifiedId)
            // Dashboard kartalari skeletsiz ochilishi uchun keshlar oldindan
            // isitiladi (fire-and-forget — boot'ni sekinlashtirmaydi). Aks holda
            // bu so'rovlar Dashboard MOUNT bo'lgandan keyin, ya'ni splash
            // tugagach boshlanardi — o'sha payt skeletlar ko'rinardi.
            prefetchLeaderboardPreview(data.user.id)
            prefetchDashboardCards()
          } finally {
            // Xato bo'lsa ham splash'dan chiqishi shart
            useAppStore.setState({ initialized: true })
          }
        })
        .catch(async () => {
          try {
            await syncFromServer(String(tgUser.id)).catch(() => {})
            const lang = useAppStore.getState().settings?.language ?? 'uz'
            void loadQuestions(lang).catch(() => {})
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
        // Savollar public endpoint — LoginPage bilan parallel yuklanadi
        loadQuestions('uz').catch(() => {})
      } else {
        // Optimistik warm start: token + cache birga yoziladi (localStorage),
        // shuning uchun cache'dagi user shu sessiyaga tegishli deb ishonamiz.
        if (useAppStore.getState().user?.id) {
          useAppStore.setState({ initialized: true })
        }
        api.getAuthMe()
          .then(async (data) => {
            try {
              // Adopt-merge (p_ → telegram raqam id) almashinuvini ushlaymiz
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
          .catch(() => {
            // 401: request() qatlami allaqachon session-expired event'ini tarqatdi
            // (akkaunt reset + LoginPage). Network xato: offline fallback —
            // cache'dagi profil bilan davom (outbox pattern bilan uyg'un).
          })
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

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsubSubject()
    }
  }, [syncFromServer])

  const finishOnboarding = () => {
    try { localStorage.setItem('yhq-onboarded', '1') } catch { /* ignore */ }
    setOnboarded(true)
  }

  // Email verification/reset URLs normalization (hash routing redirection in useEffect)
  useEffect(() => {
    const p = window.location.pathname
    const h = window.location.hash
    const s = window.location.search
    if (p.startsWith('/verify-email') && !h.startsWith('#/verify-email')) {
      const token = new URLSearchParams(s).get('token')
      if (token && !h.includes('token=')) {
        window.location.hash = `#/verify-email?token=${encodeURIComponent(token)}`
      }
    } else if (p.startsWith('/reset-password') && !h.startsWith('#/reset-password')) {
      const token = new URLSearchParams(s).get('token')
      if (token && !h.includes('token=')) {
        window.location.hash = `#/reset-password?token=${encodeURIComponent(token)}`
      }
    }
  }, [])

  if (!initialized) {
    return (
      <>
        <ThemeEffect />
        <SplashScreen />
      </>
    )
  }

  // Email verification/reset pages — accessible without auth (user clicks link from email).
  // Links arrive as /#/verify-email?token=xxx or /verify-email?token=xxx
  const hash = window.location.hash
  const pathname = window.location.pathname

  if (pathname.startsWith('/verify-email') || hash.startsWith('#/verify-email')) {
    return (
      <>
        <ThemeEffect />
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="*" element={<VerifyEmailPage />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </>
    )
  }
  if (pathname.startsWith('/reset-password') || hash.startsWith('#/reset-password')) {
    return (
      <>
        <ThemeEffect />
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<ResetPasswordPage />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </>
    )
  }

  // Auth gate: Mini App (initData) YOKI Bearer sessiya YOKI hydrate bo'lgan cache user.
  // Uchtalasi ham yo'q bo'lsa — LoginPage (mehmon rejim yo'q).
  const isAuthed = isTelegram || hasSession || Boolean(user?.id)
  if (!isAuthed) {
    return (
      <>
        <ThemeEffect />
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </>
    )
  }

  if (!onboarded) {
    return (
      <>
        <ThemeEffect />
        <Suspense fallback={<PageLoader />}>
          <Onboarding onDone={finishOnboarding} />
        </Suspense>
      </>
    )
  }

  return (
    <HashRouter>
      <ThemeEffect />
      <StreakSaveToast />
      <Layout />
    </HashRouter>
  )
}
