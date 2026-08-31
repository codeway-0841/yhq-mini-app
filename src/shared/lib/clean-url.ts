/**
 * Toza URL — `app.kivvi.uz/app.html` → `app.kivvi.uz/`.
 *
 * app.html — server-side entry (Vercel: app host `/` 307 redirect + deep-link
 * rewrite). Address bar'da ko'rinishi shart emas: ilova HashRouter'da (route
 * state # ichida yashaydi), shuning uchun pathname xavfsiz almashtiriladi —
 * reload'da brauzer `/` so'raydi, server 307 → /app.html qaytaradi va hash'ni
 * redirect orqali SAQLAYDI; SW esa `/` keshiga app-shell'ni yozadi
 * (public/sw.js handleNavigate).
 *
 * Nega FAQAT app.kivvi.uz (APP_HOST)? Faqat shu hostda `/` app'ga redirect
 * qiladi. Boshqa hostlarda (localhost dev, yhq-mini-app.vercel.app) `/`
 * LANDING'ni serve qiladi — strip reload'da userni ilova o'rniga landing'ga
 * tashlab yuborardi. Shuning uchun host gate MAJBURIY.
 *
 * app.html'dagi inline skript ham SHU MANTIQNI takrorlaydi (bundle
 * yuklanishidan oldin, parse paytida) — o'zgarish ikkalasiga kiritiladi.
 */

/** Strip faqat shu hostda xavfsiz (vercel.json: `/` 307 → /app.html). */
export const APP_HOST = 'app.kivvi.uz'

const APP_HTML_SUFFIX = '/app.html'

/**
 * `/app.html` bilan tugovchi pathname'ni toza yo'lga o'giradi
 * (`/app.html` → `/`, query va hash SAQLANADI). Strip shart emas bo'lsa null.
 */
export function strippedAppUrl(pathname: string, search = '', hash = ''): string | null {
  if (!pathname.endsWith(APP_HTML_SUFFIX)) return null
  const base = pathname.slice(0, -APP_HTML_SUFFIX.length) || '/'
  return base + search + hash
}

/**
 * Address bar'dan /app.html'ni olib tashlaydi (replaceState — history'ga
 * yangi yozuv QO'SHILMAYDI, BackButton xatti-harakati o'zgarmaydi).
 * No-op holatlar: boshqa host (yuqoridagi landing xavfi), strip shart emas,
 * yoki replaceState rad etilgan WebView (xato yutiladi — URL shunchaki
 * app.html ko'rinishda qoladi, funksionallik buzilmaydi).
 */
export function stripAppHtmlFromAddressBar(): void {
  try {
    if (window.location.hostname !== APP_HOST) return
    const clean = strippedAppUrl(window.location.pathname, window.location.search, window.location.hash)
    if (clean) window.history.replaceState(null, '', clean)
  } catch {
    /* WebView cheklovlari — xavfsiz no-op */
  }
}
