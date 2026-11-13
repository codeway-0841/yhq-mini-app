import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DarslikTopPills, buildStreakWeekDays } from '../../../src/features/lessons/DarslikTopPills'
import { api } from '../../../src/shared/api'
import { invalidateLeaderboardCache, leaderboardPageCaches } from '../../../src/shared/lib/leaderboard-cache'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { doneKeyOf, todayStr, useDailyStore } from '../../../src/shared/store/useDailyStore'

beforeEach(() => {
  invalidateLeaderboardCache()
  useAppStore.setState({
    user: null,
    tariff: 'free',
    settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: true },
  })
  useDailyStore.setState({
    streaks: { yhq: 5 },
    charges: { yhq: 1 },
    extendedDates: {},
    globalStreak: null,
    globalCharges: null,
    globalExtendedDate: null,
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
    expect(screen.getByText('Eng uzun seriya')).toBeInTheDocument()
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

  it('marks battery-saved freeze days inside an active streak and idle today cleanly', () => {
    const days = buildStreakWeekDays({
      today: '2026-11-13',
      streak: 5,
      isExtendedToday: false,
      historyRows: [
        { date: '2026-11-08', subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        // 2026-11-09 missed -> saved by battery charge!
        { date: '2026-11-10', subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        { date: '2026-11-11', subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        { date: '2026-11-12', subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
      ],
      ru: false,
    })

    expect(days.map((d) => d.status)).toEqual(['saved', 'completed', 'completed', 'completed', 'idle'])
    expect(days.map((d) => d.label)).toEqual(['Du', 'Se', 'Ch', 'Pa', 'Ju'])
    expect(days[4].isToday).toBe(true)
  })

  it('syncs server streak, battery charges, extended state, and bestStreak on mount', async () => {
    const today = todayStr()
    const dPrev1 = new Date(`${today}T00:00:00.000Z`)
    dPrev1.setUTCDate(dPrev1.getUTCDate() - 1)
    const dPrev2 = new Date(`${today}T00:00:00.000Z`)
    dPrev2.setUTCDate(dPrev2.getUTCDate() - 2)
    const dPrev4 = new Date(`${today}T00:00:00.000Z`)
    dPrev4.setUTCDate(dPrev4.getUTCDate() - 4)
    const y1 = dPrev1.toISOString().slice(0, 10)
    const y2 = dPrev2.toISOString().slice(0, 10)
    const y4 = dPrev4.toISOString().slice(0, 10)

    const getDailySpy = vi.spyOn(api, 'getDaily').mockResolvedValue({
      record: { date: today, subjectId: 'rus-tili', answered: 6, correct: 6 },
      dailyStreak: 4,
      streakCharges: 2,
    })
    const getHistSpy = vi.spyOn(api, 'getDailyHistory').mockResolvedValue({
      rows: [
        { date: y4, subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        // day -3 was saved by battery charge!
        { date: y2, subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        { date: y1, subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
        { date: today, subjectId: 'rus-tili', answered: 6, correct: 6, fixed: 0 },
      ],
      dailyStreak: 4,
      bestStreak: 11,
      streakCharges: 2,
    })

    useAppStore.setState({
      user: { id: 'u77', firstName: 'Ruslan' } as never,
    })
    useDailyStore.setState({
      streaks: {},
      charges: {},
      extendedDates: {},
      globalStreak: null,
      globalCharges: null,
      globalExtendedDate: null,
      activityKey: null,
    })

    try {
      render(
        <MemoryRouter initialEntries={['/darslik/rus-tili']}>
          <Routes>
            <Route
              path="/darslik/rus-tili"
              element={<DarslikTopPills subjectId="rustili" completedCount={9} />}
            />
          </Routes>
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('brilliant-streak-pill')).toHaveTextContent('4')
      })
      expect(screen.getByTestId('brilliant-streak-pill').querySelector('.text-\\[\\#A8D31D\\]')).not.toBeNull()

      fireEvent.click(screen.getByTestId('brilliant-streak-pill'))
      await waitFor(() => {
        expect(screen.getByText('11')).toBeInTheDocument()
      })
      expect(getHistSpy).toHaveBeenCalledWith('u77', expect.any(String), 'rustili', { global: true })
      expect(screen.getByLabelText('Zaryadlar: 2/2')).toBeInTheDocument()
      expect(document.querySelectorAll('[data-status="saved"]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-status="completed"]')).toHaveLength(4)
    } finally {
      getDailySpy.mockRestore()
      getHistSpy.mockRestore()
    }
  })

  it('shares global streak and battery charges across any subject such as fizika', () => {
    const today = todayStr()
    useDailyStore.setState({
      streaks: { rustili: 6 },
      charges: { rustili: 2 },
      extendedDates: { [`rustili:${today}`]: true },
      globalStreak: 6,
      globalCharges: 2,
      globalExtendedDate: today,
    })
    render(
      <MemoryRouter initialEntries={['/darslik']}>
        <Routes>
          <Route path="/darslik" element={<DarslikTopPills subjectId="fizika" completedCount={2} />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('brilliant-streak-pill')).toHaveTextContent('6')
    expect(screen.getByTestId('brilliant-streak-pill').querySelector('.text-\\[\\#A8D31D\\]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('brilliant-streak-pill'))
    expect(screen.getByLabelText('Zaryadlar: 2/2')).toBeInTheDocument()
  })
})
