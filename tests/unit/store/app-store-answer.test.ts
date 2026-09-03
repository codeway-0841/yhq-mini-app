import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { api, ApiError } from '../../../src/shared/api'
import * as outbox from '../../../src/shared/lib/outbox'

describe('useAppStore.submitAnswer (Characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      user: { id: '123456789', firstName: 'Test', tariff: 'free' } as any,
      totalCorrect: 0,
      totalWrong: 0,
      totalAnswered: 0,
      streak: 0,
      coins: 10,
      xp: 100,
      wrongByTicket: {},
      solvedQuestions: [],
    })
  })

  it('updates store state correctly on successful answer submission', async () => {
    vi.spyOn(api, 'postResult').mockResolvedValue({
      correct: true,
      correctAnswer: 'A',
      duplicate: false,
      dailyStreak: 3,
      coinsEarned: 1,
      coinBalance: 11,
      xp: 110,
    } as any)

    const res = await useAppStore.getState().submitAnswer(101, 'A', 5000)

    expect(api.postResult).toHaveBeenCalledWith(
      '123456789',
      expect.objectContaining({
        questionId: 101,
        selectedAnswer: 'A',
        elapsedMs: 5000,
        clientToken: expect.any(String),
      })
    )

    expect(res).toEqual({
      correct: true,
      correctAnswer: 'A',
      duplicate: false,
      coinsEarned: 1,
    })

    const state = useAppStore.getState()
    expect(state.totalCorrect).toBe(1)
    expect(state.totalAnswered).toBe(1)
    expect(state.streak).toBe(1)
    expect(state.coins).toBe(11)
    expect(state.xp).toBe(110)
  })

  it('falls back to offline outbox on network error and returns null', async () => {
    vi.spyOn(api, 'postResult').mockRejectedValue(new Error('Network error / offline'))
    const enqueueSpy = vi.spyOn(outbox, 'enqueueOutbox').mockReturnValue({} as any)

    const res = await useAppStore.getState().submitAnswer(102, 'B')

    expect(res).toBeNull()
    expect(enqueueSpy).toHaveBeenCalledWith(
      '123456789',
      'result',
      expect.objectContaining({
        questionId: 102,
        selectedAnswer: 'B',
        clientToken: expect.any(String),
      })
    )
  })

  it('returns fatal result without enqueueing to outbox on non-retryable 4xx ApiError', async () => {
    const fatalErr = new ApiError(400, 'Bad Request', 'invalid_answer', false)
    vi.spyOn(api, 'postResult').mockRejectedValue(fatalErr)
    const enqueueSpy = vi.spyOn(outbox, 'enqueueOutbox')

    const res = await useAppStore.getState().submitAnswer(103, 'C')

    expect(res).toEqual({ fatal: true, code: 'invalid_answer' })
    expect(enqueueSpy).not.toHaveBeenCalled()
  })
})
