import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DarslikTopPills } from '../../../src/features/lessons/DarslikTopPills'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { doneKeyOf, todayStr, useDailyStore } from '../../../src/shared/store/useDailyStore'

beforeEach(() => {
  useAppStore.setState({
    tariff: 'free',
    settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: true },
  })
  useDailyStore.setState({
    streaks: { yhq: 5 },
    charges: { yhq: 1 },
    activityKey: null,
  })
})

function renderPills(completedCount = 3) {
  return render(
    <MemoryRouter initialEntries={['/darslik']}>
      <Routes>
        <Route
          path="/darslik"
          element={<DarslikTopPills subjectId="yhq" completedCount={completedCount} />}
        />
        <Route path="/premium" element={<div data-testid="premium-route" />} />
        <Route path="/reyting" element={<div data-testid="reyting-route" />} />
        <Route path="/streak" element={<div data-testid="streak-route" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DarslikTopPills', () => {
  it('shows key count, streak number, and switches lightning state when today is extended', () => {
    const view = renderPills(4)
    expect(screen.getByTestId('brilliant-keys-pill')).toHaveTextContent('1')
    expect(screen.getByTestId('brilliant-streak-pill')).toHaveTextContent('5')
    expect(screen.getByTestId('brilliant-streak-pill').querySelector('.text-\\[\\#A8D31D\\]')).toBeNull()

    useDailyStore.setState({ activityKey: doneKeyOf(todayStr(), 'yhq') })
    view.rerender(
      <MemoryRouter initialEntries={['/darslik']}>
        <Routes>
          <Route
            path="/darslik"
            element={<DarslikTopPills subjectId="yhq" completedCount={4} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('brilliant-streak-pill').querySelector('.text-\\[\\#A8D31D\\]')).not.toBeNull()
  })

  it('opens the keys bottom sheet and navigates to /premium for free users', () => {
    renderPills(2)
    fireEvent.click(screen.getByTestId('brilliant-keys-pill'))
    expect(screen.getByText('Sizda bugun 1 ta kalit qoldi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Barcha darslarni ochish' }))
    expect(screen.getByTestId('premium-route')).toBeInTheDocument()
  })

  it('shows unlocked lessons state in the keys sheet for premium users', () => {
    useAppStore.setState({ tariff: 'premium' })
    renderPills(6)
    expect(screen.getByTestId('brilliant-keys-pill')).toHaveTextContent('6')
    fireEvent.click(screen.getByTestId('brilliant-keys-pill'))
    expect(screen.getByText('Barcha darslar ochiq')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Barcha darslarni ochish' })).toBeNull()
  })

  it('opens the streak bottom sheet with stats and no action button', () => {
    renderPills(7)
    fireEvent.click(screen.getByTestId('brilliant-streak-pill'))
    expect(screen.getByText('Joriy seriya')).toBeInTheDocument()
    expect(screen.getByText('Tugatilgan darslar')).toBeInTheDocument()
    expect(screen.getByLabelText('Zaryadlar: 1/2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /kalendar/i })).toBeNull()
  })

  it('opens the league bottom sheet with Brilliant league tier and no action button', () => {
    useAppStore.setState({ league: 'silver' as never })
    renderPills(3)
    const leagueBtn = screen.getByTestId('brilliant-league-pill')
    expect(leagueBtn).toHaveAttribute('aria-label', 'Liga: Lithium')
    fireEvent.click(leagueBtn)
    expect(screen.getByText('Lithium ligasi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reyting/i })).toBeNull()
  })
})
