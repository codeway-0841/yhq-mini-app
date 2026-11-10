import { describe, expect, it } from 'vitest'
import {
  STREAK_CHARGE_MAX,
  STREAK_DAILY_MIN_ANSWERS,
  STREAK_SAVE_COST,
  decideStreakOutcome,
  doesTestAnswerQualifyStreak,
  isChargeEarnMilestone,
  isCoinSaveStage,
} from '../../../shared/streak-save'

describe('decideStreakOutcome (Streak Charge + Coin Save)', () => {
  const d = (gapDays: number, charges: number, balance: number) =>
    decideStreakOutcome({ gapDays, charges, balance })

  it("gapDays=0 — seriya oddiy davom etadi (zaryad va coin tegilmaydi)", () => {
    expect(d(0, 0, 0)).toBe('continue')
    expect(d(0, 2, 0)).toBe('continue')
  })

  it('gapDays=1 + zaryad bor (charges > 0) — zaryad sarflanadi, coin tegilmaydi', () => {
    expect(d(1, 1, 0)).toBe('charge_save')
    expect(d(1, STREAK_CHARGE_MAX, 500)).toBe('charge_save')
  })

  it("gapDays=1 + zaryad 0 + balans yetarli — coin bilan saqlanadi", () => {
    expect(d(1, 0, STREAK_SAVE_COST)).toBe('coin_save')
    expect(d(1, 0, STREAK_SAVE_COST + 10)).toBe('coin_save')
  })

  it("gapDays=1 + zaryad 0 + balans yetmaydi — reset", () => {
    expect(d(1, 0, STREAK_SAVE_COST - 1)).toBe('reset')
    expect(d(1, 0, 0)).toBe('reset')
  })

  it("gapDays>=2 — zaryad yoki balansdan qat'i nazar reset", () => {
    expect(d(2, 2, 10_000)).toBe('reset')
    expect(d(3, 2, 10_000)).toBe('reset')
    expect(d(10, 0, 10_000)).toBe('reset')
  })

  it('narx 100 coin va max 2 ta zaryad', () => {
    expect(STREAK_SAVE_COST).toBe(100)
    expect(STREAK_CHARGE_MAX).toBe(2)
  })
})

describe('isCoinSaveStage', () => {
  it('faqat (gapDays=1, charges=0) coin bosqichi', () => {
    expect(isCoinSaveStage(1, 0)).toBe(true)
    expect(isCoinSaveStage(1, 1)).toBe(false)
    expect(isCoinSaveStage(1, 2)).toBe(false)
    expect(isCoinSaveStage(2, 0)).toBe(false)
    expect(isCoinSaveStage(0, 0)).toBe(false)
  })
})

describe('doesTestAnswerQualifyStreak & isChargeEarnMilestone', () => {
  it('kamida 15 javob YOKI to\'liq bilet (>=5 savol) tugaganda true', () => {
    expect(STREAK_DAILY_MIN_ANSWERS).toBe(15)
    expect(doesTestAnswerQualifyStreak({ mode: 'marathon', answeredInSession: 14, totalQuestions: 100, completed: false })).toBe(false)
    expect(doesTestAnswerQualifyStreak({ mode: 'marathon', answeredInSession: 15, totalQuestions: 100, completed: false })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'exam', answeredInSession: 15, totalQuestions: 45, completed: false })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'ticket', answeredInSession: 10, totalQuestions: 10, completed: true })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'single', answeredInSession: 1, totalQuestions: 1, completed: true })).toBe(false)
  })

  it('har 7 kunlik seriyada +1 zaryad bosqichi', () => {
    expect(isChargeEarnMilestone(7)).toBe(true)
    expect(isChargeEarnMilestone(14)).toBe(true)
    expect(isChargeEarnMilestone(1)).toBe(false)
    expect(isChargeEarnMilestone(6)).toBe(false)
  })
})
