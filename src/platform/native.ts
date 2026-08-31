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
import { StatusBar, Style } from '@capacitor/status-bar'
import { bindBackButton, getTelegramWebApp } from './telegram'

/** Haqiqiy native APK ichidaymi? Telegram WebView / brauzer — false. */
export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

/**
 * Native chrome (status bar + safe-area) bir martalik sozlash — main.tsx'dan
 * React render'dan OLDIN chaqiriladi (birinchi kadrda siljish bo'lmasligi uchun).
 *
 * 1. `body[data-platform='native']` — index.css shu attributga
 *    `padding-top: env(safe-area-inset-top)` qo'yadi (edge-to-edge WebView'da
 *    kontent tizim status bar ostida qolmasligi uchun). Telegram/brauzer'da
 *    HECH QANDAY o'zgarish yo'q (TG o'z safe-area'sini o'zi boshqaradi).
 * 2. StatusBar overlay: Android 15+ (targetSdk 36) edge-to-edge'ni MAJBURIY
 *    qiladi; `overlay: true` pre-15 qurilmalarda ham xuddi shu ko'rinishni
 *    beradi — platformalararo yagona xatti-harakat (canvas status bar ortida).
 * 3. Dastlabki icon uslubi — app.html boot script yozgan body[data-theme]'dan
 *    o'qiladi (keyingi almashinuvlar ThemeEffect → syncStatusBarStyle).
 */
export function applyNativeChrome(): void {
  if (!isNativeApp()) return
  document.body.dataset.platform = 'native'
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
  syncStatusBarStyle(document.body.dataset.theme !== 'light')
}

/** Status bar icon rangini app temasiga sinxronlaydi (dark tema → oq iconlar). */
export function syncStatusBarStyle(isDark: boolean): void {
  if (!isNativeApp()) return
  StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
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

const STREAK_NOTIF_ID = 1001
const NOTIF_CHANNEL_ID = 'daily_streak'

/**
 * Bildirishnoma ruxsatini so'rash (APK'da Capacitor, Web'da Notification API).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const status = await LocalNotifications.checkPermissions()
      if (status.display === 'granted') return true
      const req = await LocalNotifications.requestPermissions()
      return req.display === 'granted'
    } catch {
      return false
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') return true
      if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission()
        return perm === 'granted'
      }
    } catch {
      return false
    }
  }
  return false
}

/**
 * Kunlik streak intizom eslatmasini rejalashtirish (har kuni belgilangan soat/daqiqada).
 * @param time 'HH:mm' formatida (masalan, '20:00')
 * @param lang 'uz' | 'ru'
 */
export async function scheduleDailyStreakReminder(time: string, lang: 'uz' | 'ru' = 'uz'): Promise<boolean> {
  const [hStr, mStr] = time.split(':')
  const hour = Number(hStr)
  const minute = Number(mStr)
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false
  }

  const title = lang === 'ru' ? '🔥 Не потеряйте вашу серию!' : "🔥 Seriyangizni yo'qotmang!"
  const body = lang === 'ru'
    ? 'Решите сегодня 5 вопросов и сохраните ударный режим!'
    : "Bugun 5 ta savol yechib, intizom seriyangizni saqlab qoling!"

  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const granted = await requestNotificationPermission()
      if (!granted) return false

      // Android Notification Channel (Importance High + ovoz)
      await LocalNotifications.createChannel({
        id: NOTIF_CHANNEL_ID,
        name: lang === 'ru' ? 'Ежедневные напоминания' : 'Kunlik eslatmalar',
        description: lang === 'ru' ? 'Напоминания о тренировке и серии' : 'Kunlik test va streak eslatmalari',
        importance: 4,
        visibility: 1,
        vibration: true,
      }).catch(() => {})

      // Avvalgi rejalashtirilgan eslatmani tozalaymiz
      await LocalNotifications.cancel({ notifications: [{ id: STREAK_NOTIF_ID }] }).catch(() => {})

      // Har kuni takrorlanuvchi eslatma
      await LocalNotifications.schedule({
        notifications: [
          {
            id: STREAK_NOTIF_ID,
            title,
            body,
            channelId: NOTIF_CHANNEL_ID,
            schedule: {
              on: {
                hour,
                minute,
              },
              repeats: true,
              allowWhileIdle: true,
            },
          },
        ],
      })
      return true
    } catch (e) {
      console.warn('scheduleDailyStreakReminder error:', e)
      return false
    }
  }

  return false
}

/**
 * Rejalashtirilgan kunlik eslatmani bekor qilish.
 */
export async function cancelDailyStreakReminder(): Promise<void> {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [{ id: STREAK_NOTIF_ID }] }).catch(() => {})
    } catch {}
  }
}
