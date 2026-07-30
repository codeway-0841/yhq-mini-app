import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useQuestionsStore } from './store/useQuestionsStore'
import { api } from './lib/api'
import Dashboard       from './features/dashboard/Dashboard'
import TestPage        from './features/test/TestPage'
import Darslik         from './features/lessons/Darslik'
import Biletlar        from './features/tickets/Biletlar'
import Belgilar        from './features/signs/Belgilar'
import Profil          from './features/profile/Profil'
import TopicsPage      from './features/topics/TopicsPage'
import AdaptivePage    from './features/adaptive/AdaptivePage'
import OctagonPage     from './features/octagon/OctagonPage'
import LeaderboardPage from './features/leaderboard/LeaderboardPage'
import BottomNav       from './components/BottomNav'

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
  const isTest   = location.pathname.startsWith('/test')

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <div className={`flex-1 overflow-y-auto ${isTest ? '' : 'pb-20'}`}>
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
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isTest && <BottomNav />}
    </div>
  )
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
      <Layout />
    </HashRouter>
  )
}
