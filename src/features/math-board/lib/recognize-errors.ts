/**
 * Math Board — recognition xatolarini aniq xabarga maplash.
 *
 * Muammo: hamma server xatosi "Qayta urinish" deb chiqardi — foydalanuvchi
 * limit tugaganini (429) Gemini o'chganidan (503) ajratolmasdi.
 * ApiError.status/code → i18n kalit (sof funksiya, testda qoplanadi).
 */

import { ApiError } from '../../../shared/api'
import type { Keys } from '../../../shared/i18n'

export function recognitionErrorKey(err: unknown): Keys {
  if (err instanceof ApiError) {
    // 404 = backend'da route yo'q (eski server — math-board router'siz).
    // Eng ko'p uchraydigan test-davr xatosi: backend qayta ishga tushirilmagan.
    if (err.status === 404) return 'mathBoardServerOld'
    if (err.status === 429) {
      return err.code === 'daily_limit' ? 'mathBoardQuotaDaily' : 'mathBoardQuotaFree'
    }
    // 502 = Gemini o'qiy olmadi (chala yozuv) yoki upstream xato.
    if (err.status === 502) return 'mathBoardUnreadable'
    if (err.status === 503) return 'mathBoardAiOff'
    if (err.status === 408 || err.code === 'timeout') return 'mathBoardTryAgain'
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'mathBoardOffline'
  return 'mathBoardTryAgain'
}
