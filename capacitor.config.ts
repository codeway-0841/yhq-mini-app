import type { CapacitorConfig } from '@capacitor/cli'

/**
 * APK har doim LOKAL dist bundle'dan yuklanadi — `server.url` ISHLATILMAYDI.
 * Production API/WS manzillari build vaqtida bundle'ga yoziladi:
 *   VITE_API_BASE_URL=https://<api-host>/api
 *   VITE_WS_URL=wss://<ws-host>/ws/octagon
 * (qiymatlar src/shared/config/index.ts orqali runtime'da o'qiladi).
 */

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try { return new URL(url).host } catch { return undefined }
}

// WebView to'liq sahifa navigatsiyasini FAQAT API/WS host'lariga cheklaymiz
// (XHR/fetch navigatsiya emas — bu faqat window.location o'zgarishlariga tegishli).
// DIQQAT: massiv yopuvchi `]'ni yangi qatorga TASHIMANG — esbuild 0.28 parser
// bug'i `new Set([...\n].filter(...))` ni parse qila olmaydi (vitest import
// sindi; cap CLI jiti ishlatgani uchun sezilmaydi, 2026-08-31).
const hostCandidates = [
  hostOf(process.env['VITE_API_BASE_URL']),
  hostOf(process.env['VITE_WS_URL']),
  'yhq-mini-app.vercel.app', // prod deploy domeni (server/config deploy.appUrl default'i bilan bir xil)
]
const navigableHosts = Array.from(new Set(hostCandidates.filter((h): h is string => Boolean(h))))

const config: CapacitorConfig = {
  appId: 'uz.kiwi.yhq',   // Play Store identity — O'ZGARMAYDI (yangi app bo'lib qolardi)
  appName: 'KIVVI',
  webDir: 'dist',
  server: {
    // https scheme → WebView origin'i "https://localhost" (server CORS'da ruxsat etilgan)
    androidScheme: 'https',
    // dist/index.html endi LANDING (web split, 2026-08-30) — default directory
    // index'ni yuklasa APK landing'ni ochardi. Ilova entry'si app.html.
    // MUHIM: Leading slash SHART — Capacitor 8 Bridge.java https scheme'da
    // localUrl ("https://localhost") ga startPath'ni slash'SIZ yopishtiradi
    // (faqat custom scheme'da "/" qo'shadi) — 'app.html' bo'lsa WebView
    // "https://localhostapp.html" ni ochib ERR_NAME_NOT_RESOLVED beradi
    // (2026-08-31 APK incident). Regression: tests/unit/config/capacitor-config.test.ts
    appStartPath: '/app.html',
    allowNavigation: navigableHosts,
  },
}

export default config
