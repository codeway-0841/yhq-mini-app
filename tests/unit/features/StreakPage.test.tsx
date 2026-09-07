import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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

import StreakPage from '../../../src/features/streak/StreakPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'

beforeEach(() => {
  mockNavigate.mockReset()
  mockHistory.mockReset().mockResolvedValue({
    rows: [
      { date: '2026-09-01', answered: 10, correct: 9, fixed: 1 },
      { date: '2026-09-02', answered: 20, correct: 18, fixed: 2 },
    ],
    dailyStreak: 5,
    bestStreak: 12,
  })
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    user: { id: 'test_123', firstName: 'Ali' } as any,
    tariff: 'free',
  })
  useDailyStore.setState({
    streaks: { yhq: 5 },
  })
})

describe('StreakPage', () => {
  it('renders streak hero, stats, and calendar card with compact layout and proper padding', async () => {
    render(<StreakPage />)

    expect(screen.getByText('5')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockHistory).toHaveBeenCalled()
    })

    // Find calendar card by month name/header
    const calendarCard = screen.getByRole('button', { name: /oldingi oy|предыдущий месяц/i }).closest('.bg-pcard')
    expect(calendarCard).toBeInTheDocument()
    expect(calendarCard).toHaveClass('p-4')
    expect(calendarCard).toHaveClass('sm:p-5')
    expect(calendarCard?.className).not.toContain('p-4.5')

    const compactWrapper = calendarCard?.querySelector('[class*="max-w-[300px]"]')
    expect(compactWrapper).toBeInTheDocument()
  })

  it('opens "Qanday ishlaydi?" sheet with swipeToDismiss enabled', async () => {
    render(<StreakPage />)

    const infoBtns = screen.getAllByRole('button', { name: /Qanday ishlaydi/i })
    fireEvent.click(infoBtns[0])

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Qanday ishlaydi/i })).toBeInTheDocument()

    expect(dialog.querySelector('[data-drag-handle]')).toBeInTheDocument()
  })
})
