import { describe, expect, it } from 'vitest'
import { STREAK_SAVE_COST, decideStreakOutcome, isCoinSaveStage } from '../../../shared/streak-save'

describe('decideStreakOutcome', () => {
  const d = (gapDays: number, premium: boolean, balance: number) =>
    decideStreakOutcome({ gapDays, premium, balance })

  it("gapDays=0 — seriya oddiy davom etadi (coin tegilmaydi)", () => {
    expect(d(0, false, 0)).toBe('continue')
    expect(d(0, true, 0)).toBe('continue')
  })

  it('gapDays=1 + premium — BEPUL saqlanadi', () => {
    expect(d(1, true, 0)).toBe('continue')
  })

  it("gapDays=1 + premium EMAS + balans yetarli — coin bilan saqlanadi", () => {
    expect(d(1, false, STREAK_SAVE_COST)).toBe('coin_save')
    expect(d(1, false, STREAK_SAVE_COST + 10)).toBe('coin_save')
  })

  it("gapDays=1 + premium EMAS + balans yetmaydi — reset", () => {
    expect(d(1, false, STREAK_SAVE_COST - 1)).toBe('reset')
    expect(d(1, false, 0)).toBe('reset')
  })

  it("gapDays=2 + premium — bepul kun ishlatilgan, endi coin kerak", () => {
    expect(d(2, true, STREAK_SAVE_COST)).toBe('coin_save')
    expect(d(2, true, STREAK_SAVE_COST - 1)).toBe('reset')
  })

  it("gapDays=2 + premium EMAS — coin sinovi FAQAT 1-kunlik uzilishda", () => {
    expect(d(2, false, 10_000)).toBe('reset')
  })

  it("gapDays>=3 — hech qanday holatda saqlanmaydi", () => {
    expect(d(3, true, 10_000)).toBe('reset')
    expect(d(10, true, 10_000)).toBe('reset')
    expect(d(3, false, 10_000)).toBe('reset')
  })

  it('narx 100 coin', () => {
    expect(STREAK_SAVE_COST).toBe(100)
  })
})

describe('isCoinSaveStage', () => {
  it('faqat (1, bepul) va (2, premium) coin bosqichi', () => {
    expect(isCoinSaveStage(1, false)).toBe(true)
    expect(isCoinSaveStage(2, true)).toBe(true)
    expect(isCoinSaveStage(1, true)).toBe(false)
    expect(isCoinSaveStage(2, false)).toBe(false)
    expect(isCoinSaveStage(0, false)).toBe(false)
    expect(isCoinSaveStage(3, true)).toBe(false)
  })
})
