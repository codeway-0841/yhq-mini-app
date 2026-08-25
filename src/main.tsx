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

// Offline support — cache app shell, images and questions for reuse.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* some WebViews */ })
  })
}
