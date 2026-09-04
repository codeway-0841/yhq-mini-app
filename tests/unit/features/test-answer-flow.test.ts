import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTestAnswerFlow } from '../../../src/features/test/hooks/useTestAnswerFlow'
import * as outbox from '../../../src/shared/lib/outbox'
import type { Question, ApiSettings } from '../../../src/shared/api'

const Q = (id: number) =>
  ({
    id,
    text: `Savol ${id}`,
    options: [{ id: 'opt-A', text: 'Opt A' }, { id: 'opt-B', text: 'Opt B' }],
  }) as unknown as Question

describe('useTestAnswerFlow (Production Hook Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels an already scheduled auto-next when the explanation opens', async () => {
    const goTo = vi.fn()
    const { result, rerender } = renderHook(({ paused }) => useTestAnswerFlow({
      activeQuestions: [Q(101), Q(102)], current: 0,
      settings: { autoNextCorrect: true } as ApiSettings,
      submitAnswer: vi.fn().mockResolvedValue({ correct: true, correctAnswer: 'opt-A' }),
      answerTimer: { elapsed: () => 100 }, goTo, onToast: vi.fn(), pauseAutoNext: paused,
    }), { initialProps: { paused: false } })
    await act(async () => result.current.handleSelect('opt-A'))
    rerender({ paused: true })
    act(() => vi.advanceTimersByTime(2000))
    expect(goTo).not.toHaveBeenCalled()
    rerender({ paused: false })
    act(() => vi.advanceTimersByTime(2000))
    expect(goTo).not.toHaveBeenCalled()
  })

  it.each([true, false])('does not schedule late %s online/offline answers while a panel is open', async (online) => {
    const goTo = vi.fn()
    let resolve!: (value: any) => void
    const submitAnswer = vi.fn(() => new Promise<any>((done) => { resolve = done }))
    const { result, rerender } = renderHook(({ paused }) => useTestAnswerFlow({
      activeQuestions: [Q(101), Q(102)], current: 0,
      settings: { autoNextCorrect: true } as ApiSettings,
      submitAnswer, answerTimer: { elapsed: () => 100 }, goTo, onToast: vi.fn(), pauseAutoNext: paused,
    }), { initialProps: { paused: false } })
    act(() => result.current.handleSelect('opt-A'))
    rerender({ paused: true })
    await act(async () => resolve(online ? { correct: true, correctAnswer: 'opt-A' } : null))
    act(() => vi.advanceTimersByTime(2000))
    expect(goTo).not.toHaveBeenCalled()
    expect(result.current.answers[0]).toBe(online ? 'correct' : 'pending')
  })

  it('handles correct answer and triggers 800ms auto-next when enabled', async () => {
    const activeQuestions = [Q(101), Q(102)]
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctAnswer: 'opt-A',
      duplicate: false,
      coinsEarned: 1,
    })
    const goTo = vi.fn()
    const onToast = vi.fn()

    const { result } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current: 0,
        settings: { autoNextCorrect: true, autoNextWrong: false } as ApiSettings,
        submitAnswer: mockSubmit,
        answerTimer: { elapsed: () => 1500 },
        goTo,
        onToast,
      })
    )

    await act(async () => {
      result.current.handleSelect('opt-A')
    })

    expect(result.current.answers[0]).toBe('correct')
    expect(result.current.correctOpts[0]).toBe('opt-A')
    expect(result.current.selectedHistory[0]).toBe('opt-A')
    expect(result.current.coinPop).toBe(1)

    // 800ms timer o'tguncha goTo chaqirilmaydi
    expect(goTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(800)
    })

    expect(goTo).toHaveBeenCalledWith(1)
  })

  it('handles wrong answer and triggers 1200ms auto-next when enabled', async () => {
    const activeQuestions = [Q(101), Q(102)]
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctAnswer: 'opt-B',
      duplicate: false,
      coinsEarned: 0,
    })
    const goTo = vi.fn()
    const onToast = vi.fn()

    const { result } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current: 0,
        settings: { autoNextCorrect: false, autoNextWrong: true } as ApiSettings,
        submitAnswer: mockSubmit,
        answerTimer: { elapsed: () => 1500 },
        goTo,
        onToast,
      })
    )

    await act(async () => {
      result.current.handleSelect('opt-A')
    })

    expect(result.current.answers[0]).toBe('wrong')
    expect(result.current.correctOpts[0]).toBe('opt-B')
    expect(result.current.selectedHistory[0]).toBe('opt-A')

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(goTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(400) // jami 1200ms
    })
    expect(goTo).toHaveBeenCalledWith(1)
  })

  it('cancels auto-next timer on unmount or question change', async () => {
    const activeQuestions = [Q(101), Q(102)]
    const mockSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctAnswer: 'opt-A',
      duplicate: false,
      coinsEarned: 0,
    })
    const goTo = vi.fn()
    const onToast = vi.fn()

    let current = 0
    const { result, rerender, unmount } = renderHook(
      (props: { current: number }) =>
        useTestAnswerFlow({
          activeQuestions,
          current: props.current,
          settings: { autoNextCorrect: true } as ApiSettings,
          submitAnswer: mockSubmit,
          answerTimer: { elapsed: () => 1500 },
          goTo,
          onToast,
        }),
      { initialProps: { current: 0 } }
    )

    await act(async () => {
      result.current.handleSelect('opt-A')
    })

    // Question changed before 800ms
    act(() => {
      vi.advanceTimersByTime(400)
    })
    rerender({ current: 1 })

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // Auto-next cancelled, goTo chaqirilmaydi
    expect(goTo).not.toHaveBeenCalled()

    // Test unmount cleanup
    unmount()
  })

  it('rolls back selection on fatal 4xx error', async () => {
    const activeQuestions = [Q(101)]
    const mockSubmit = vi.fn().mockResolvedValue({ fatal: true, code: 'invalid_param' })
    const onToast = vi.fn()

    const { result } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current: 0,
        submitAnswer: mockSubmit,
        answerTimer: { elapsed: () => 1500 },
        goTo: vi.fn(),
        onToast,
      })
    )

    await act(async () => {
      result.current.handleSelect('opt-A')
    })

    expect(result.current.selectedHistory[0]).toBeNull()
    expect(onToast).toHaveBeenCalledWith('submitFailed')
  })

  it('sets pending state on offline failure', async () => {
    const activeQuestions = [Q(101)]
    const mockSubmit = vi.fn().mockResolvedValue(null)
    const onToast = vi.fn()

    const { result } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current: 0,
        submitAnswer: mockSubmit,
        answerTimer: { elapsed: () => 1500 },
        goTo: vi.fn(),
        onToast,
      })
    )

    await act(async () => {
      result.current.handleSelect('opt-A')
    })

    expect(result.current.answers[0]).toBe('pending')
    expect(onToast).toHaveBeenCalledWith('offlineQueued')
  })

  it('resolves pending answer when outbox result sync fires', async () => {
    const activeQuestions = [Q(101)]
    let syncListener: ((info: any) => void) | null = null
    vi.spyOn(outbox, 'onResultSync').mockImplementation((cb) => {
      syncListener = cb
      return () => { syncListener = null }
    })

    const { result } = renderHook(() =>
      useTestAnswerFlow({
        activeQuestions,
        current: 0,
        submitAnswer: vi.fn(),
        answerTimer: { elapsed: () => 1500 },
        goTo: vi.fn(),
        onToast: vi.fn(),
      })
    )

    expect(syncListener).not.toBeNull()

    // Simulate result arriving via outbox
    act(() => {
      syncListener!({
        questionId: 101,
        correct: true,
        correctAnswer: 'opt-B',
        duplicate: false,
      })
    })

    expect(result.current.answers[0]).toBe('correct')
    expect(result.current.correctOpts[0]).toBe('opt-B')
  })
})
