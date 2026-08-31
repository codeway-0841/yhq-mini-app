/**
 * Platform adapter — Telegram WebApp API'sining YAGONA kirish nuqtasi.
 * Barcha `window.Telegram` murojaatlari FAQAT shu faylda yashiladi:
 * kelajakdagi Capacitor/Android port shu interfeysni almashtirish bilan chegaralanadi.
 * Telegram tashqarisida (oddiy brauzer) hammasi xavfsiz no-op/fallback.
 */

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface BackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

interface SafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

interface TelegramWebApp {
  ready?(): void
  expand?(): void
  /** Mini App'ni yopadi (user bot'dan qayta ochganda FRESH initData beriladi). */
  close?(): void
  openTelegramLink?(url: string): void
  shareURL?(url: string, text?: string): void
  initData?: string
  initDataUnsafe?: {
    start_param?: string
    user?: TelegramUser
    /** Unix seconds — initData chiqarilgan vaqt (freshness gate uchun) */
    auth_date?: number
  }
  BackButton?: BackButton
  requestContact?(callback: (ok: boolean, data?: { contact?: { phone_number: string } }) => void): void
  addToHomeScreen?(): void
  isFullscreen?: boolean
  safeAreaInset?: SafeAreaInset
  contentSafeAreaInset?: SafeAreaInset
  onEvent?(eventType: string, eventHandler: () => void): void
  offEvent?(eventType: string, eventHandler: () => void): void
  requestFullscreen?(): void
  exitFullscreen?(): void
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
}

/**
 * Telegram Bot API 8.0 safe-area sinxronizatsiyasi:
 * - Standart rejimda (isFullscreen=false) webview Telegram header'i ostida boshlanadi,
 *   shuning uchun tepa safe-area 0px bo'lishi SHART (aks holda header ostida ulkan bo'shliq hosil bo'ladi).
 * - Fullscreen rejimda (isFullscreen=true) webview to'liq ekranni qoplaydi va floating
 *   tugmalar ostida qolmaslik uchun contentSafeAreaInset.top ishlatiladi.
 */
export function syncTelegramSafeArea(): void {
  const tg = getTelegramWebApp()
  if (!tg || typeof document === 'undefined') return

  const apply = () => {
    const isIos = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent) || tg.platform === 'ios')
    const isAndroid = typeof navigator !== 'undefined' && (/Android/i.test(navigator.userAgent) || tg.platform === 'android')

    const contentTop = tg.contentSafeAreaInset?.top ?? 0
    const safeTop = tg.safeAreaInset?.top ?? 0

    // Telegram fullscreen rejimida floating buttons / status bar ostida qolmasligi uchun:
    // iOS (Dynamic Island / notch + floating buttons) = ~88px; Android = ~72px.
    const fallbackTop = isIos ? 88 : isAndroid ? 72 : 0
    const top = Math.max(contentTop, safeTop, fallbackTop)

    const contentBottom = tg.contentSafeAreaInset?.bottom ?? 0
    const safeBottom = tg.safeAreaInset?.bottom ?? 0
    const fallbackBottom = isIos ? 34 : 0
    const bottom = Math.max(contentBottom, safeBottom, fallbackBottom)

    document.documentElement.style.setProperty('--safe-top', `${top}px`)
    document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`)
  }

  apply()

  setTimeout(apply, 50)
  setTimeout(apply, 150)
  setTimeout(apply, 300)
  setTimeout(apply, 600)

  tg.onEvent?.('fullscreen_changed', apply)
  tg.onEvent?.('fullscreenChanged', apply)
  tg.onEvent?.('safe_area_changed', apply)
  tg.onEvent?.('safeAreaChanged', apply)
  tg.onEvent?.('content_safe_area_changed', apply)
  tg.onEvent?.('contentSafeAreaChanged', apply)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', apply)
  }
}

/** Telegram initData — har bir API so'rovi bilan server-side verification uchun yuboriladi. */
export function getInitData(): string | undefined {
  return getTelegramWebApp()?.initData || undefined
}

export function getTelegramUser(): TelegramUser | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.user
}

export function getStartParam(): string | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.start_param
}

/** App bootstrap: Telegram'ga "tayyor" signalini berish + to'liq ekranga yoyish (fullscreen) + safe-area. */
export function readyAndExpand(): void {
  const tg = getTelegramWebApp()
  if (tg) {
    tg.ready?.()
    tg.expand?.()
    try {
      tg.requestFullscreen?.()
    } catch (_) {}
    syncTelegramSafeArea()
  }
}

/**
 * Telegram BackButton — ilova ICHIDAGI orqaga navigatsiya.
 * visible=false → yashiradi (bosh sahifa). visible=true → ko'rsatib, onBack'ga bog'laydi.
 * Qaytarilgan cleanup useEffect'dan chiqarilishi shart.
 * Eslatma: `return bb.hide()` kabi pattern TAQIQLANGAN — hide() object qaytaradi, React crash bo'ladi.
 */
export function bindBackButton(visible: boolean, onBack: () => void): (() => void) | undefined {
  const bb = getTelegramWebApp()?.BackButton
  if (!bb) return undefined
  if (!visible) { bb.hide(); return undefined }
  bb.show()
  bb.onClick(onBack)
  return () => bb.offClick(onBack)
}

/**
 * Kontakt (telefon) so'rash — true: dialog ochildi, false: qo'llab-quvvatlanmaydi
 * (Telegram tashqarisi yoki eski versiya — UI xato xabarini o'zi ko'rsatadi).
 */
export function requestContact(
  callback: (ok: boolean, data?: { contact?: { phone_number: string } }) => void,
): boolean {
  const fn = getTelegramWebApp()?.requestContact
  if (!fn) return false
  fn(callback)
  return true
}

/** "Ilovani o'rnatish" — true: dialog ochildi, false: bu Telegram versiyasida yo'q. */
export function promptAddToHomeScreen(): boolean {
  const fn = getTelegramWebApp()?.addToHomeScreen
  if (!fn) return false
  fn()
  return true
}

/** Open a t.me link inside Telegram (or a new browser tab as fallback). */
export function openTelegramLink(url: string): void {
  const tg = getTelegramWebApp()
  if (tg?.openTelegramLink) tg.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

/** Share a URL via Telegram (or navigator.share / clipboard as fallback). */
export function shareUrl(url: string, text?: string): void {
  const tg = getTelegramWebApp()
  if (tg?.openTelegramLink) {
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`
    tg.openTelegramLink(share)
    return
  }
  if (navigator.share) {
    navigator.share({ url, text }).catch(() => {})
    return
  }
  navigator.clipboard?.writeText(url).catch(() => {})
}

/**
 * initData 401 (auth_date eskirgan — server replay oynasi INITDATA_MAX_AGE_SECONDS,
 * default 1 soat) — Mini App'ni QAYTA YUKLAYDI.
 *
 * MUHIM (2026-08-27 incident): Telegram ko'p platformalarda reload'da O'SHA
 * sessiya initData'sini qaytaradi — auth_date O'ZGARMAYDI. Eski 60s-guard
 * yetarli emas edi: sessiyani 1+ soat ochiq qoldirgan user cheksiz
 * reload→401→reload sikliga tushib qolardi (test javobi yuborilganda sahifa
 * qayta yuklanardi, yangi akkaunt profili umuman yuklanmasdi; 72 daqiqada 218
 * ta full-bank fetch kuzatilgan).
 *
 * Yangi qoida: HAR BIR noyob auth_date uchun FAQAT 1 reload. Reload'dan keyin
 * Telegram xuddi shu auth_date'ni qaytarsa — demak bu sessiyada initData
 * YANGILANMAYDI — keyingi 401'larda reload YO'Q, `INITDATA_DEAD_EVENT`
 * tarqaladi (App.tsx blokirovka ekranini ko'rsatadi: "ilovani yopib qayta
 * oching" — yagona HAQIQIY yechim, chunki fresh initData faqat yangi Mini App
 * launch'da tug'iladi).
 */
const INITDATA_RELOAD_GUARD = 'yhq:initdata-reload-at'
export const INITDATA_DEAD_EVENT = 'yhq:initdata-dead'

interface ReloadAttempt { at: number; authDate: number | null }

/** Sof qaror funksiyasi (test uchun eksport): reload yoki dead? */
export function nextInitDataAction(
  stored: ReloadAttempt | null,
  authDate: number | null,
  now: number,
): 'reload' | 'dead' {
  if (!stored) return 'reload'
  // 10 daqiqadan eski yozuv — avvalgi sessiya merosi, kechiramiz
  if (now - stored.at > 10 * 60_000) return 'reload'
  // auth_date O'ZGARGAN — bu yangi sessiya/launch, unga 1 reload huquqi bor
  if (stored.authDate !== authDate) return 'reload'
  // Shu auth_date bilan allaqachon reload qilingan — Telegram yangilamaydi: DEAD
  return 'dead'
}

function readAttempt(): ReloadAttempt | null {
  try {
    const raw = localStorage.getItem(INITDATA_RELOAD_GUARD)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReloadAttempt>
    return typeof parsed.at === 'number' ? { at: parsed.at, authDate: typeof parsed.authDate === 'number' ? parsed.authDate : null } : null
  } catch { return null }
}

function dispatchDead(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(INITDATA_DEAD_EVENT))
  }
}

export function requestFreshInitData(): void {
  const authDate = getTelegramWebApp()?.initDataUnsafe?.auth_date ?? null
  const now = Date.now()
  if (nextInitDataAction(readAttempt(), authDate, now) === 'dead') {
    dispatchDead()
    return
  }
  try { localStorage.setItem(INITDATA_RELOAD_GUARD, JSON.stringify({ at: now, authDate } satisfies ReloadAttempt)) }
  catch { /* private mode — yozilmasa ham reload qilamiz */ }
  window.location.reload()
}

/** Mini App'ni yopish — fresh initData olishning YAGONA ishonchli yo'li
 *  (keyingi ochilishda Telegram yangi auth_date bilan initData tuzadi). */
export function closeMiniApp(): void {
  getTelegramWebApp()?.close?.()
}
