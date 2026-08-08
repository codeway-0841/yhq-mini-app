/**
 * Capacitor (native APK) adapter — Telegram'dan TASHQARI platforma
 * funksiyalarining YAGONA kirish nuqtasi (AGENTS.md 1b qoidasi kengaytmasi).
 *
 * Priority qoidasi (UI kodi farqni bilmaydi):
 *   Telegram ichida → telegram.ts API'lari (xatti-harakat O'ZGARMAS)
 *   Native APK'da   → Capacitor plug-in'lari
 *   Oddiy brauzer   → xavfsiz no-op
 *
 * @capacitor/* paketlari brauzerda xavfsiz import qilinadi (web fallback)
 * — shuning uchun static import ixtiyoriy.
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { bindBackButton, getTelegramWebApp } from './telegram'

/** Haqiqiy native APK ichidaymi? Telegram WebView / brauzer — false. */
export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

/**
 * Yagona "orqaga" adapteri — telegram.ts bindBackButton bilan birlashtirilgan:
 *  - Telegram'da → Telegram BackButton (telegram.ts delegatsiyasi, o'zgarmas)
 *  - Native APK'da, visible=true → hardware/gesture back tugmasi onBack'ga bog'lanadi
 *    (visible=false → listener yo'q: bosh sahifada tizim default'i — app minimizatsiyasi)
 *  - Brauzerda → no-op (undefined)
 *
 * Qaytarilgan cleanup useEffect'dan CHIQARILISHI shart.
 */
export function bindAppBackButton(visible: boolean, onBack: () => void): (() => void) | undefined {
  if (getTelegramWebApp()) return bindBackButton(visible, onBack)
  if (!visible || !isNativeApp()) return undefined

  const promise = App.addListener('backButton', onBack)
  let removed = false
  return () => {
    if (removed) return
    removed = true
    promise.then((h) => h.remove()).catch(() => {})
  }
}

/** Native splash'ni app init'dan keyin yashiradi. Brauzer/Telegram'da no-op. */
export function hideSplashScreen(): void {
  if (!isNativeApp()) return
  SplashScreen.hide().catch(() => {})
}
