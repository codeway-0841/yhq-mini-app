import { describe, expect, it } from 'vitest'
import {
  STREAK_CHARGE_DAILY_MIN_ANSWERS,
  STREAK_CHARGE_MAX,
  STREAK_CHARGE_UNITS_REQUIRED,
  STREAK_DAILY_MIN_ANSWERS,
  decideStreakOutcome,
  doesTestAnswerQualifyChargeUnit,
  doesTestAnswerQualifyStreak,
  getTestAnswerChargeUnits,
} from '../../../shared/streak-save'

describe('decideStreakOutcome (Brilliant 1:1 Streak Charge)', () => {
  const d = (gapDays: number, charges: number) =>
    decideStreakOutcome({ gapDays, charges })

  it("gapDays<=0 — seriya oddiy davom etadi (zaryad sarflanmaydi)", () => {
    expect(d(0, 0)).toBe('continue')
    expect(d(0, 2)).toBe('continue')
    expect(d(-1, 1)).toBe('continue')
  })

  it('gapDays>=1 va charges >= gapDays — zaryad sarflanib seriya saqlanadi', () => {
    expect(d(1, 1)).toBe('charge_save')
    expect(d(1, STREAK_CHARGE_MAX)).toBe('charge_save')
    expect(d(2, 2)).toBe('charge_save')
  })

  it('charges < gapDays — coin fallback yo‘q, reset (zaryad saqlanib qoladi)', () => {
    expect(d(1, 0)).toBe('reset')
    expect(d(2, 1)).toBe('reset')
    expect(d(2, 0)).toBe('reset')
    expect(d(3, 2)).toBe('reset')
  })

  it('Brilliant 1:1 global konstantalar', () => {
    expect(STREAK_CHARGE_MAX).toBe(2)
    expect(STREAK_CHARGE_UNITS_REQUIRED).toBe(3)
    expect(STREAK_CHARGE_DAILY_MIN_ANSWERS).toBe(20)
  })
})

describe('doesTestAnswerQualifyStreak & doesTestAnswerQualifyChargeUnit', () => {
  it("kamida 15 javob YOKI to'liq bilet (>=5 savol) tugaganda streak true", () => {
    expect(STREAK_DAILY_MIN_ANSWERS).toBe(15)
    expect(doesTestAnswerQualifyStreak({ mode: 'marathon', answeredInSession: 14, totalQuestions: 100, completed: false })).toBe(false)
    expect(doesTestAnswerQualifyStreak({ mode: 'marathon', answeredInSession: 15, totalQuestions: 100, completed: false })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'exam', answeredInSession: 15, totalQuestions: 45, completed: false })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'ticket', answeredInSession: 10, totalQuestions: 10, completed: true })).toBe(true)
    expect(doesTestAnswerQualifyStreak({ mode: 'single', answeredInSession: 1, totalQuestions: 1, completed: true })).toBe(false)
  })

  it("to'liq test (>=5 savol) 1 birlik, >=20 javob esa to'liq +1 batareya (3 birlik) beradi (single mustasno)", () => {
    expect(doesTestAnswerQualifyChargeUnit({ mode: 'ticket', totalQuestions: 10, completed: true })).toBe(true)
    expect(doesTestAnswerQualifyChargeUnit({ mode: 'adaptive', totalQuestions: 5, completed: true })).toBe(true)
    expect(doesTestAnswerQualifyChargeUnit({ mode: 'ticket', totalQuestions: 10, completed: false })).toBe(false)
    expect(doesTestAnswerQualifyChargeUnit({ mode: 'ticket', totalQuestions: 4, completed: true })).toBe(false)
    expect(doesTestAnswerQualifyChargeUnit({ mode: 'single', totalQuestions: 5, completed: true })).toBe(false)

    expect(getTestAnswerChargeUnits({ mode: 'topic', answeredInSession: 19, totalQuestions: 25, completed: false })).toBe(0)
    expect(getTestAnswerChargeUnits({ mode: 'topic', answeredInSession: 20, totalQuestions: 25, completed: false })).toBe(STREAK_CHARGE_UNITS_REQUIRED)
    expect(getTestAnswerChargeUnits({ mode: 'random', answeredInSession: 25, totalQuestions: 25, completed: true })).toBe(STREAK_CHARGE_UNITS_REQUIRED)
    expect(getTestAnswerChargeUnits({ mode: 'ticket', answeredInSession: 10, totalQuestions: 10, completed: true })).toBe(1)
    expect(getTestAnswerChargeUnits({ mode: 'single', answeredInSession: 20, totalQuestions: 20, completed: true })).toBe(0)
  })
})
