import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useCallback, useRef } from 'react'
import type { SubmitResult } from '../../../src/shared/store/useAppStore'

// Characterization for answer submission flow logic
function useAnswerFlowLogic(
  submitAnswerMock: (qid: number, optId: string, elapsed?: number) => Promise<SubmitResult>,
  autoNextCorrect = true,
  autoNextWrong = false
) {
  const [answers, setAnswers] = useState<(string | null)[]>([null, null])
  const [selectedHistory, setSelectedHistory] = useState<(string | null)[]>([null, null])
  const [correctOpts, setCorrectOpts] = useState<(string | null)[]>([null, null])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [coinPop, setCoinPop] = useState(0)
  const correctStreakRef = useRef(0)
  const [nextQuestionTriggered, setNextQuestionTriggered] = useState(false)

  const handleSelect = useCallback(async (currentIdx: number, qid: number, optId: string) => {
    if (selectedHistory[currentIdx] || submitting) return
    setSelectedHistory((prev) => { const n = [...prev]; n[currentIdx] = optId; return n })
    setSubmitting(true)

    const outcome = await submitAnswerMock(qid, optId, 1000)
    setSubmitting(false)

    if (outcome && 'fatal' in outcome) {
      setSelectedHistory((prev) => { const n = [...prev]; n[currentIdx] = null; return n })
      setToast('submitFailed')
      return
    }

    if (!outcome || outcome.correct === null || outcome.correctAnswer === null) {
      setAnswers((prev) => { const n = [...prev]; n[currentIdx] = 'pending'; return n })
      setToast('offlineQueued')
      return
    }

    const isCorrect = outcome.correct
    setAnswers((prev) => { const n = [...prev]; n[currentIdx] = isCorrect ? 'correct' : 'wrong'; return n })
    setCorrectOpts((prev) => { const n = [...prev]; n[currentIdx] = outcome.correctAnswer; return n })

    if (isCorrect) {
      correctStreakRef.current += 1
      if ((outcome.coinsEarned ?? 0) > 0) {
        setCoinPop((c) => c + 1)
      }
      if (autoNextCorrect) setNextQuestionTriggered(true)
    } else {
      correctStreakRef.current = 0
      if (autoNextWrong) setNextQuestionTriggered(true)
    }
  }, [selectedHistory, submitting, submitAnswerMock, autoNextCorrect, autoNextWrong])

  return {
    answers,
    selectedHistory,
    correctOpts,
    submitting,
    toast,
    coinPop,
    correctStreak: correctStreakRef.current,
    nextQuestionTriggered,
    handleSelect,
  }
}

describe('Answer Flow Characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles correct answer and increments combo streak & coin pop', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctAnswer: 'opt-A',
      duplicate: false,
      coinsEarned: 1,
    })

    const { result } = renderHook(() => useAnswerFlowLogic(mockSubmit, true, false))

    await act(async () => {
      await result.current.handleSelect(0, 101, 'opt-A')
    })

    expect(result.current.answers[0]).toBe('correct')
    expect(result.current.correctOpts[0]).toBe('opt-A')
    expect(result.current.selectedHistory[0]).toBe('opt-A')
    expect(result.current.correctStreak).toBe(1)
    expect(result.current.coinPop).toBe(1)
    expect(result.current.nextQuestionTriggered).toBe(true)
  })

  it('handles wrong answer and resets combo streak', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctAnswer: 'opt-B',
      duplicate: false,
      coinsEarned: 0,
    })

    const { result } = renderHook(() => useAnswerFlowLogic(mockSubmit, true, false))

    await act(async () => {
      await result.current.handleSelect(0, 101, 'opt-A')
    })

    expect(result.current.answers[0]).toBe('wrong')
    expect(result.current.correctOpts[0]).toBe('opt-B')
    expect(result.current.selectedHistory[0]).toBe('opt-A')
    expect(result.current.correctStreak).toBe(0)
    expect(result.current.coinPop).toBe(0)
  })

  it('handles offline fallback by setting pending state and toast', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(null)

    const { result } = renderHook(() => useAnswerFlowLogic(mockSubmit))

    await act(async () => {
      await result.current.handleSelect(0, 101, 'opt-A')
    })

    expect(result.current.answers[0]).toBe('pending')
    expect(result.current.toast).toBe('offlineQueued')
  })

  it('handles fatal 4xx by rolling back selection and setting toast', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ fatal: true, code: 'bad_request' })

    const { result } = renderHook(() => useAnswerFlowLogic(mockSubmit))

    await act(async () => {
      await result.current.handleSelect(0, 101, 'opt-A')
    })

    expect(result.current.selectedHistory[0]).toBeNull()
    expect(result.current.toast).toBe('submitFailed')
  })
})
