/**
 * Tashqi havolani ochish (PDF/dokument yuklab olish) — platformalararo YAGONA nuqta.
 *
 *  - Telegram Mini App → `tg.openLink` (Telegram o'zi in-app/tashqi brauzerni tanlaydi)
 *  - Native APK → `window.location.href`: Capacitor `BridgeWebViewClient` tashqi
 *    hostni `ACTION_VIEW` bilan tizim brauzeriga uzatadi (`window.open` WebView'da
 *    hech narsa qilmaydi — multiple-window qo'llab-quvvatlanmaydi).
 *  - Oddiy brauzer → yangi tab.
 */
import { getTelegramWebApp } from './telegram'
import { isNativeApp } from './native'

export function openExternalLink(url: string): void {
  if (!url) return

  if (isNativeApp()) {
    window.location.href = url
    return
  }

  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    try {
      tg.openLink(url)
      return
    } catch {
      /* fallback pastda */
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
