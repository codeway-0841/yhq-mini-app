import { describe, it, expect } from 'vitest'
import { makeSessionKey, isResumable, clampIndex, remainingSeconds, type TestSessionSnapshot } from '../../../src/shared/lib/test-session'

describe('test-session utils', () => {
  describe('makeSessionKey', () => {
    it('generates mode:X when mode provided', () => {
      expect(makeSessionKey('exam', [1, 2, 3])).toBe('mode:exam')
      expect(makeSessionKey('mock', undefined)).toBe('mode:mock')
    })

    it('generates ids:X when only questionIds provided', () => {
      expect(makeSessionKey(null, [1, 2, 3])).toBe('ids:1,2,3')
      expect(makeSessionKey(null, [10])).toBe('ids:10')
    })

    it('returns "all" when neither mode nor questionIds', () => {
      expect(makeSessionKey(null, undefined)).toBe('all')
      expect(makeSessionKey(null, [])).toBe('all')
    })
  })

  describe('isResumable', () => {
    const validSnapshot: TestSessionSnapshot = {
      key: 'mode:exam',
      subjectId: 'math',
      mode: 'exam',
      title: 'Test',
      questionIds: [1, 2, 3],
      current: 0,
      answers: [null, null, null],
      selected: [null, null, null],
      startedAt: Date.now(),
      finished: false,
    }

    it('returns true when all conditions match', () => {
      expect(isResumable(validSnapshot, 'mode:exam', 'math')).toBe(true)
    })

    it('returns false when session is null', () => {
      expect(isResumable(null, 'mode:exam', 'math')).toBe(false)
    })

    it('returns false when session is undefined', () => {
      expect(isResumable(undefined, 'mode:exam', 'math')).toBe(false)
    })

    it('returns false when session is finished', () => {
      const finished = { ...validSnapshot, finished: true }
      expect(isResumable(finished, 'mode:exam', 'math')).toBe(false)
    })

    it('returns false when key mismatch', () => {
      expect(isResumable(validSnapshot, 'mode:mock', 'math')).toBe(false)
    })

    it('returns false when subjectId mismatch', () => {
      expect(isResumable(validSnapshot, 'mode:exam', 'physics')).toBe(false)
    })

    it('allows resume when key and subjectId match', () => {
      expect(isResumable(validSnapshot, 'mode:exam', 'math')).toBe(true)
    })
  })

  describe('clampIndex', () => {
    it('clamps negative index to 0', () => {
      expect(clampIndex(-1, 10)).toBe(0)
      expect(clampIndex(-100, 5)).toBe(0)
    })

    it('clamps index >= length to length-1', () => {
      expect(clampIndex(10, 5)).toBe(4)
      expect(clampIndex(100, 10)).toBe(9)
    })

    it('returns index when within bounds', () => {
      expect(clampIndex(0, 10)).toBe(0)
      expect(clampIndex(5, 10)).toBe(5)
      expect(clampIndex(9, 10)).toBe(9)
    })

    it('handles edge case of length=1', () => {
      expect(clampIndex(0, 1)).toBe(0)
      expect(clampIndex(5, 1)).toBe(0)
      expect(clampIndex(-1, 1)).toBe(0)
    })

    it('handles empty array (length=0)', () => {
      expect(clampIndex(0, 0)).toBe(0)
      expect(clampIndex(5, 0)).toBe(0)
    })
  })

  describe('remainingSeconds', () => {
    it('calculates remaining time correctly', () => {
      const startedAt = 1000_000_000
      const totalSeconds = 60 // 60s exam
      const nowMs = startedAt + 30_000 // 30s elapsed

      expect(remainingSeconds(startedAt, totalSeconds, nowMs)).toBe(30)
    })

    it('returns 0 when time expired', () => {
      const startedAt = 1000_000_000
      const totalSeconds = 60 // 60s exam
      const nowMs = startedAt + 90_000 // 90s elapsed

      expect(remainingSeconds(startedAt, totalSeconds, nowMs)).toBe(0)
    })

    it('returns full time when just started', () => {
      const startedAt = 1000_000_000
      const totalSeconds = 120
      const nowMs = startedAt + 100 // 0.1s elapsed

      expect(remainingSeconds(startedAt, totalSeconds, nowMs)).toBe(120)
    })

    it('handles exact expiration', () => {
      const startedAt = 1000_000_000
      const totalSeconds = 60
      const nowMs = startedAt + 60_000 // exactly 60s

      expect(remainingSeconds(startedAt, totalSeconds, nowMs)).toBe(0)
    })

    it('never returns negative', () => {
      const startedAt = 1000_000_000
      const totalSeconds = 60
      const nowMs = startedAt + 300_000 // 5 min elapsed

      expect(remainingSeconds(startedAt, totalSeconds, nowMs)).toBe(0)
    })
  })

  describe('allAnswered logic (Yakunlash tugmasi miltillashi regression himoyasi)', () => {
    const isAllAnswered = (answers: (string | null)[], totalCount: number) =>
      answers.length > 0 &&
      answers.length === totalCount &&
      answers.every((a) => a !== null && a !== 'unanswered')

    it('boshlang\'ich bo\'sh answers massivida false qaytaradi (Yakunlash chiqib ketmaydi)', () => {
      expect(isAllAnswered([], 20)).toBe(false)
    })

    it('null yoki unanswered elementlar bo\'lganda false qaytaradi', () => {
      expect(isAllAnswered([null, null, null], 3)).toBe(false)
      expect(isAllAnswered(['correct', null, 'wrong'], 3)).toBe(false)
      expect(isAllAnswered(['correct', 'unanswered', 'correct'], 3)).toBe(false)
    })

    it('uzunlik savollar soniga teng bo\'lmaganda false qaytaradi', () => {
      expect(isAllAnswered(['correct', 'wrong'], 3)).toBe(false)
    })

    it('barcha savollarga to\'liq javob berilganda true qaytaradi', () => {
      expect(isAllAnswered(['correct', 'wrong', 'correct'], 3)).toBe(true)
    })
  })
})
