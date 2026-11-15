/**
 * Streak va Streak Charge (Zaryad) qoidalari — server + client YAGONA MANBA (Brilliant 1:1).
 *
 * Kunlik faollik sharti:
 *   1) Test rejimida kamida 1 ta to'liq sessiyani (bilet/mavzu/mock/imtihon,
 *      >= 5 savol; `single` bundan mustasno) yakunlash, YOKI
 *   2) Kuniga kamida 15 ta savol yechish, YOKI
 *   3) Interaktiv darsni muvaffaqiyatli tugatish.
 *
 * Seriya Zaryadi (batareya) yig'ish qoidasi (barcha fanlarda global):
 *   - Har STREAK_CHARGE_UNITS_REQUIRED (3) ta to'liq dars/test sessiyasi tugatilganda
 *     YOKI bir kunda kamida STREAK_CHARGE_DAILY_MIN_ANSWERS (20) ta test savoli
 *     yechilganda +1 zaryad beriladi.
 *   - Maksimum STREAK_CHARGE_MAX (2) ta batareya saqlanadi; hech qachon kuymaydi.
 *   - Bir kalendar kunda ko'pi bilan 1 ta batareya beriladi (`lastChargeEarnedDate < today`).
 *
 * Uzilish va Zaryad bosqichlari (gapDays = ketma-ket TO'LIQ o'tkazib yuborilgan kunlar):
 *   gapDays <= 0                → seriya +1 (yangi kunda) / o'zgarmaydi (shu kunda)
 *   gapDays >= 1 && charges >= gapDays → gapDays ta zaryad sarflanadi, seriya SAQLANADI (o'smaydi)
 *   gapDays >= 1 && charges < gapDays  → reset (streak = 1, mavjud zaryadlar kuymaydi)
 *
 * Server SQL (`server/modules/daily/streak-save-sql.ts`) shu jadval bilan
 * BIR XIL qaror beradi — biri o'zgarsa ikkinchisi ham o'zgarishi shart.
 */

export const STREAK_DAILY_MIN_ANSWERS = 15
export const STREAK_COMPLETION_MIN_QUESTIONS = 5
export const STREAK_CHARGE_DAILY_MIN_ANSWERS = 20
export const STREAK_CHARGE_MAX = 2
export const STREAK_CHARGE_UNITS_REQUIRED = 3

export type StreakOutcome = 'continue' | 'charge_save' | 'reset'

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

/** Test sessiyasidagi javob zaryad hisoblagichi uchun nechta birlik (`0`, `1`, yoki to'liq `3`) beradi? */
export function getTestAnswerChargeUnits(input: {
  mode: string
  answeredInSession?: number
  totalQuestions: number
  completed: boolean
}): number {
  if (input.mode === 'single') return 0
  if (
    (input.answeredInSession ?? 0) >= STREAK_CHARGE_DAILY_MIN_ANSWERS
    || (input.completed && input.totalQuestions >= STREAK_CHARGE_DAILY_MIN_ANSWERS)
  ) {
    return STREAK_CHARGE_UNITS_REQUIRED
  }
  return input.completed && input.totalQuestions >= STREAK_COMPLETION_MIN_QUESTIONS ? 1 : 0
}

/** Test sessiyasi zaryad hisoblagichi uchun kamida 1 birlik beradimi? */
export function doesTestAnswerQualifyChargeUnit(input: {
  mode: string
  answeredInSession?: number
  totalQuestions: number
  completed: boolean
}): boolean {
  return getTestAnswerChargeUnits(input) > 0
}

export function decideStreakOutcome(input: {
  gapDays: number
  charges: number
}): StreakOutcome {
  const { gapDays, charges } = input
  if (gapDays <= 0) return 'continue'
  if (charges >= gapDays) return 'charge_save'
  return 'reset'
}
