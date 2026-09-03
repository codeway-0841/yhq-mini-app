/**
 * Settings Service — Sozlamalar bilan bog'liq tarmoq va apparat side-effectlari.
 * Zustand store faqat xotira holatini o'zgartiradi, bu servis esa
 * API va native bildirishnomalar bilan ishlaydi.
 */

import { api, type ApiSettings } from '../api'
import { scheduleDailyStreakReminder, cancelDailyStreakReminder } from '../../platform/native'

export const settingsService = {
  /**
   * Qurilma native bildirishnomasini rejalashtirish yoki bekor qilish.
   */
  syncNativeReminder(settings: Pick<ApiSettings, 'dailyReminder' | 'dailyReminderTime' | 'language'>): void {
    if (settings.dailyReminder !== false) {
      void scheduleDailyStreakReminder(settings.dailyReminderTime || '20:00', settings.language)
    } else {
      void cancelDailyStreakReminder()
    }
  },

  /**
   * Sozlamalarni serverga sinxronlash (patch).
   * 400 validation xatosida rollback callback chaqiriladi.
   */
  syncSettingsRemote(userId: string | undefined, patch: Partial<ApiSettings>, onRollback: () => void): void {
    if (!userId || userId === '0') return

    api.patchSettings(userId, patch).catch((err) => {
      console.warn('Settings sync xatosi (mahalliy tanlov saqlandi):', err?.message ?? err)
      // Faqat validatsiya xatosida (400) eski qiymatga qaytaramiz
      if (String(err?.message ?? '').includes(' 400')) {
        onRollback()
      }
    })
  },
}
