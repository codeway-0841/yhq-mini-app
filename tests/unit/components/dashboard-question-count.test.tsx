import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useDashboardQuestionCount,
  useLearningSummary,
} from '../../../src/features/dashboard/hooks/useDashboardData'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { api, type Question } from '../../../src/shared/api'

const questions = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1 }) as Question)

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.setItem('yhq-qcount', JSON.stringify({ yhq: 100, rustili: 40 }))
  useQuestionsStore.setState({ subjectId: 'yhq', loaded: true, questions: questions(100), error: null })
})

describe('dashboard learning summary', () => {
  it('uses a conservative local value, then replaces it with the current subject server aggregate', async () => {
    vi.spyOn(api, 'getLearningSummary').mockResolvedValue({
      subjectId: 'yhq', answered: 35, mastered: 30,
      unresolvedMistakes: 5, dueNow: 8,
    })
    const { result } = renderHook(() => useLearningSummary({
      userId: 'learner', subjectId: 'yhq', totalQuestions: 100,
      answered: 20, unresolvedMistakes: 4,
    }))

    expect(result.current.readinessPercent).toBe(16)
    await waitFor(() => expect(result.current.readinessPercent).toBe(30))
    expect(result.current.dueNow).toBe(8)
  })

  it('keeps the local fallback when the summary request fails', async () => {
    vi.spyOn(api, 'getLearningSummary').mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useLearningSummary({
      userId: 'learner', subjectId: 'rustili', totalQuestions: 50,
      answered: 12, unresolvedMistakes: 2,
    }))
    await waitFor(() => expect(api.getLearningSummary).toHaveBeenCalledWith('rustili'))
    expect(result.current).toMatchObject({ mastered: 10, readinessPercent: 20, dueNow: 0 })
  })
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
