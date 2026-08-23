/**
 * Statistika sahifasi — store'dagi counterlardan hosila ko'rsatkichlar
 * (level, aniqlik, seriya), haftalik grafik va zaif mavzular ro'yxati.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockNavigate, mockHistory } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockHistory: vi.fn(),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, getDailyHistory: mockHistory } }
})

import StatistikaPage from '../../../src/features/stats/StatistikaPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import { questionKey } from '../../../shared/subjects'

const today = () => new Date().toLocaleDateString('sv-SE')

beforeEach(() => {
  mockNavigate.mockReset()
  mockHistory.mockReset().mockResolvedValue({ rows: [] })
  useSubjectStore.setState({ subjectId: 'yhq' })
  useQuestionsStore.setState({
    questions: [
      { id: 1, topicId: 10, text: 'a' },
      { id: 2, topicId: 10, text: 'b' },
      { id: 3, topicId: 20, text: 'c' },
    ] as never[],
    topics: [
      { id: 10, nameUz: 'Belgilar', nameRu: 'Знаки' },
      { id: 20, nameUz: 'Chiziqlar', nameRu: 'Разметка' },
    ] as never[],
    loaded: true, loading: false,
  })
  useDailyStore.setState({ streaks: { yhq: 5 } as never })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    user: { id: '12345', firstName: 'Ali' } as never,
    totalCorrect: 120, totalWrong: 30, totalAnswered: 150,
    wrongByTicket: {},
  })
})

describe('StatistikaPage', () => {
  it('level, aniqlik va seriyani counterlardan hisoblaydi', () => {
    render(<StatistikaPage />)

    expect(screen.getByText('3')).toBeInTheDocument()     // level = 120/50 + 1
    expect(screen.getByText('80%')).toBeInTheDocument()   // aniqlik = 120/150
    expect(screen.getByText('5')).toBeInTheDocument()     // kunlik seriya
  })

  it('javob berilmagan holatda aniqlik 0% (nolga bo\'linish yo\'q)', () => {
    useAppStore.setState({ totalCorrect: 0, totalWrong: 0, totalAnswered: 0 })
    render(<StatistikaPage />)

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('haftalik grafik server tarixidan yig\'iladi', async () => {
    mockHistory.mockResolvedValue({
      rows: [{ date: today(), subjectId: 'yhq', answered: 42, correct: 30, fixed: 2 }],
    })
    render(<StatistikaPage />)

    await waitFor(() => expect(mockHistory).toHaveBeenCalledWith('12345', expect.any(String), 'yhq'))
    expect(await screen.findByText(/Hafta · 42 savol/)).toBeInTheDocument()
  })

  it('tarix bo\'sh bo\'lsa hafta 0 savol bilan chiziladi', async () => {
    render(<StatistikaPage />)

    expect(await screen.findByText(/Hafta · 0 savol/)).toBeInTheDocument()
  })

  it('zaif mavzular xatolar asosida ko\'rsatiladi', () => {
    useAppStore.setState({
      wrongByTicket: {
        [questionKey('yhq', 1)]: 3,
        [questionKey('yhq', 2)]: 1,
        [questionKey('yhq', 3)]: 1,
      },
    })
    render(<StatistikaPage />)

    expect(screen.getByText('Belgilar')).toBeInTheDocument()
    expect(screen.getByText('Chiziqlar')).toBeInTheDocument()
  })

  it('mehmon (userId 0) uchun tarix so\'ralmaydi', () => {
    useAppStore.setState({ user: { id: '0', firstName: 'Mehmon' } as never })
    render(<StatistikaPage />)

    expect(mockHistory).not.toHaveBeenCalled()
  })
})
