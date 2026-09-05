import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpeedPage from '../../../src/features/speed/SpeedPage'
import { api } from '../../../src/shared/api'
import type { ResultSyncInfo } from '../../../src/shared/lib/outbox'
import * as outbox from '../../../src/shared/lib/outbox'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'

vi.mock('../../../src/features/test', () => ({
  ResultsModal: ({ results, earnedXp, earnedCoins }: {
    results: Array<{ questionId: number; status: string }>
    earnedXp: number
    earnedCoins: number
  }) => (
    <output data-testid="speed-results">
      {JSON.stringify({ results, earnedXp, earnedCoins })}
    </output>
  ),
}))

const question = {
  id: 101,
  text: 'Speed savoli',
  image: null,
  topicId: 1,
  options: [
    { id: 'a', text: 'Birinchi variant' },
    { id: 'b', text: 'Ikkinchi variant' },
  ],
}

describe('SpeedPage authoritative offline reconciliation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'warmUp').mockImplementation(() => {})
    useQuestionsStore.setState({
      questions: [question],
      topics: [],
      loaded: true,
      loading: false,
      error: null,
      subjectId: 'yhq',
    })
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        language: 'uz',
        shuffleOptions: false,
      },
      submitAnswer: vi.fn().mockResolvedValue(null),
    })
  })

  it('keeps an offline answer pending, then applies the synced result and rewards', async () => {
    vi.useFakeTimers()
    let syncListener: ((info: ResultSyncInfo) => void) | null = null
    vi.spyOn(outbox, 'onResultSync').mockImplementation((listener) => {
      syncListener = listener
      return () => { syncListener = null }
    })

    try {
      render(<MemoryRouter><SpeedPage /></MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: 'A Birinchi variant' }))

      await act(async () => {})
      act(() => { vi.advanceTimersByTime(400) })

      let payload = JSON.parse(screen.getByTestId('speed-results').textContent!)
      expect(payload.results).toEqual([{ questionId: 101, status: 'pending' }])
      expect(payload.earnedXp).toBe(0)
      expect(payload.earnedCoins).toBe(0)

      act(() => {
        syncListener?.({
          date: '2026-09-05',
          subjectId: 'yhq',
          questionId: 101,
          selectedAnswer: 'a',
          correct: true,
          correctAnswer: 'a',
          dailyStreak: 1,
          duplicate: false,
          xpEarned: 12,
          coinsEarned: 2,
        })
      })

      payload = JSON.parse(screen.getByTestId('speed-results').textContent!)
      expect(payload.results).toEqual([{ questionId: 101, status: 'correct' }])
      expect(payload.earnedXp).toBe(12)
      expect(payload.earnedCoins).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
