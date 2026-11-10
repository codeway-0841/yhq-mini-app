/**
 * Streak va Streak Charge (Zaryad) qoidalari — server + client YAGONA MANBA.
 *
 * Kunlik faollik sharti:
 *   1) Test rejimida kamida 1 ta to'liq sessiyani (bilet/mavzu/mock/imtihon,
 *      >= 5 savol; `single` bundan mustasno) yakunlash, YOKI
 *   2) Marafon / Attestatsiya / Milliy sertifikat / testlarda kuniga kamida
 *      15 ta savol yechish (xato yoki to'g'ri farqsiz).
 *
 * Uzilish va Zaryad bosqichlari (gapDays = ketma-ket TO'LIQ o'tkazib yuborilgan kunlar):
 *   gapDays <= 0                → seriya +1 (yangi kunda); har 7 kunda +1 zaryad (max 2)
 *   gapDays == 1 + charges > 0  → 1 ta zaryad sarflanadi, seriya SAQLANADI (o'smaydi)
 *   gapDays == 1 + charges == 0 → STREAK_SAVE_COST (100 coin) evaziga saqlanadi (o'smaydi)
 *   qolgan barcha holat         → reset (streak = 1, coin tegilmaydi)
 *
 * Server SQL (`server/modules/daily/streak-save-sql.ts`) shu jadval bilan
 * BIR XIL qaror beradi — biri o'zgarsa ikkinchisi ham o'zgarishi shart.
 */

export const STREAK_SAVE_COST = 100
export const STREAK_DAILY_MIN_ANSWERS = 15
export const STREAK_COMPLETION_MIN_QUESTIONS = 5
export const STREAK_CHARGE_MAX = 2
export const STREAK_CHARGE_EARN_EVERY = 7

export type StreakOutcome = 'continue' | 'charge_save' | 'coin_save' | 'reset'

/** Test sessiyasidagi javob streak shartini bajardimi? */
export function doesTestAnswerQualifyStreak(input: {
  mode: string
  answeredInSession: number
  totalQuestions: number
  completed: boolean
}): boolean {
  if (input.mode === 'single') return false
  if (input.answeredInSession >= STREAK_DAILY_MIN_ANSWERS) return true
  return input.completed && input.totalQuestions >= STREAK_COMPLETION_MIN_QUESTIONS
}

/** Shu seriya bosqichida yangi zaryad beriladimi (har 7 kunda +1) */
export function isChargeEarnMilestone(nextStreak: number): boolean {
  return nextStreak > 0 && nextStreak % STREAK_CHARGE_EARN_EVERY === 0
}

/** `gapDays === 1` va zaryad 0 bo'lganda coin bilan saqlash bosqichiga tushadi */
export function isCoinSaveStage(gapDays: number, charges: number): boolean {
  return gapDays === 1 && charges <= 0
}

export function decideStreakOutcome(input: {
  gapDays: number
  charges: number
  balance: number
}): StreakOutcome {
  const { gapDays, charges, balance } = input
  if (gapDays <= 0) return 'continue'
  if (gapDays !== 1) return 'reset'
  if (charges > 0) return 'charge_save'
  return balance >= STREAK_SAVE_COST ? 'coin_save' : 'reset'
}
