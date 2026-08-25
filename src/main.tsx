/// <reference types="vite/client" />
import './shared/lib/sentry'   // birinchi bo'lib — barcha xatolarni yig'ishi uchun
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './shared/components/ErrorBoundary'
import { ToastProvider } from './shared/components/ToastContainer'
import './index.css'

// Telegram WebView dastlabki yuklanishda #tgWebAppData=... hashini qo'shishi mumkin —
// HashRouter uni noto'g'ri sahifa deb o'qiydi (404 flash). Routerdan oldin tozalaymiz.
if (window.location.hash.includes('tgWebAppData')) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        {/* ToastProvider ILGARI hech qayerda mount qilinmagan edi — `useToast()`
            chaqirilsa xato tashlardi, shuning uchun sahifalar o'z lokal toast
            state'ini yuritardi. Endi yagona manba mavjud (Phase 6'da sahifalar
            lokal implementatsiyalardan shu API'ga ko'chadi). */}
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
}

// Offline support — cache app shell, images and questions for reuse without network.
// Faqat "Oflayn rejim" yoqilgan bo'lsa ro'yxatga olinadi (Settings toggle endi haqiqiy ishlaydi).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    import('./shared/store/useAppStore').then(({ useAppStore }) => {
      const applySw = (enabled: boolean) => {
        if (enabled) {
          navigator.serviceWorker.register('/sw.js').catch(() => { /* some WebViews */ })
        } else {
          navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
          // Foydalanuvchi ATAYLAB yuklab olgan fan paketlari ('yhq-offline-*')
          // bu tozalashdan CHETDA qoladi — ular "Oflayn rejim" ekranidagi
          // O'chirish tugmasiga tegishli, bu SW toggle'iga emas. Aks holda
          // qishloqda yuklab olingan kontent ilova keyingi ochilishida jimgina
          // yo'q bo'lardi (public/sw.js activate cleanup'i ham xuddi shu
          // prefiksni saqlab qoladi — ikkalasi bir xil shartga tayanadi).
          caches?.keys?.().then((ks) =>
            ks.filter((k) => !k.startsWith('yhq-offline-')).forEach((k) => caches.delete(k))
          )
        }
      }
      applySw(useAppStore.getState().settings.offlineMode)
      let prev = useAppStore.getState().settings.offlineMode
      useAppStore.subscribe((s) => {
        const cur = s.settings.offlineMode
        if (cur !== prev) { prev = cur; applySw(cur) }
      })
    })
  })
}
