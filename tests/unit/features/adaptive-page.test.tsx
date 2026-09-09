import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdaptivePage from '../../../src/features/adaptive/AdaptivePage'
import { api } from '../../../src/shared/api'
import { useAdaptiveStore } from '../../../src/shared/store/useAdaptiveStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

const mockQuestion = {
  id: 201,
  text: 'Adaptiv savol matni',
  image: null,
  topicId: 1,
  options: [
    { id: 'a', text: 'Variant A' },
    { id: 'b', text: 'Variant B' },
  ],
}

describe('AdaptivePage (Aqlli takrorlash)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getCardsSummary').mockResolvedValue({
      summary: { total: 10, dueNow: 3, dueNext24h: 2, dueNext7d: 5, avgEf: 2.1 },
    } as any)
    vi.spyOn(api, 'getCards').mockResolvedValue({ cards: {} } as any)

    useSubjectStore.setState({
      subjectId: 'yhq',
      subject: {
        id: 'yhq',
        name: "Yo'l harakati qoidalari",
        icon: vi.fn() as any,
        color: '#10b981',
        available: true,
        examPresets: [],
      },
    })

    useQuestionsStore.setState({
      questions: [mockQuestion],
      topics: [],
      loaded: true,
      loading: false,
      error: null,
      subjectId: 'yhq',
    })

    useAppStore.setState({
      user: { id: 'test_u1', tariff: 'free' } as any,
      tariff: 'free',
      settings: {
        ...useAppStore.getState().settings,
        language: 'uz',
        shuffleOptions: false,
      },
      submitAnswer: vi.fn().mockResolvedValue({ correct: true, correctAnswer: 'a' } as any),
    })

    useAdaptiveStore.setState({
      cardsBySubject: {},
      currentId: 201,
      sessionCount: 0,
    })
  })

  it('savol berilganda sarlavha Aqlli takrorlash va variantlar chiziladi', () => {
    render(<MemoryRouter><AdaptivePage /></MemoryRouter>)
    expect(screen.getByText('Aqlli takrorlash')).toBeTruthy()
    expect(screen.getByText('Adaptiv savol matni')).toBeTruthy()
    expect(screen.getByText('Variant A')).toBeTruthy()
  })

  it('bepul foydalanuvchi 15 ta savol yechgach bepul limit ekrani chiqadi', () => {
    useAdaptiveStore.setState({
      currentId: 201,
      sessionCount: 15,
    })

    render(<MemoryRouter><AdaptivePage /></MemoryRouter>)
    expect(screen.getAllByText('Aqlli takrorlash').length).toBeGreaterThan(0)
    expect(screen.getByText(/Bepul mashg'ulot limiti \(15 ta savol\) yakunlandi/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Obuna bo\'lish' })).toBeTruthy()
  })

  it('premium foydalanuvchi 15 tadan keyin ham to\'xtatilmaydi', () => {
    useAppStore.setState({
      user: { id: 'test_u1', tariff: 'premium' } as any,
      tariff: 'premium',
    })

    useAdaptiveStore.setState({
      currentId: 201,
      sessionCount: 15,
    })

    render(<MemoryRouter><AdaptivePage /></MemoryRouter>)
    expect(screen.getByText('Adaptiv savol matni')).toBeTruthy()
    expect(screen.queryByText(/Bepul mashg'ulot limiti/)).toBeNull()
  })
})
