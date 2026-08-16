import { describe, it, expect } from 'vitest'
import {
  prevDate,
  isFrozenDay,
  calcNextStreak,
  effectiveStreak,
  calcBestStreak,
} from '../../../server/modules/daily/daily.repository'

describe('Daily Streak Temporal State Machine & Freeze Protection', () => {
  describe('prevDate — UTC Date Calculations & Boundary Transitions', () => {
    it('calculates the previous date in standard month days', () => {
      expect(prevDate('2026-08-16')).toBe('2026-08-15')
      expect(prevDate('2026-05-10')).toBe('2026-05-09')
    })

    it('handles non-leap year boundary (March 1 -> Feb 28)', () => {
      expect(prevDate('2026-03-01')).toBe('2026-02-28')
      expect(prevDate('2025-03-01')).toBe('2025-02-28')
    })

    it('handles leap year boundary correctly (March 1 -> Feb 29)', () => {
      expect(prevDate('2024-03-01')).toBe('2024-02-29')
      expect(prevDate('2028-03-01')).toBe('2028-02-29')
    })

    it('handles year boundary transition (Jan 1 -> Dec 31)', () => {
      expect(prevDate('2026-01-01')).toBe('2025-12-31')
      expect(prevDate('2030-01-01')).toBe('2029-12-31')
    })
  })

  describe('isFrozenDay — Premium Freeze Window Detection', () => {
    it('returns true when last activity was exactly 2 days ago (1 skipped day)', () => {
      const today = '2026-08-16'
      const missedYesterday = '2026-08-14' // Skipped 2026-08-15
      expect(isFrozenDay(missedYesterday, today)).toBe(true)
    })

    it('returns false for yesterday (no break), today, or 2+ missed days', () => {
      const today = '2026-08-16'
      expect(isFrozenDay('2026-08-15', today)).toBe(false) // yesterday
      expect(isFrozenDay('2026-08-16', today)).toBe(false) // today
      expect(isFrozenDay('2026-08-13', today)).toBe(false) // 3 days ago (2 missed)
      expect(isFrozenDay('2026-08-01', today)).toBe(false) // long gap
    })
  })

  describe('calcNextStreak — Submission Transition Logic', () => {
    it('initializes streak to 1 for first-time submissions', () => {
      expect(calcNextStreak(null, '2026-08-16', 0, false)).toBe(1)
      expect(calcNextStreak(null, '2026-08-16', 0, true)).toBe(1)
    })

    it('is idempotent for multiple submissions on the same calendar day', () => {
      expect(calcNextStreak('2026-08-16', '2026-08-16', 5, false)).toBe(5)
      expect(calcNextStreak('2026-08-16', '2026-08-16', 5, true)).toBe(5)
    })

    it('increments streak when consecutive (yesterday -> today)', () => {
      expect(calcNextStreak('2026-08-15', '2026-08-16', 7, false)).toBe(8)
      expect(calcNextStreak('2026-08-15', '2026-08-16', 7, true)).toBe(8)
    })

    it('resets streak to 1 for Free users if 1 day is missed', () => {
      // Free user: last activity was 2026-08-14, today is 2026-08-16 (missed 15th)
      expect(calcNextStreak('2026-08-14', '2026-08-16', 10, false)).toBe(1)
    })

    it('preserves and increments streak for Premium users on 1-day miss (Streak Freeze)', () => {
      // Premium user: missed 1 day (15th), resumes on 16th -> streak continues
      expect(calcNextStreak('2026-08-14', '2026-08-16', 10, true)).toBe(11)
    })

    it('resets streak to 1 for Premium users if 2 or more days are missed', () => {
      // Premium user: last was 13th, today is 16th (missed 14th and 15th)
      expect(calcNextStreak('2026-08-13', '2026-08-16', 20, true)).toBe(1)
    })
  })

  describe('effectiveStreak — Read-Time Streak Display Logic', () => {
    it('returns 0 when there is no recorded streak', () => {
      expect(effectiveStreak(null, '2026-08-16', 0, false)).toBe(0)
    })

    it('returns current streak if user was active today or yesterday', () => {
      expect(effectiveStreak('2026-08-16', '2026-08-16', 5, false)).toBe(5)
      expect(effectiveStreak('2026-08-15', '2026-08-16', 5, false)).toBe(5)
    })

    it('returns 0 for Free users if last active was 2+ days ago', () => {
      expect(effectiveStreak('2026-08-14', '2026-08-16', 12, false)).toBe(0)
      expect(effectiveStreak('2026-08-01', '2026-08-16', 12, false)).toBe(0)
    })

    it('maintains frozen streak on read-time for Premium users if exactly 1 day missed', () => {
      // Premium user viewing app today (16th) having missed yesterday (15th)
      expect(effectiveStreak('2026-08-14', '2026-08-16', 14, true)).toBe(14)
    })

    it('returns 0 for Premium users if 2+ days missed', () => {
      expect(effectiveStreak('2026-08-13', '2026-08-16', 14, true)).toBe(0)
    })
  })

  describe('calcBestStreak — Historical Run Evaluation', () => {
    it('returns 0 for empty activity history', () => {
      expect(calcBestStreak([])).toBe(0)
    })

    it('returns 1 for a single active day', () => {
      expect(calcBestStreak(['2026-08-16'])).toBe(1)
    })

    it('computes unbroken continuous streak accurately', () => {
      const dates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']
      expect(calcBestStreak(dates)).toBe(5)
    })

    it('extracts maximum continuous run from disjoint segments', () => {
      const dates = [
        '2026-08-01', '2026-08-02',                           // run = 2
        '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', // run = 4 (best)
        '2026-08-11',                                         // run = 1
        '2026-08-14', '2026-08-15', '2026-08-16',             // run = 3
      ]
      expect(calcBestStreak(dates)).toBe(4)
    })
  })
})
