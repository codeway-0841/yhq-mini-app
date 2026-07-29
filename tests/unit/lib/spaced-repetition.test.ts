/**
 * Unit tests for SM-2 spaced repetition algorithm.
 * Run with: npx vitest tests/unit/lib/spaced-repetition.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  createCard, updateCard, pickNext,
} from '../../../src/lib/spaced-repetition'

describe('createCard', () => {
  it('creates a card with default EF 2.5 and dueAt 0', () => {
    const card = createCard(42)
    expect(card.questionId).toBe(42)
    expect(card.ef).toBe(2.5)
    expect(card.dueAt).toBe(0)
    expect(card.reps).toBe(0)
  })
})

describe('updateCard — wrong answer', () => {
  it('decreases EF, resets reps, re-queues in ~60s', () => {
    const before = Date.now()
    const card = updateCard(createCard(1), 0)
    expect(card.reps).toBe(0)
    expect(card.ef).toBeLessThan(2.5)
    expect(card.interval).toBe(1)
    expect(card.dueAt).toBeGreaterThanOrEqual(before + 55_000)
    expect(card.dueAt).toBeLessThanOrEqual(before + 65_000)
  })
})

describe('updateCard — correct answer streak', () => {
  it('follows SM-2 interval schedule: 1d → 6d → EF-scaled', () => {
    let card = createCard(1)
    card = updateCard(card, 1)  // rep 1 → interval 1
    expect(card.reps).toBe(1)
    expect(card.interval).toBe(1)

    card = updateCard(card, 1)  // rep 2 → interval 6
    expect(card.reps).toBe(2)
    expect(card.interval).toBe(6)

    card = updateCard(card, 1)  // rep 3 → interval 6 × EF
    expect(card.reps).toBe(3)
    expect(card.interval).toBeGreaterThan(6)
  })

  it('EF never drops below 1.3', () => {
    let card = createCard(1)
    for (let i = 0; i < 20; i++) card = updateCard(card, 0)
    expect(card.ef).toBeGreaterThanOrEqual(1.3)
  })

  it('EF never exceeds 2.5', () => {
    let card = createCard(1)
    for (let i = 0; i < 20; i++) card = updateCard(card, 1)
    expect(card.ef).toBeLessThanOrEqual(2.5)
  })
})

describe('pickNext', () => {
  it('returns undefined for empty id list', () => {
    expect(pickNext(new Map(), [])).toBeUndefined()
  })

  it('returns undefined when only candidate is excluded', () => {
    expect(pickNext(new Map(), [1], 1)).toBeUndefined()
  })

  it('prefers overdue cards (lowest dueAt)', () => {
    const cards = new Map([
      [1, { ...createCard(1), dueAt: Date.now() - 10_000 }],
      [2, { ...createCard(2), dueAt: Date.now() - 5_000  }],
      [3, { ...createCard(3), dueAt: Date.now() + 99_999 }],
    ])
    expect(pickNext(cards, [1, 2, 3])).toBe(1)
  })

  it('falls back to lowest EF when nothing is overdue', () => {
    const future = Date.now() + 999_999
    const cards = new Map([
      [1, { ...createCard(1), ef: 2.4, dueAt: future }],
      [2, { ...createCard(2), ef: 1.4, dueAt: future }],
    ])
    expect(pickNext(cards, [1, 2])).toBe(2)
  })

  it('does not mutate the cards Map', () => {
    const cards = new Map<number, ReturnType<typeof createCard>>()
    pickNext(cards, [1, 2, 3])
    expect(cards.size).toBe(0)
  })
})
