/**
 * Unit tests for resumable test session helpers (P1: resumable sessions).
 * Run with: npx vitest tests/unit/lib/test-session.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  makeSessionKey, isResumable, remainingSeconds, clampIndex,
  type TestSessionSnapshot,
} from '../../../src/features/test/test-session'

const snap = (over: Partial<TestSessionSnapshot> = {}): TestSessionSnapshot => ({
  key:         'mode:exam',
  subjectId:   'yhq',
  mode:        'exam',
  title:       'Imtihon',
  questionIds: [5, 12, 3, 8],
  current:     2,
  answers:     ['correct', 'wrong', null, null],
  selected:    ['a', 'c', null, null],
  startedAt:   1_000_000,
  finished:    false,
  ...over,
})

describe('makeSessionKey', () => {
  it('mode mavjud bo\'lsa mode kalitini qaytaradi', () => {
    expect(makeSessionKey('exam', undefined)).toBe('mode:exam')
    expect(makeSessionKey('exam', [1, 2])).toBe('mode:exam') // mode ustuvor
  })
  it('mode yo\'q bo\'lsa savol id\'laridan kalit hosil qiladi', () => {
    expect(makeSessionKey(null, [4, 7, 9])).toBe('ids:4,7,9')
  })
  it('hech narsa yo\'q bo\'lsa umumiy kalit', () => {
    expect(makeSessionKey(null, undefined)).toBe('all')
    expect(makeSessionKey(null, [])).toBe('all')
  })
})

describe('isResumable', () => {
  it('kalit va fan mos, tugatilmagan → true', () => {
    expect(isResumable(snap(), 'mode:exam', 'yhq')).toBe(true)
  })
  it('sessiya yo\'q → false', () => {
    expect(isResumable(null, 'mode:exam', 'yhq')).toBe(false)
    expect(isResumable(undefined, 'mode:exam', 'yhq')).toBe(false)
  })
  it('tugatilgan sessiya → false (yangi urinish kerak)', () => {
    expect(isResumable(snap({ finished: true }), 'mode:exam', 'yhq')).toBe(false)
  })
  it('boshqa mode → false', () => {
    expect(isResumable(snap(), 'mode:mock', 'yhq')).toBe(false)
  })
  it('boshqa fan → false (savol id\'lari boshqa bankdan)', () => {
    expect(isResumable(snap(), 'mode:exam', 'physics')).toBe(false)
  })
})

describe('remainingSeconds (wall-clock timer)', () => {
  it('o\'tgan vaqt ayiriladi', () => {
    const now = 1_000_000 + 60_000 // 60s o'tdi
    expect(remainingSeconds(1_000_000, 30 * 60, now)).toBe(30 * 60 - 60)
  })
  it('vaqt tugagan → 0 (musbat emas)', () => {
    const now = 1_000_000 + 60 * 60 * 1000 // 1 soat o'tdi
    expect(remainingSeconds(1_000_000, 30 * 60, now)).toBe(0)
  })
  it('hali yangi → to\'liq qiymat', () => {
    expect(remainingSeconds(1_000_000, 30 * 60, 1_000_000)).toBe(30 * 60)
  })
})

describe('clampIndex', () => {
  it('chegarada qoladi', () => {
    expect(clampIndex(2, 4)).toBe(2)
    expect(clampIndex(-1, 4)).toBe(0)
    expect(clampIndex(10, 4)).toBe(3)
    expect(clampIndex(0, 0)).toBe(0)
  })
})
