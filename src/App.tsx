import { useEffect, lazy, Suspense, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from './shared/store/useAppStore'
import { useQuestionsStore } from './shared/store/useQuestionsStore'
import { useSubjectStore } from './shared/store/useSubjectStore'
import { ensureAccountOwner, resetAccountToLoggedOut } from './shared/store/account'
import { api } from './shared/api'
import { flushOutbox } from './shared/lib/outbox'
import { track } from './shared/lib/analytics'
import {
  getSessionToken, SESSION_EXPIRED_EVENT, SESSION_CHANGED_EVENT,
} from './shared/lib/session'
import PageLoader from './shared/components/PageLoader'
import { resolveAccent } from './shared/config/themes'
import SplashScreen from './features/onboarding/SplashScreen'
import Onboarding from './features/onboarding/Onboarding'

// Lazy-loaded pages — each becomes its own chunk (code splitting)
const Dashboard       = lazy(() => import('./features/dashboard/Dashboard'))
const TestPage        = lazy(() => import('./features/test/TestPage'))
const TestlarPage     = lazy(() => import('./features/testlar/TestlarPage'))
const Darslik         = lazy(() => import('./features/lessons/Darslik'))
const Biletlar        = lazy(() => import('./features/tickets/Biletlar'))
const Belgilar        = lazy(() => import('./features/signs/Belgilar'))
const Profil          = lazy(() => import('./features/profile/Profil'))
const TopicsPage      = lazy(() => import('./features/topics/TopicsPage'))
const AdaptivePage    = lazy(() => import('./features/adaptive/AdaptivePage'))
const OctagonPage    = lazy(() => import('./features/octagon/OctagonPage'))
const AdminPage      = lazy(() => import('./features/admin/AdminPage'))
const LeaderboardPage = lazy(() => import('./features/leaderboard/LeaderboardPage'))
const XatolarPage     = lazy(() => import('./features/mistakes/XatolarPage'))
const StreakPage      = lazy(() => import('./features/streak/StreakPage'))
const PremiumPage     = lazy(() => import('./features/premium/PremiumPage'))
const StatistikaPage  = lazy(() => import('./features/stats/StatistikaPage'))
const SpeedPage       = lazy(() => import('./features/speed/SpeedPage'))
const FlashcardsPage  = lazy(() => import('./features/flashcards/FlashcardsPage'))
const FormulasPage    = lazy(() => import('./features/formulas/FormulasPage'))
const NotFound        = lazy(() => import('./shared/components/NotFound'))
// Auth (telefon+parol / TG Login Widget) — faqat initData'siz muhitda ko'rinadi
const LoginPage       = lazy(() => import('./features/auth/LoginPage'))
const VerifyEmailPage = lazy(() => import('./features/auth/pages/VerifyEmailPage'))
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage'))

import { getStartParam, getTelegramUser, readyAndExpand } from './platform/telegram'
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
  //  1) startapp deep-link: ?startapp=duel-xxxx → start_param
  //  2) bot tugmasidan: URL'dagi ?duel=duel-xxxx query param
  useEffect(() => {
    const sp = getStartParam()
    const fromTg = sp?.startsWith('duel-') ? sp : undefined
    const fromQuery = new URLSearchParams(window.location.search).get('duel') ?? undefined
    const code = fromTg ?? (fromQuery?.startsWith('duel-') ? fromQuery : undefined)
    if (code) navigate(`/octagon/${code}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Platforma "orqaga" tugmasi — Telegram'da TG BackButton, APK'da hardware back.
  // Bosh sahifada tugma yashirinadi (ilova tasodifan yopilmaydi).
  useEffect(() => bindAppBackButton(!atHome, () => window.history.back()), [atHome])

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-fg">
      {/* key=pathname → sahifa almashganda yo'mshoq transition + scroll reset */}
      <div key={location.pathname} className="route-page flex-1 overflow-y-auto pb-4">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/testlar"    element={<TestlarPage />} />
            <Route path="/test/:id"   element={<TestPage />} />
            <Route path="/darslik"    element={<Darslik />} />
            <Route path="/biletlar"   element={<Biletlar />} />
            <Route path="/belgilar"   element={<Belgilar />} />
            <Route path="/profil"     element={<Profil />} />
            <Route path="/mavzular"   element={<TopicsPage />} />
            <Route path="/adaptive"   element={<AdaptivePage />} />
            <Route path="/octagon/:duelCode?" element={<OctagonPage />} />
            <Route path="/reyting"    element={<LeaderboardPage />} />
            <Route path="/xatolar"    element={<XatolarPage />} />
            <Route path="/streak"     element={<StreakPage />} />
            <Route path="/premium"    element={<PremiumPage />} />
            <Route path="/statistika" element={<StatistikaPage />} />
            <Route path="/speed"      element={<SpeedPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/shpargalkalar" element={<FormulasPage />} />
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
  const accent      = useAppStore((s) => s.accent)
  const tariff      = useAppStore((s) => s.tariff)
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
  // Aksent temasi — Premium-only temalar free foydalanuvchida default'ga tushadi
  useEffect(() => {
    document.body.dataset.accent = resolveAccent(accent, tariff === 'premium')
  }, [accent, tariff])
  useEffect(() => {
    // noAnimation setting — route transitionlar ham o'chadi (index.css)
    document.body.dataset.noAnimation = String(noAnimation)
  }, [noAnimation])
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

    if (tgUser?.id) {
      const verifiedId = String(tgUser.id)

      // Warm start FAQAT ayni Telegram akkauntining cache'i bo'lsa xavfsiz.
      // Account mismatch'da PII, progress va adaptive state atomik tozalanadi
      // (ro'yxat — src/store/account.ts; yangi account-scoped store shu yerga
      // qo'shilishi shart, bu yerda takrorlanmaydi).
      const isOwner = ensureAccountOwner(verifiedId)
      if (isOwner && useAppStore.getState().user?.id) {
        useAppStore.setState({ initialized: true })
      }

      // Referal: ?ref=<id> query (bot tugmasidan) YOKI start_param (startapp link)
      const refQ = new URLSearchParams(window.location.search).get('ref')
      const startParam =
        getStartParam() ??
        (refQ && /^\d{1,19}$/.test(refQ) ? `ref_${refQ}` : undefined)
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
            await loadQuestions(data.settings.language).catch(() => {})
            void flushOutbox(verifiedId)
          } finally {
            // Xato bo'lsa ham splash'dan chiqishi shart
            useAppStore.setState({ initialized: true })
          }
        })
        .catch(async () => {
          try {
            await syncFromServer(String(tgUser.id)).catch(() => {})
            const lang = useAppStore.getState().settings?.language ?? 'uz'
            await loadQuestions(lang).catch(() => {})
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
              await loadQuestions(data.settings.language).catch(() => {})
              void flushOutbox(data.user.id)
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
    // Internet qaytganda outbox navbatini darhol yuborish
    const onOnline = () => {
      const id = useAppStore.getState().user?.id
      if (id && id !== '0') void flushOutbox(id)
    }
    window.addEventListener('online', onOnline)

    return () => {
      window.removeEventListener('online', onOnline)
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
        <Onboarding onDone={finishOnboarding} />
      </>
    )
  }

  return (
    <HashRouter>
      <ThemeEffect />
      <Layout />
    </HashRouter>
  )
}
