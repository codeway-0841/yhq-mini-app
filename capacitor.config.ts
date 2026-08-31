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
const navigableHosts = Array.from(new Set([
  hostOf(process.env['VITE_API_BASE_URL']),
  hostOf(process.env['VITE_WS_URL']),
  'yhq-mini-app.vercel.app', // prod deploy domeni (server/config deploy.appUrl default'i bilan bir xil)
].filter((h): h is string => Boolean(h)))

const config: CapacitorConfig = {
  appId: 'uz.kiwi.yhq',
  appName: 'KIWI',
  webDir: 'dist',
  server: {
    // https scheme → WebView origin'i "https://localhost" (server CORS'da ruxsat etilgan)
    androidScheme: 'https',
    // dist/index.html endi LANDING (web split, 2026-08-30) — default directory
    // index'ni yuklasa APK landing'ni ochardi. Ilova entry'si app.html.
    appStartPath: 'app.html',
    allowNavigation: navigableHosts,
  },
}

export default config
