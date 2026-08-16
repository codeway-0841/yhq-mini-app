import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCard,
  updateCard,
  pickNext,
  SRCard,
} from '../../../src/shared/lib/spaced-repetition'

describe('Spaced Repetition (SM-2 Algorithm)', () => {
  const BASE_TIME = 1_700_000_000_000 // Fixed timestamp for deterministic tests

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createCard', () => {
    it('creates a card with default initial SM-2 parameters', () => {
      const card = createCard(42)
      expect(card).toEqual({
        questionId: 42,
        ef: 2.5,
        interval: 1,
        dueAt: 0,
        reps: 0,
      })
    })
  })

  describe('updateCard - Mathematical and Interval Progression', () => {
    it('maintains pure immutability — does not mutate the input card', () => {
      const original: SRCard = { questionId: 10, ef: 2.5, interval: 1, dueAt: 0, reps: 0 }
      const frozen = Object.freeze({ ...original })
      
      expect(() => updateCard(frozen, 1)).not.toThrow()
      expect(() => updateCard(frozen, 0)).not.toThrow()
      expect(frozen.reps).toBe(0)
    })

    it('correct answer streak follows exact SM-2 interval expansion (1d -> 6d -> prev * EF)', () => {
      let card = createCard(1)

      // Rep 1 (first correct) -> interval 1 day
      card = updateCard(card, 1)
      expect(card.reps).toBe(1)
      expect(card.interval).toBe(1)
      expect(card.dueAt).toBe(BASE_TIME + 1 * 86_400_000)
      expect(card.ef).toBe(2.5) // q=4: ef + 0.1 - 0.1 = 2.5 (clamped to 2.5)

      // Advance time to due date
      vi.setSystemTime(card.dueAt)

      // Rep 2 (second correct) -> interval 6 days
      card = updateCard(card, 1)
      expect(card.reps).toBe(2)
      expect(card.interval).toBe(6)
      expect(card.dueAt).toBe(BASE_TIME + 1 * 86_400_000 + 6 * 86_400_000)

      // Rep 3 (third correct) -> interval round(6 * 2.5) = 15 days
      vi.setSystemTime(card.dueAt)
      card = updateCard(card, 1)
      expect(card.reps).toBe(3)
      expect(card.interval).toBe(15) // round(6 * 2.5) = 15

      // Rep 4 (fourth correct) -> interval round(15 * 2.5) = 38 days
      vi.setSystemTime(card.dueAt)
      card = updateCard(card, 1)
      expect(card.reps).toBe(4)
      expect(card.interval).toBe(38) // round(15 * 2.5) = 37.5 -> 38
    })

    it('wrong answer degrades EF, resets streak, and schedules 60s fast-retry', () => {
      const advancedCard: SRCard = {
        questionId: 5,
        ef: 2.5,
        interval: 15,
        dueAt: BASE_TIME,
        reps: 3,
      }

      const updated = updateCard(advancedCard, 0)
      expect(updated.reps).toBe(0)
      expect(updated.interval).toBe(1)
      expect(updated.dueAt).toBe(BASE_TIME + 60_000) // 60s
      // q=1: 2.5 + 0.1 - 4 * (0.08 + 4 * 0.02) = 2.6 - 4 * 0.16 = 2.6 - 0.64 = 1.96
      expect(updated.ef).toBeCloseTo(1.96, 2)
    })

    it('clamps EF strictly between [1.3, 2.5]', () => {
      // 1. Minimum bound test: multiple consecutive failures
      let lowCard = createCard(1)
      for (let i = 0; i < 10; i++) {
        lowCard = updateCard(lowCard, 0)
      }
      expect(lowCard.ef).toBe(1.3) // EF_MIN clamp
      expect(lowCard.ef).toBeGreaterThanOrEqual(1.3)

      // 2. Maximum bound test: verify EF cannot exceed 2.5 upper clamp
      let card = createCard(2) // starts at 2.5
      expect(card.ef).toBe(2.5)
      for (let i = 0; i < 5; i++) {
        card = updateCard(card, 1) // q=4: ef' = ef + 0.1 - (1 * 0.1) = ef
      }
      expect(card.ef).toBe(2.5) // Clamped at upper limit
      expect(card.ef).toBeLessThanOrEqual(2.5)
    })
  })

  describe('pickNext - Deterministic Scheduling & Exclusions', () => {
    it('returns undefined when allIds is empty or contains only excludeId', () => {
      const cards = new Map<number, SRCard>()
      expect(pickNext(cards, [])).toBeUndefined()
      expect(pickNext(cards, [10], 10)).toBeUndefined()
    })

    it('prioritizes overdue cards sorted by dueAt ascending (oldest due first)', () => {
      const cards = new Map<number, SRCard>()
      // Card 1: due 5 minutes ago
      cards.set(1, { questionId: 1, ef: 2.5, interval: 1, dueAt: BASE_TIME - 300_000, reps: 1 })
      // Card 2: due 10 minutes ago (more overdue)
      cards.set(2, { questionId: 2, ef: 2.5, interval: 1, dueAt: BASE_TIME - 600_000, reps: 1 })
      // Card 3: not due yet (in future)
      cards.set(3, { questionId: 3, ef: 1.5, interval: 1, dueAt: BASE_TIME + 300_000, reps: 1 })

      const next = pickNext(cards, [1, 2, 3])
      expect(next).toBe(2) // Card 2 is the most overdue
    })

    it('surfaces lowest EF card when no cards are overdue', () => {
      const cards = new Map<number, SRCard>()
      // All cards in future
      cards.set(1, { questionId: 1, ef: 2.3, interval: 1, dueAt: BASE_TIME + 100_000, reps: 1 })
      cards.set(2, { questionId: 2, ef: 1.4, interval: 1, dueAt: BASE_TIME + 200_000, reps: 1 }) // weakest
      cards.set(3, { questionId: 3, ef: 2.0, interval: 1, dueAt: BASE_TIME + 50_000, reps: 1 })

      const next = pickNext(cards, [1, 2, 3])
      expect(next).toBe(2) // Card 2 has lowest EF (1.4)
    })

    it('strictly respects excludeId to prevent immediate question repetition', () => {
      const cards = new Map<number, SRCard>()
      cards.set(1, { questionId: 1, ef: 2.5, interval: 1, dueAt: BASE_TIME - 500_000, reps: 1 })
      cards.set(2, { questionId: 2, ef: 2.5, interval: 1, dueAt: BASE_TIME - 200_000, reps: 1 })

      // If question 1 was just answered, pickNext must not return 1 even if it is the most overdue
      const next = pickNext(cards, [1, 2], 1)
      expect(next).toBe(2)
    })

    it('treats unencountered IDs as dueAt: 0 (instant review priority)', () => {
      const cards = new Map<number, SRCard>()
      // Card 1 is existing and future
      cards.set(1, { questionId: 1, ef: 2.5, interval: 1, dueAt: BASE_TIME + 100_000, reps: 1 })
      // Card 2 is never seen before (not in map) -> creates card with dueAt: 0 <= now

      const next = pickNext(cards, [1, 2])
      expect(next).toBe(2)
    })
  })
})
