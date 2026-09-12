import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpeedPage from '../../../src/features/speed/SpeedPage'
import { api } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'

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

const deliveredQuestion = {
  position: 0,
  deliveryToken: 'v1.delivery-token',
  expiresAt: '2026-09-12T10:00:00.000Z',
  text: 'Speed savoli',
  media: null,
  topic: { id: 1 },
  options: [
    { id: 'a', text: 'Birinchi variant' },
    { id: 'b', text: 'Ikkinchi variant' },
  ],
}

describe('SpeedPage server-authoritative delivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'warmUp').mockImplementation(() => {})
    vi.spyOn(api, 'finishTestSession').mockResolvedValue({
      session: {
        id: 'speed-session',
        subjectId: 'yhq',
        mode: 'random',
        status: 'completed',
        answered: 1,
        total: 1,
        expiresAt: '2026-09-12T10:00:00.000Z',
      },
    })
    vi.spyOn(api, 'createTestSession').mockResolvedValue({
      session: {
        id: 'speed-session',
        subjectId: 'yhq',
        mode: 'random',
        status: 'active',
        answered: 0,
        total: 1,
        expiresAt: '2026-09-12T10:00:00.000Z',
      },
      questions: [deliveredQuestion],
      review: [],
    })
    vi.spyOn(api, 'submitTestSessionAnswer').mockResolvedValue({
      attempt: {
        position: 0,
        correct: true,
        correctOptionId: 'a',
        duplicate: false,
        dailyStreak: 1,
        xp: 12,
        xpEarned: 12,
        coinsEarned: 2,
        coinBalance: 7,
        coinSaved: false,
      },
      append: [],
      session: {
        id: 'speed-session',
        subjectId: 'yhq',
        mode: 'random',
        status: 'completed',
        answered: 1,
        total: 1,
        expiresAt: '2026-09-12T10:00:00.000Z',
      },
    })
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        language: 'uz',
        shuffleOptions: false,
      },
      applySessionAnswerMutation: vi.fn(),
    })
  })

  it('creates a server session and submits by delivery token without loading the full bank', async () => {
    render(<MemoryRouter><SpeedPage /></MemoryRouter>)

    const firstOption = await screen.findByRole('button', { name: 'A Birinchi variant' })
    fireEvent.click(firstOption)

    expect(api.createTestSession).toHaveBeenCalledWith({
      subjectId: 'yhq',
      selector: { type: 'random', count: 20 },
      language: 'uz',
    })
    expect(api.submitTestSessionAnswer).toHaveBeenCalledWith('speed-session', expect.objectContaining({
      position: 0,
      deliveryToken: 'v1.delivery-token',
      expiresAt: '2026-09-12T10:00:00.000Z',
      selectedOptionId: 'a',
    }))
    await waitFor(() => expect(screen.getByTestId('speed-results')).toBeTruthy())
    const payload = JSON.parse(screen.getByTestId('speed-results').textContent!)
    expect(payload.results).toEqual([{ questionId: 1, status: 'correct' }])
    expect(payload.earnedXp).toBe(12)
    expect(payload.earnedCoins).toBe(2)
  })

  it('shows a safe empty state if the server session has no deliverable question', async () => {
    vi.mocked(api.createTestSession).mockResolvedValueOnce({
      session: {
        id: 'empty-speed-session',
        subjectId: 'yhq',
        mode: 'random',
        status: 'active',
        answered: 0,
        total: 0,
        expiresAt: '2026-09-12T10:00:00.000Z',
      },
      questions: [],
      review: [],
    })

    render(<MemoryRouter><SpeedPage /></MemoryRouter>)
    expect(await screen.findByText('Savollar hali yuklanmagan yoki mavjud emas')).toBeTruthy()
    expect(screen.getByText('Tezkor test')).toBeTruthy()
  })
})
