import { useEffect, lazy, Suspense, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useQuestionsStore } from './store/useQuestionsStore'
import { useSubjectStore } from './store/useSubjectStore'
import { useDailyStore } from './store/useDailyStore'
import { useAdaptiveStore } from './store/useAdaptiveStore'
import { api } from './lib/api'
import { track } from './lib/analytics'
import PageLoader from './components/PageLoader'
import { resolveAccent } from './config/themes'
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
const NotFound        = lazy(() => import('./components/NotFound'))

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      ready(): void
      expand(): void
      BackButton?: {
        show(): void
        hide(): void
        onClick(cb: () => void): void
        offClick(cb: () => void): void
      }
      initDataUnsafe?: {
        start_param?: string
        user?: {
          id: number
          first_name: string
          last_name?: string
          username?: string
          photo_url?: string
        }
      }
    }
  }
}

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
    const sp = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.start_param
    const fromTg = sp?.startsWith('duel-') ? sp : undefined
    const fromQuery = new URLSearchParams(window.location.search).get('duel') ?? undefined
    const code = fromTg ?? (fromQuery?.startsWith('duel-') ? fromQuery : undefined)
    if (code) navigate(`/octagon/${code}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Telegram BackButton — ilova ICHIDAGI orqaga navigatsiya.
  // U boshqarilmasa, "Back" bosilganda Mini App yopilib ketadi.
  // Bosh sahifada tugma yashirinadi (ilova tasodifan yopilmaydi).
  useEffect(() => {
    const bb = (window as TelegramWindow).Telegram?.WebApp?.BackButton
    if (!bb) return
    if (atHome) { bb.hide(); return } // Eslatma: `return bb.hide()` YOZILMAYDI — hide() object qaytaradi, React crash bo'ladi
    const handler = () => window.history.back()
    bb.show()
    bb.onClick(handler)
    return () => { bb.offClick(handler) }
  }, [atHome])

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
    const tg     = (window as TelegramWindow).Telegram?.WebApp
    if (tg) { tg.ready(); tg.expand() }

    track('app_open')

    // Fan almashuvi — multi-fan platformaning asosiy KPI signali
    let prevSubj = useSubjectStore.getState().subjectId
    const unsubSubject = useSubjectStore.subscribe((s) => {
      if (s.subjectId !== prevSubj) {
        prevSubj = s.subjectId
        track('subject_switch', { id: s.subjectId })
      }
    })

    const tgUser = tg?.initDataUnsafe?.user

    const loadQuestions = (lang: 'uz' | 'ru') =>
      useQuestionsStore.getState().load(lang)

    if (tgUser?.id) {
      const verifiedId = String(tgUser.id)
      const cachedId = useAppStore.getState().user?.id

      // Warm start faqat ayni Telegram akkauntining cache'i bo'lsa xavfsiz.
      // Account almashganda PII, progress va adaptive state atomik tozalanadi.
      if (cachedId && cachedId !== verifiedId) {
        useAppStore.getState().resetAccount()
        useDailyStore.getState().resetAccount()
        useAdaptiveStore.getState().resetAll()
      } else if (cachedId === verifiedId) {
        useAppStore.setState({ initialized: true })
      }

      // Referal: ?ref=<id> query (bot tugmasidan) YOKI start_param (startapp link)
      const refQ = new URLSearchParams(window.location.search).get('ref')
      const startParam =
        tg?.initDataUnsafe?.start_param ??
        (refQ && /^\d{1,19}$/.test(refQ) ? `ref_${refQ}` : undefined)
      // TEZKOR OCHILISH: savollar serverini init bilan PARALLEL yuklaymiz.
      // Cache'dagi (persist) til — odatda serverdagi bilan bir xil (load ichida dedupe bor).
      const qPromise = loadQuestions(useAppStore.getState().settings?.language ?? 'uz').catch(() => {})
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
            useAppStore.setState({
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
            // Parallel yuklash tugagach — til serverdagi sozlamalar bilan farq
            // qilsa, XOTIRADAN remap qilamiz (qayta tarmoq so'rovisiz).
            await qPromise
            useQuestionsStore.getState().setLang(data.settings.language)
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
      // GHOST USER HIMOYASI: brauzer preview haqiqiy akkaunt cache'ini ko'rmaydi.
      useAppStore.getState().resetAccount()
      useDailyStore.getState().resetAccount()
      useAdaptiveStore.getState().resetAll()
      useAppStore.setState({
        user:           { id: '0', firstName: 'Foydalanuvchi', lastName: '', username: '', photoUrl: '', phone: undefined, tariff: 'free' },
        tariff:         'free',
        displayName:    null,
        streak:         0,
        totalCorrect:   0,
        totalWrong:     0,
        totalAnswered:  0,
        wrongByTicket:  {},
        savedQuestions: [],
        initialized:    true,
      })
      loadQuestions('uz').catch(() => {})
    }
    return () => unsubSubject()
  }, [syncFromServer])

  const finishOnboarding = () => {
    try { localStorage.setItem('yhq-onboarded', '1') } catch { /* ignore */ }
    setOnboarded(true)
  }

  if (!initialized) {
    return (
      <>
        <ThemeEffect />
        <SplashScreen />
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
