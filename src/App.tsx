import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useQuestionsStore } from './store/useQuestionsStore'
import { api } from './lib/api'
import PageLoader from './components/PageLoader'

// Lazy-loaded pages — each becomes its own chunk (code splitting)
const Dashboard       = lazy(() => import('./features/dashboard/Dashboard'))
const TestPage        = lazy(() => import('./features/test/TestPage'))
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
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <div className="flex-1 overflow-y-auto pb-4">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
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

/** Light/Dark tema — settings.theme o'zgarishi bilan body ga qo'llanadi */
function ThemeEffect() {
  const theme = useAppStore((s) => s.settings.theme)
  useEffect(() => {
    document.body.dataset.theme = theme
  }, [theme])
  return null
}

export default function App() {
  const syncFromServer = useAppStore((s) => s.syncFromServer)

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
          await loadQuestions(data.settings.language)
          useAppStore.setState({ initialized: true })
        })
        .catch(async () => {
          await syncFromServer(String(tgUser.id))
          const lang = useAppStore.getState().settings?.language ?? 'uz'
          await loadQuestions(lang)
          useAppStore.setState({ initialized: true })
        })
    } else {
      useAppStore.setState({
        user:        { id: '0', firstName: 'Foydalanuvchi', lastName: '', username: '', photoUrl: '', phone: undefined, tariff: 'free' },
        initialized: true,
      })
      loadQuestions('uz')
    }
  }, [syncFromServer])

  return (
    <HashRouter>
      <ThemeEffect />
      <Layout />
    </HashRouter>
  )
}
