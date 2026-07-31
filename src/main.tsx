/// <reference types="vite/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
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
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

// Offline support — cache app shell, images and questions for reuse without network
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW unsupported (some Telegram WebViews) — the app still works online */
    })
  })
}
