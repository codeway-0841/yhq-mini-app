import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DarslikTopPills } from '../../../src/features/lessons/DarslikTopPills'
import { invalidateLeaderboardCache, leaderboardPageCaches } from '../../../src/shared/lib/leaderboard-cache'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { doneKeyOf, todayStr, useDailyStore } from '../../../src/shared/store/useDailyStore'

beforeEach(() => {
  invalidateLeaderboardCache()
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
    expect(screen.getByTestId('league-modal-title')).toHaveTextContent('Lithium ligasi')
    expect(screen.getByTestId('league-modal-subtitle')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reyting/i })).toBeNull()
  })

  it('switches league tiers on shield tap and swipe and hides countdown on non-active tiers', () => {
    useAppStore.setState({ league: 'silver' as never })
    renderPills(3)
    fireEvent.click(screen.getByTestId('brilliant-league-pill'))

    fireEvent.click(screen.getByTestId('league-tier-carbon'))
    expect(screen.getByTestId('league-modal-title')).toHaveTextContent('Carbon ligasi')
    expect(screen.queryByTestId('league-modal-subtitle')).toBeNull()

    const carousel = screen.getByTestId('league-carousel')
    const firePointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number, clientY: number) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 })
      Object.defineProperty(ev, 'pointerId', { value: 1 })
      fireEvent(carousel, ev)
    }
    firePointer('pointerdown', 240, 50)
    firePointer('pointermove', 120, 50)
    firePointer('pointerup', 120, 50)
    expect(screen.getByTestId('league-modal-title')).toHaveTextContent('Neon ligasi')

    fireEvent.keyDown(carousel, { key: 'ArrowLeft' })
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' })
    expect(screen.getByTestId('league-modal-title')).toHaveTextContent('Lithium ligasi')
    expect(screen.getByTestId('league-modal-subtitle')).toBeInTheDocument()
  })

  it('auto-scrolls to center the current user row inside the league list', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    const scrollToSpy = vi.fn()
    const origScrollTo = HTMLElement.prototype.scrollTo
    HTMLElement.prototype.scrollTo = scrollToSpy

    useAppStore.setState({
      league: 'silver' as never,
      user: { id: 'u12', firstName: 'Ruslan', lastName: 'A' } as never,
    })
    const entries = Array.from({ length: 16 }, (_, idx) => ({
      rank: idx + 1,
      userId: `u${idx + 1}`,
      name: `User ${idx + 1}`,
      score: 900 - idx * 25,
      isYou: idx === 11,
    }))
    const weeklyData = {
      myLeague: 'lithium',
      entries,
    } as never
    const peekSpy = vi.spyOn(leaderboardPageCaches.weekly, 'peek').mockReturnValue(weeklyData)
    const fetchSpy = vi.spyOn(leaderboardPageCaches.weekly, 'fetch').mockResolvedValue(weeklyData)

    try {
      renderPills(3)
      fireEvent.click(screen.getByTestId('brilliant-league-pill'))
      expect(screen.getByTestId('league-you-row')).toBeInTheDocument()
      expect(scrollToSpy).toHaveBeenCalled()
    } finally {
      peekSpy.mockRestore()
      fetchSpy.mockRestore()
      HTMLElement.prototype.scrollTo = origScrollTo
      rafSpy.mockRestore()
    }
  })
})
