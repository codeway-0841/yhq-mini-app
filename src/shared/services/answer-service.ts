/**
 * Answer Service — Savol javoblarini serverga yuborish, offline outbox fallback
 * va fatal xatolarni ajratish xizmati.
 *
 * Qat'iy qoida: bu servis Store'ni import qilmaydi (circular dependency yo'q).
 * Faqat API, outbox va sof ma'lumotlar bilan ishlaydi.
 */

import { api, ApiError } from '../api'
import { enqueueOutbox, onResultSync, newId, type ResultSyncInfo } from '../lib/outbox'
import { todayStr } from '../store/useDailyStore'

export interface SubmitOutcome {
  correct:       boolean | null
  correctAnswer: string | null
  duplicate:     boolean
  coinsEarned:   number
  xpEarned:      number
}

export interface SubmitFatal {
  fatal: true
  code?: string
}

export type SubmitResult = SubmitOutcome | SubmitFatal | null

export interface SubmitServerPayload {
  userId:         string
  subjectId:      string
  questionId:     number
  selectedAnswer: string | null
  elapsedMs?:     number
}

export interface SubmitServerSuccess {
  outcome:    SubmitOutcome
  serverData: {
    correct:     boolean | null
    dailyStreak: number | null
    coinSaved?:  boolean
    coinBalance?: number | null
    xp?:         number | null
  }
}

export interface SubmitServerFailure {
  outcome: SubmitFatal | null
}

export type SubmitServerResult = SubmitServerSuccess | SubmitServerFailure

export const answerService = {
  /**
   * Javobni serverga jo'natadi.
   *  - Muvaffaqiyat: SubmitOutcome + store mutatsiyalari uchun serverData qaytaradi.
   *  - Fatal 4xx: { fatal: true, code } qaytaradi (outbox'ga yozilmaydi).
   *  - Offline/Tarmoq xatosi: outbox'ga yozadi va null qaytaradi.
   */
  async submitAnswerToServer(payload: SubmitServerPayload): Promise<SubmitServerResult> {
    const { userId, subjectId, questionId, selectedAnswer, elapsedMs } = payload
    const clientToken = newId()

    try {
      const res = await api.postResult(userId, {
        questionId,
        selectedAnswer,
        subjectId,
        clientToken,
        ...(elapsedMs != null ? { elapsedMs } : {}),
      })

      const outcome: SubmitOutcome = {
        correct:       res.correct,
        correctAnswer: res.correctAnswer,
        duplicate:     !!res.duplicate,
        coinsEarned:   res.duplicate ? 0 : (res.coinsEarned ?? 0),
        xpEarned:      res.duplicate ? 0 : (res.xpEarned ?? 0),
      }

      return {
        outcome,
        serverData: {
          correct:     res.correct,
          dailyStreak: res.dailyStreak,
          coinSaved:   res.coinSaved,
          coinBalance: res.coinBalance,
          xp:          res.xp,
        },
      }
    } catch (err) {
      // FATAL 4xx — server qat'iy rad etdi (validatsiya/auth/noto'g'ri so'rov):
      // outbox'ga yozish BEFOYDA va "offline"ga yutish xatoni yashirardi.
      if (err instanceof ApiError && !err.retryable) {
        console.warn('postResult rad etildi (fatal, outbox\'siz):', err.message)
        return { outcome: { fatal: true, code: err.code } }
      }

      // OFFLINE SYNC: javob outbox'ga yoziladi
      console.warn('postResult muvaffaqiyatsiz — outbox\'ga yozildi:', (err as Error)?.message ?? err)
      enqueueOutbox(userId, 'result', {
        questionId,
        selectedAnswer,
        subjectId,
        date: todayStr(),
        clientToken,
        ...(elapsedMs != null ? { elapsedMs } : {}),
      })

      return { outcome: null }
    }
  },

  /**
   * Xato to'g'rilanganda kunlik tuzatish hisoblagichini serverga yuborish (offline fallback bilan).
   */
  triggerDailyFix(userId: string, subjectId: string): void {
    if (!userId || userId === '0') return
    api.addDailyFix(userId, { subjectId }).catch(() => {
      enqueueOutbox(userId, 'daily-fix', { subjectId })
    })
  },

  /**
   * Outbox'dan replay bo'lgan javoblar sinxronizatsiyasiga explicit obuna bo'lish.
   * Auto-subscription EMAS — chaqiruvchi boshqaradi va unsubscribe qaytaradi.
   */
  subscribeResultSync(
    callback: (info: ResultSyncInfo) => void,
  ): () => void {
    return onResultSync(callback)
  },
}
