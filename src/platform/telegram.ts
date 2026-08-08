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

interface TelegramWebApp {
  ready?(): void
  expand?(): void
  openTelegramLink?(url: string): void
  shareURL?(url: string, text?: string): void
  initData?: string
  initDataUnsafe?: {
    start_param?: string
    user?: TelegramUser
  }
  BackButton?: BackButton
  requestContact?(callback: (ok: boolean, data?: { contact?: { phone_number: string } }) => void): void
  addToHomeScreen?(): void
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
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

/** App bootstrap: Telegram'ga "tayyor" signalini berish + to'liq ekranga yoyish. */
export function readyAndExpand(): void {
  const tg = getTelegramWebApp()
  if (tg) { tg.ready?.(); tg.expand?.() }
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
