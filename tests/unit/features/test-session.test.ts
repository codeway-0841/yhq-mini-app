import { describe, it, expect } from 'vitest'
import {
  makeSessionKey,
  isResumable,
  clampIndex,
  remainingSeconds,
  deduplicateQuestions,
  type TestSessionSnapshot,
} from '../../../src/shared/lib/test-session'

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

  describe('deduplicateQuestions', () => {
    it('bitta xil savollarni filtrlab noyoblarini qoldiradi', () => {
      const items = [
        { id: 1, text: 'Kuch formulasi qanday?', options: [{ id: 'A1', text: 'F=ma' }, { id: 'A2', text: 'E=mc^2' }], image: null },
        { id: 2, text: 'Kuch formulasi qanday?', options: [{ id: 'A1', text: 'F=ma' }, { id: 'A2', text: 'E=mc^2' }], image: null },
        { id: 3, text: 'Tezlik formulasi qanday?', options: [{ id: 'A1', text: 'v=s/t' }], image: null },
      ]
      const deduped = deduplicateQuestions(items)
      expect(deduped).toHaveLength(2)
      expect(deduped.map((q) => q.id)).toEqual([1, 3])
    })

    it('bo\'sh joylar farqi bo\'lsa ham bir xil deb hisoblaydi (normalizatsiya)', () => {
      const items = [
        { id: 1, text: "To'g'ri   tasdiqni  ko'rsating.", options: [{ id: 'A1', text: 'A  variant' }], image: null },
        { id: 2, text: "To'g'ri tasdiqni ko'rsating.", options: [{ id: 'A1', text: 'A variant' }], image: null },
      ]
      const deduped = deduplicateQuestions(items)
      expect(deduped).toHaveLength(1)
      expect(deduped[0].id).toBe(1)
    })

    it('matni bir xil lekin rasmi har xil savollarni alohida saqlaydi (chizmalar)', () => {
      const items = [
        { id: 1, text: 'Sxemadagi umumiy qarshilikni toping', options: [{ id: 'A1', text: '10 Om' }], image: 'img1.png' },
        { id: 2, text: 'Sxemadagi umumiy qarshilikni toping', options: [{ id: 'A1', text: '10 Om' }], image: 'img2.png' },
      ]
      const deduped = deduplicateQuestions(items)
      expect(deduped).toHaveLength(2)
    })

    it('matni bir xil lekin variantlari har xil savollarni alohida saqlaydi', () => {
      const items = [
        { id: 1, text: "To'g'ri tasdiqni ko'rsating.", options: [{ id: 'A1', text: '1-qonun' }], image: null },
        { id: 2, text: "To'g'ri tasdiqni ko'rsating.", options: [{ id: 'A1', text: '2-qonun' }], image: null },
      ]
      const deduped = deduplicateQuestions(items)
      expect(deduped).toHaveLength(2)
    })

    it('qator ko\'chirish (\\n) farqlari bo\'lgan dublikatlarni ham bitta savol deb biladi', () => {
      const q1 = {
        id: 101,
        text: 'Yerga nisbatan v_1=4 m/s, v_2=3 m/s tezliklar\nbilan harakatlanayotgan platformalar',
        options: [{ id: 'A1', text: '1 m/s' }, { id: 'A2', text: '7 m/s' }],
        image: null,
      }
      const q2 = {
        id: 102,
        text: 'Yerga nisbatan v_1=4 m/s, v_2=3 m/s tezliklar bilan\nharakatlanayotgan platformalar',
        options: [{ id: 'A1', text: '1 m/s' }, { id: 'A2', text: '7 m/s' }],
        image: null,
      }
      const deduped = deduplicateQuestions([q1, q2])
      expect(deduped).toHaveLength(1)
      expect(deduped[0].id).toBe(101)
    })

    it('variantlar o\'rni almashib kelgan bo\'lsa ham dublikatni ushlaydi', () => {
      const q1 = {
        id: 201,
        text: 'Optik kuch qanday o\'lchanadi?',
        options: [{ id: 'A1', text: 'Dpt' }, { id: 'A2', text: 'm' }],
        image: null,
      }
      const q2 = {
        id: 202,
        text: 'Optik kuch qanday o\'lchanadi?',
        options: [{ id: 'A1', text: 'm' }, { id: 'A2', text: 'Dpt' }],
        image: null,
      }
      const deduped = deduplicateQuestions([q1, q2])
      expect(deduped).toHaveLength(1)
      expect(deduped[0].id).toBe(201)
    })

    it('bo\'sh massiv va bitta elementli massivda to\'g\'ri ishlaydi', () => {
      expect(deduplicateQuestions([])).toEqual([])
      const single = [{ id: 1, text: 'Test', options: [], image: null }]
      expect(deduplicateQuestions(single)).toHaveLength(1)
    })
  })
})
