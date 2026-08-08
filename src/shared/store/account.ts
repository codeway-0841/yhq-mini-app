/**
 * Account-scoped state — Telegram akkaunt almashganda ATOMIK tozalanadigan
 * store'larning YAGONA ro'yxati (single source of truth).
 *
 * YANGI user-scoped store qo'shilsa: FAQAT shu faylga qo'shing —
 * App.tsx yoki boshqa joyda reset ro'yxati TAKRORLANMAYDI (desync xavfi:
 * bitta joy yangilanmay qolsa, shared qurilmada oldingi akkaunt
 * ma'lumotlari keyingi akkauntga ko'rinib qoladi).
 *
 * User-KEYED store'lar (masalan useLessonsStore — `byUser[userId]`) bu
 * ro'yxatga KIRMAYDI: ular akkauntlarni id orqali ajratadi, chalkashmaydi;
 * ularni tozalash qaytgan foydalanuvchining progressini yo'qotardi.
 */

import { useAppStore }         from './useAppStore'
import { useDailyStore }       from './useDailyStore'
import { useAdaptiveStore }    from './useAdaptiveStore'
import { useTestSessionStore } from './useTestSessionStore'

/**
 * Account-scoped persist kalitlari — account switch'da disk'dan ham o'chiriladi.
 * (State reset zustand persist orqali default qiymatni yozadi; `removeItem`
 * qo'shimcha himoya — eski snapshot hech qanday iz qoldirmasligi uchun.)
 */
export const ACCOUNT_STORAGE_KEYS = [
  'yhq-app-store',
  'yhq-daily',
  'yhq-adaptive-store',
  'yhq-test-session',
] as const

/**
 * Barcha account-scoped store'larni reset qiladi va persisted snapshotlarni
 * localStorage'dan o'chiradi. Telegram akkaunt almashganda va browser
 * preview (ghost user) rejimida chaqiriladi.
 */
export function resetAccountState(): void {
  useAppStore.getState().resetAccount()
  useDailyStore.getState().resetAccount()
  useAdaptiveStore.getState().resetAll()
  useTestSessionStore.getState().clear()
  if (typeof localStorage !== 'undefined') {
    for (const key of ACCOUNT_STORAGE_KEYS) {
      try { localStorage.removeItem(key) } catch { /* private mode — ignore */ }
    }
  }
}

/**
 * Verified Telegram id persist cache egasidan FARQ qilsa, account state'ni
 * atomik tozalaydi va `false` qaytaradi (warm start TAQIQLANADI).
 * Mos bo'lsa yoki cache bo'sh bo'lsa `true`.
 *
 * Warm start xavfsizligi: UI cache'dagi user ma'lumotlari bilan FAQAT shu
 * tekshiruv `true` qaytargandan keyin ochilishi mumkin (shared qurilmada
 * oldingi akkauntning streak/premium/PII'si yangi akkauntga sizmasligi uchun).
 */
export function ensureAccountOwner(verifiedId: string): boolean {
  const cachedId = useAppStore.getState().user?.id
  if (!cachedId || cachedId === verifiedId) return true
  resetAccountState()
  return false
}
