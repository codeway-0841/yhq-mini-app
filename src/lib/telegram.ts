/**
 * Telegram WebApp helpers — safe outside Telegram (browser fallbacks).
 */

interface TelegramWebApp {
  openTelegramLink?(url: string): void
  shareURL?(url: string, text?: string): void
}

function getWebApp(): TelegramWebApp | undefined {
  return (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
}

/** Open a t.me link inside Telegram (or a new browser tab as fallback). */
export function openTelegramLink(url: string): void {
  const tg = getWebApp()
  if (tg?.openTelegramLink) tg.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

/** Share a URL via Telegram (or navigator.share / clipboard as fallback). */
export function shareUrl(url: string, text?: string): void {
  const tg = getWebApp()
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
