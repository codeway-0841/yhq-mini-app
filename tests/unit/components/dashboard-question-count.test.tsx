import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDashboardQuestionCount } from '../../../src/features/dashboard/hooks/useDashboardData'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import type { Question } from '../../../src/shared/api'

const questions = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1 }) as Question)

beforeEach(() => {
  localStorage.setItem('yhq-qcount', JSON.stringify({ yhq: 100, rustili: 40 }))
  useQuestionsStore.setState({ subjectId: 'yhq', loaded: true, questions: questions(100), error: null })
})

describe('dashboard question count', () => {
  it('uses the selected subject cache while its bank loads or fails', () => {
    const { result, rerender } = renderHook(({ subject }) => useDashboardQuestionCount(subject), {
      initialProps: { subject: 'yhq' },
    })
    expect(result.current).toBe(100)
    rerender({ subject: 'rustili' })
    expect(result.current).toBe(40)
    act(() => useQuestionsStore.setState({ error: 'Network error', loading: false }))
    expect(result.current).toBe(40)
    act(() => useQuestionsStore.setState({ subjectId: 'rustili', questions: questions(55), loaded: true }))
    expect(result.current).toBe(55)
  })

  it('does not use another subject bank when no selected-subject cache exists', () => {
    const { result } = renderHook(() => useDashboardQuestionCount('unknown'))
    expect(result.current).toBe(0)
  })

  it('keeps a loaded empty bank at zero instead of displaying stale cached count', () => {
    useQuestionsStore.setState({ subjectId: 'rustili', loaded: true, questions: [] })
    const { result } = renderHook(() => useDashboardQuestionCount('rustili'))
    expect(result.current).toBe(0)
  })
})
