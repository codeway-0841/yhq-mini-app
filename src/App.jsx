import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'

import Dashboard  from './pages/Dashboard'
import TestPage   from './pages/TestPage'
import Darslik    from './pages/Darslik'
import Biletlar   from './pages/Biletlar'
import Belgilar   from './pages/Belgilar'
import Profil     from './pages/Profil'
import BottomNav  from './components/BottomNav'

// Hide BottomNav on test page so it doesn't clash with TestPage's own nav
function Layout() {
  const location = useLocation()
  const isTest   = location.pathname.startsWith('/test')

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <div className={`flex-1 overflow-y-auto ${isTest ? '' : 'pb-20'}`}>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/test/:id"    element={<TestPage />} />
          <Route path="/darslik"     element={<Darslik />} />
          <Route path="/biletlar"    element={<Biletlar />} />
          <Route path="/belgilar"    element={<Belgilar />} />
          <Route path="/profil"      element={<Profil />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isTest && <BottomNav />}
    </div>
  )
}

export default function App() {
  const setUser = useAppStore((s) => s.setUser)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
    }
    const user = tg?.initDataUnsafe?.user
    setUser(user ?? { first_name: 'Foydalanuvchi', last_name: '', id: 0 })
  }, [setUser])

  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}
