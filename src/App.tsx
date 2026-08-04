import { useEffect, lazy, Suspense, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useQuestionsStore } from './store/useQuestionsStore'
import { api } from './lib/api'
import PageLoader from './components/PageLoader'
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
const OctagonPage     = lazy(() => import('./features/octagon/OctagonPage'))
const LeaderboardPage = lazy(() => import('./features/leaderboard/LeaderboardPage'))
const NotFound        = lazy(() => import('./components/NotFound'))

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      ready(): void
      expand(): void
      initDataUnsafe?: {
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
            <Route path="/octagon"    element={<OctagonPage />} />
            <Route path="/reyting"    element={<LeaderboardPage />} />
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

    const tgUser = tg?.initDataUnsafe?.user

    const loadQuestions = (lang: 'uz' | 'ru') =>
      useQuestionsStore.getState().load(lang)

    if (tgUser?.id) {
      api.init({
        id:         String(tgUser.id),
        first_name: tgUser.first_name,
        last_name:  tgUser.last_name  ?? '',
        username:   tgUser.username   ?? '',
        photo_url:  tgUser.photo_url  ?? '',
      })
        .then(async (data) => {
          try {
            // Akkaunt almashganda lokal no-server ma'lumotlarni tozalash
            const prevId = useAppStore.getState().user?.id
            if (prevId && prevId !== data.user.id) {
              useAppStore.getState().setDisplayName(null)
            }
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
            await loadQuestions(data.settings.language).catch(() => {})
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
      // GHOST USER HIMOYASI: Telegram WEBAPP'siz ochilganda (brauzer) oldingi
      // haqiqiy foydalanuvchining statistikasi/saqlanganlari ko'rinmasligi kerak.
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
