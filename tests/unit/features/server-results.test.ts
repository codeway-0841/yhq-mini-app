import { describe, expect, it } from 'vitest'
import type { DeliveredTestQuestion } from '../../../shared/test-session'
import type { ServerTestSnapshot } from '../../../src/shared/store/useServerTestSessionStore'
import {
  buildV2Results,
  buildV2ReviewItems,
  toReviewQuestion,
  v2Threshold,
} from '../../../src/features/test/server-results'

/**
 * V2 natija/review adapterlari (server-results.ts) — legacy TestPage pariteti.
 * Himoya invarianti: master question ID client'ga chiqmaydi; review'dagi `id`
 * faqat React key + dars-link lookup uchun va lessonMap bilan to'qnashmasligi
 * shart (aks holda review'da NOTO'G'RI dars linki chiqardi).
 */
function q(position: number, overrides: Partial<DeliveredTestQuestion> = {}): DeliveredTestQuestion {
  return {
    position,
    deliveryToken: `tok-${position}`,
    expiresAt: '2026-09-08T12:00:00.000Z',
    text: `Savol ${position + 1}`,
    options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
    media: null,
    topic: { id: 5 },
    ...overrides,
  }
}

function snap(): ServerTestSnapshot {
  return {
    sessionId: '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa',
    subjectId: 'yhq',
    mode: 'random20',
    selectorKey: '{"type":"random","count":20}',
    total: 3,
    expiresAt: '2026-09-08T12:00:00.000Z',
    current: 0,
    questions: [q(0), q(1), q(2, { media: 'img/1.webp', topic: null })],
    answers: ['correct', 'wrong', null],
    selected: ['F1', 'F2', null],
    correctOptions: ['F1', 'F1', null],
    pendingTokens: {},
  }
}

describe('server-results — V2 natija/review adapterlari', () => {
  it('toReviewQuestion: matn/variant/rasm 1:1, id MANFIY (lessonMap toqnashuvi yoq)', () => {
    const adapted = toReviewQuestion(q(0, { media: 'img/1.webp' }))
    expect(adapted.text).toBe('Savol 1')
    expect(adapted.image).toBe('img/1.webp')
    expect(adapted.options).toEqual([{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }])
    expect(adapted.topicId).toBe(5)
    expect(adapted.id).toBeLessThan(0)
  })

  it('buildV2Results: correct/wrong/unanswered mapping (position = questionId - 1)', () => {
    expect(buildV2Results(snap())).toEqual([
      { questionId: 1, status: 'correct' },
      { questionId: 2, status: 'incorrect' },
      { questionId: 3, status: 'unanswered' },
    ])
  })

  it('buildV2ReviewItems: position tartibi + tanlangan/togri option + mavzu nomi', () => {
    const items = buildV2ReviewItems(snap(), (topicId) => (topicId === 5 ? 'Mavzu 5' : undefined))
    expect(items.map((i) => i.index)).toEqual([0, 1, 2])
    expect(items[1]).toMatchObject({
      status: 'incorrect',
      selectedOptionId: 'F2',
      correctOptionId: 'F1',
      topicName: 'Mavzu 5',
    })
    expect(items[2]).toMatchObject({ status: 'unanswered', topicName: undefined })
    // Hamma review id manfiy va unikal (lesson-link xavfsiz miss)
    const ids = items.map((i) => i.question.id)
    expect(ids.every((id) => id < 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('v2Threshold: legacy TestPage bilan bir xil (exam 90 / mock 95 / boshqa 80)', () => {
    expect(v2Threshold('exam')).toBe(90)
    expect(v2Threshold('mock')).toBe(95)
    expect(v2Threshold('marathon')).toBe(80)
    expect(v2Threshold('random20')).toBe(80)
    expect(v2Threshold('topic')).toBe(80)
  })
})
