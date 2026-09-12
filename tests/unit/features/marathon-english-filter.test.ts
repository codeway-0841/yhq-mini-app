import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTestSession } from '../../../src/features/test/hooks/useTestSession'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import type { Question } from '../../../src/shared/api'

describe('useTestSession — English marathon filtering', () => {
  beforeEach(() => {
    useTestSessionStore.getState().clear()
    useQuestionsStore.setState({
      topics: [
        { id: 101, nameUz: '[Pre-A1] Ilk sozlar', nameRu: '[Pre-A1] Ilk sozlar', slug: 'english_db-ing_kids_m1' },
        { id: 102, nameUz: '[A1] To be', nameRu: '[A1] To be', slug: 'english_db-ing_a1_m1' },
        { id: 103, nameUz: '[B1] Present Perfect', nameRu: '[B1] Present Perfect', slug: 'english_db-ing_b1_m1' },
      ],
      loaded: true,
      loading: false,
    })
  })

  const mockQuestions: Question[] = [
    { id: 1, text: '🍎 is an apple', image: null, options: [{ id: 'A1', text: 'apple' }], topicId: 101 },
    { id: 2, text: '🐶 is a dog', image: null, options: [{ id: 'A1', text: 'dog' }], topicId: 101 },
    { id: 3, text: 'I ___ a student', image: null, options: [{ id: 'A1', text: 'am' }], topicId: 102 },
    { id: 4, text: 'They ___ playing', image: null, options: [{ id: 'A1', text: 'are' }], topicId: 102 },
    { id: 5, text: 'She has ___ London', image: null, options: [{ id: 'A1', text: 'visited' }], topicId: 103 },
  ]

  it('marafonda Pre-A1 (kids) savollari kirmaydi — faqat A1..C1 savollari chiqadi', () => {
    const { result } = renderHook(() =>
      useTestSession({
        mode: 'marathon',
        questions: mockQuestions,
        subjectId: 'ingliz',
        locationKey: 'loc-1',
      })
    )

    const active = result.current.activeQuestions
    expect(active).toHaveLength(3)
    // Pre-A1 bo'lgan 1 va 2-savollar chiqarib tashlangan bo'lishi kerak
    expect(active.some((q) => q.id === 1)).toBe(false)
    expect(active.some((q) => q.id === 2)).toBe(false)
    // A1 va B1 savollari mavjud
    expect(active.some((q) => q.id === 3)).toBe(true)
    expect(active.some((q) => q.id === 4)).toBe(true)
    expect(active.some((q) => q.id === 5)).toBe(true)
  })

  it('boshqa fanlarda (masalan fizika) bu filtr qullanilmaydi', () => {
    const { result } = renderHook(() =>
      useTestSession({
        mode: 'marathon',
        questions: mockQuestions,
        subjectId: 'fizika',
        locationKey: 'loc-2',
      })
    )

    const active = result.current.activeQuestions
    expect(active).toHaveLength(5)
  })

  it('bilet/mavzu tanlanganda (questionIds mavjud bo\'lsa) Pre-A1 savollari ishlaydi', () => {
    const { result } = renderHook(() =>
      useTestSession({
        mode: 'ticket',
        questionIds: [1, 2],
        questions: mockQuestions,
        subjectId: 'ingliz',
        locationKey: 'loc-3',
      })
    )

    const active = result.current.activeQuestions
    expect(active).toHaveLength(2)
    expect(active[0].id).toBe(1)
    expect(active[1].id).toBe(2)
  })
})
