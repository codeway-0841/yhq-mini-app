import { useEffect, lazy, Suspense, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PageLoader from './shared/components/PageLoader'
import SplashScreen from './features/onboarding/SplashScreen'
import { t } from './shared/i18n'
import { getStartParam, closeMiniApp } from './platform/telegram'
import { useAppBootstrap } from './features/app/hooks/useAppBootstrap'
import { usePlatformNavigation } from './features/app/hooks/usePlatformNavigation'
import ThemeEffect from './features/app/components/ThemeEffect'
import StreakSaveToast from './features/app/components/StreakSaveToast'

// Lazy-loaded pages — each becomes its own chunk (code splitting)
// Dashboard — 100% userlar ko'radigan yagona sahifa. Uning chunk'i splash
// KO'RINIB TURGANDA (init so'rovlariga parallel) yuklanadi, aks holda splash
// tugagach yana bitta round-trip + PageLoader miltillashi bo'lardi.
const dashboardChunk = () => import('./features/dashboard/Dashboard')
void dashboardChunk()
const Dashboard       = lazy(dashboardChunk)

// Har sahifa chunk'i NOMLANGAN loader orqali — boot'dan keyin idle prefetch
// (pastda) shu loader'larni qayta ishlatadi (import() modul keshi tufayli
// ikki marta yuklanmaydi — lazy bilan bir xil modul).
const testPageChunk        = () => import('./features/test/TestPage')
const testlarChunk         = () => import('./features/testlar/TestlarPage')
const darslikChunk         = () => import('./features/lessons/Darslik')
const biletlarChunk        = () => import('./features/tickets/Biletlar')
const belgilarChunk        = () => import('./features/signs/Belgilar')
const signsGameChunk       = () => import('./features/signs-game/SignsGamePage')
const profilChunk          = () => import('./features/profile/Profil')
const topicsChunk          = () => import('./features/topics/TopicsPage')
const adaptiveChunk        = () => import('./features/adaptive/AdaptivePage')
const octagonChunk         = () => import('./features/octagon/OctagonPage')
const adminChunk           = () => import('./features/admin/AdminPage')
const leaderboardChunk     = () => import('./features/leaderboard/LeaderboardPage')
const xatolarChunk         = () => import('./features/mistakes/XatolarPage')
const streakChunk          = () => import('./features/streak/StreakPage')
const premiumChunk         = () => import('./features/premium/PremiumPage')
const shopChunk            = () => import('./features/shop/ShopPage')
const statistikaChunk      = () => import('./features/stats/StatistikaPage')
const speedChunk           = () => import('./features/speed/SpeedPage')
const flashcardsChunk      = () => import('./features/flashcards/FlashcardsPage')
const formulasChunk        = () => import('./features/formulas/FormulasPage')
const searchChunk           = () => import('./features/search/SearchPage')
const aiTestHubChunk        = () => import('./features/ai-test/AiTestHub')
const aiTestSessionChunk    = () => import('./features/ai-test/AiTestSession')
const notFoundChunk        = () => import('./shared/components/NotFound')
// Onboarding — FAQAT birinchi kirishda ko'rinadi, lekin statik import bo'lgani
// uchun har bir userning entry bundle'ida yotardi.
const onboardingChunk      = () => import('./features/onboarding/Onboarding')
// Auth (telefon+parol / TG Login Widget) — faqat initData'siz muhitda ko'rinadi
const loginChunk           = () => import('./features/auth/LoginPage')
const verifyEmailChunk     = () => import('./features/auth/pages/VerifyEmailPage')
const resetPasswordChunk   = () => import('./features/auth/pages/ResetPasswordPage')
const modesChunk           = () => import('./features/dashboard/ModesPage')

const TestPage        = lazy(testPageChunk)
const TestlarPage     = lazy(testlarChunk)
const Darslik         = lazy(darslikChunk)
const Biletlar        = lazy(biletlarChunk)
const Belgilar        = lazy(belgilarChunk)
const SignsGamePage   = lazy(signsGameChunk)
const Profil          = lazy(profilChunk)
const TopicsPage      = lazy(topicsChunk)
const AdaptivePage    = lazy(adaptiveChunk)
const OctagonPage    = lazy(octagonChunk)
const AdminPage      = lazy(adminChunk)
const LeaderboardPage = lazy(leaderboardChunk)
const XatolarPage     = lazy(xatolarChunk)
const StreakPage      = lazy(streakChunk)
const PremiumPage     = lazy(premiumChunk)
const ShopPage        = lazy(shopChunk)
const StatistikaPage  = lazy(statistikaChunk)
const SpeedPage       = lazy(speedChunk)
const FlashcardsPage  = lazy(flashcardsChunk)
const FormulasPage    = lazy(formulasChunk)
const SearchPage      = lazy(searchChunk)
const AiTestHub       = lazy(aiTestHubChunk)
const AiTestSession   = lazy(aiTestSessionChunk)
const NotFound        = lazy(notFoundChunk)
const Onboarding      = lazy(onboardingChunk)
const LoginPage       = lazy(loginChunk)
const VerifyEmailPage = lazy(verifyEmailChunk)
const ResetPasswordPage = lazy(resetPasswordChunk)
const ModesPage        = lazy(modesChunk)

// NAVIGATSIYA "FLASH" FIX (2026-09-01): react-router v7 joylashuv
// yangilanishini React.startTransition ichida bajaradi — lazy chunk hali
// yuklanmagan bo'lsa Suspense fallback (PageLoader) EMAS, ESKI sahifa
// (Dashboard) chunk kelguncha ekranda qolib ketardi. Boot tugagach
// IDLE vaqtda barcha sahifa chunk'larini oldindan yuklab qo'yamiz.
const routeChunkPrefetchers = [
  testlarChunk, darslikChunk, biletlarChunk, topicsChunk, testPageChunk,
  belgilarChunk, xatolarChunk, adaptiveChunk, profilChunk, leaderboardChunk,
  octagonChunk, signsGameChunk, streakChunk, shopChunk, premiumChunk,
  statistikaChunk, speedChunk, flashcardsChunk, formulasChunk, searchChunk,
  aiTestHubChunk, aiTestSessionChunk, modesChunk,
  notFoundChunk, adminChunk, onboardingChunk, loginChunk,
  verifyEmailChunk, resetPasswordChunk,
]
function prefetchRouteChunks() {
  for (const load of routeChunkPrefetchers) void load()
}

function Layout({ children }: { children: ReactNode }) {
  const { pageRef, navigate } = usePlatformNavigation()

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
  }, [navigate])

  return (
    // MUHIM (2026-09-01 sticky incident): bu konteynerlarda overflow-y:auto/hidden
    // TAQIQLANADI — haqiqiy scroll'ni DOCUMENT bajaradi (html/body height:100% +
    // kontent o'sadi), lekin overflow'li har qanday ajdod STICKY elementlar uchun
    // scrollport bo'lib qoladi. overflow-x:clip — yagona ruxsat.
    <div className="relative flex flex-col min-h-screen bg-canvas text-fg overflow-x-clip">
      <div
        ref={pageRef}
        // pb: 1rem bazaviy + --safe-bottom (TG fullscreen/APK gesture bar himoyasi)
        className="route-page relative z-10 flex-1 w-full mx-auto max-w-2xl pb-[calc(1rem+var(--safe-bottom,0px))] px-0"
      >
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </div>
    </div>
  )
}

export default function App() {
  const {
    initialized,
    initDataDead,
    isAuthed,
    lang,
  } = useAppBootstrap()

  // Onboarding faqat birinchi kirishda ko'rsatiladi
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem('yhq-onboarded') === '1' } catch { return true }
  })

  // Splash yopilgach — sahifa chunk'larini IDLE vaqtda prefetch.
  // Boot kritik yo'lidan tashqarida: faqat idle callback yoki kichik timeout.
  useEffect(() => {
    if (!initialized) return
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetchRouteChunks, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(prefetchRouteChunks, 1000)
    return () => clearTimeout(t)
  }, [initialized])

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

  // initData DEAD — reload Telegram'ni yangilamadi, yagona yechim: yopib-qayta ochish.
  // Bu ekran splash'dan ham OLDIN turadi (dead holatda boot'un davomi ma'nosiz).
  if (initDataDead) {
    return (
      <>
        <ThemeEffect />
        <div className="first-launch-screen bg-canvas text-fg flex items-center justify-center overflow-y-auto overscroll-contain px-6 py-6">
          <div className="card-premium max-w-sm w-full text-center flex flex-col items-center gap-3">
            <div className="text-lg font-bold">{t(lang, 'sessionStaleTitle')}</div>
            <p className="text-sm text-pmuted leading-relaxed">{t(lang, 'sessionStaleBody')}</p>
            <button type="button" className="btn-premium w-full mt-1" onClick={() => closeMiniApp()}>
              {t(lang, 'sessionStaleClose')}
            </button>
          </div>
        </div>
      </>
    )
  }

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
  if (!isAuthed) {
    return (
      <>
        <ThemeEffect />
        <Suspense fallback={<SplashScreen />}>
          <LoginPage />
        </Suspense>
      </>
    )
  }

  if (!onboarded) {
    return (
      <>
        <ThemeEffect />
        <Suspense fallback={<SplashScreen />}>
          <Onboarding onDone={finishOnboarding} />
        </Suspense>
      </>
    )
  }

  return (
    <HashRouter>
      <ThemeEffect />
      <StreakSaveToast />
      <Layout>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/testlar"    element={<TestlarPage />} />
          <Route path="/test/yim"   element={<Navigate to="/testlar" replace />} />
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
          <Route path="/rejimlar"   element={<ModesPage />} />
          <Route path="/premium"    element={<PremiumPage />} />
          <Route path="/shop"       element={<ShopPage />} />
          <Route path="/statistika" element={<StatistikaPage />} />
          <Route path="/speed"      element={<SpeedPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/shpargalkalar" element={<FormulasPage />} />
          <Route path="/qidiruv"    element={<SearchPage />} />
          <Route path="/ai-test"    element={<AiTestHub />} />
          <Route path="/ai-test/:id" element={<AiTestSession />} />
          <Route path="/admin"      element={<AdminPage />} />
          <Route path="*"           element={<NotFound />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
