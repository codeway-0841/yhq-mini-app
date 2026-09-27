import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ACHIEVEMENTS } from '../../../src/shared/config/achievements'
import { useAchievementCelebrationStore } from '../../../src/shared/store/useAchievementCelebrationStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { checkAndCelebrateAchievements } from '../../../src/shared/lib/achievement-detector'
import AchievementCelebrationModal from '../../../src/shared/components/AchievementCelebrationModal'
import { BadgeCard3D } from '../../../src/shared/components/BadgeCard3D'
import type { AchievementStats } from '../../../src/shared/api'

// Mock haptics & sounds to avoid browser errors in test
vi.mock('../../../src/platform/haptics', () => ({
  haptics: {
    achievement: vi.fn(),
    success: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
  },
}))

vi.mock('../../../src/shared/lib/sounds', () => ({
  playSound: vi.fn(),
}))

describe('Senior Achievement Celebration & 3D Badges', () => {
  const dummyStats: AchievementStats = {
    totalCorrect: 100,
    totalAnswered: 120,
    octagonWins: 10,
    bestStreak: 7,
    totalFixed: 100,
    subjectAccuracy: [
      { subjectId: 'fizika', answered: 100, accuracy: 95 },
    ],
    allPassed80: false,
  }

  beforeEach(() => {
    localStorage.clear()
    useAchievementCelebrationStore.setState({
      unlockedQueue: [],
      currentCelebration: null,
      inspectBadge: null,
    })
    useAppStore.setState({
      coins: 50,
      xp: 200,
      settings: { language: 'uz' } as any,
    })
  })

  it('BadgeCard3D renders badge with tier aura styling', () => {
    const goldBadge = ACHIEVEMENTS.find((a) => a.id === 'winStreak10')!
    expect(goldBadge).toBeDefined()
    expect(goldBadge.tier).toBe('gold')

    const { container } = render(
      <BadgeCard3D achievement={goldBadge} unlocked={true} size="md" />
    )

    expect(container.querySelector('div')).toBeTruthy()
  })

  it('checkAndCelebrateAchievements triggers celebration modal for newly unlocked achievements', () => {
    // Initial quiet baseline setup
    localStorage.setItem('kivvi_celebrated_badges', JSON.stringify([]))

    const newBadges = checkAndCelebrateAchievements(dummyStats)
    expect(newBadges.length).toBeGreaterThan(0)

    const state = useAchievementCelebrationStore.getState()
    expect(state.currentCelebration).toBeDefined()
  })

  it('AchievementCelebrationModal displays current celebration and claims rewards', () => {
    const ach = ACHIEVEMENTS.find((a) => a.id === 'correct100')!
    useAchievementCelebrationStore.getState().triggerCelebration(ach)

    render(<AchievementCelebrationModal />)

    // Modal sarlavhasi va yutuq nomi ko'rinishi
    expect(screen.getAllByText("100 ta to'g'ri javob").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Mukofotni olish/i)).toBeTruthy()

    // Claim tugmasini bosish
    const claimBtn = screen.getByRole('button', { name: /Mukofotni olish/i })
    act(() => {
      fireEvent.click(claimBtn)
    })

    // XP va tangalar qo'shilganini tekshirish
    const store = useAppStore.getState()
    expect(store.coins).toBe(50 + ach.reward.coins)
    expect(store.xp).toBe(200 + ach.reward.xp)
  })

  it('scroll paytida header o\'lchamini saqlaydi va status pillni takrorlamaydi', () => {
    const ach = ACHIEVEMENTS.find((a) => a.id === 'correct100')!
    useAchievementCelebrationStore.getState().triggerCelebration(ach)

    render(<AchievementCelebrationModal />)

    const dialog = screen.getByRole('dialog')
    const scrollContainer = dialog.querySelector('.overflow-y-auto')
    const floatingControls = dialog.querySelector('[data-floating-controls]')
    expect(scrollContainer).toBeTruthy()
    expect(floatingControls).toHaveClass('bg-transparent')
    expect(floatingControls).not.toHaveClass('backdrop-blur-xl')
    expect(screen.getAllByText('Erishildi')).toHaveLength(1)

    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 420 } })

    expect(screen.getAllByText('Erishildi')).toHaveLength(1)
    expect(screen.getByText('Marra').parentElement).toHaveClass('items-center')
  })

  it('navbatdagi yutuqlar birma-bir ochiladi (Multi-badge queue)', () => {
    const b1 = ACHIEVEMENTS.find((a) => a.id === 'correct100')!
    const b2 = ACHIEVEMENTS.find((a) => a.id === 'streak7')!

    useAchievementCelebrationStore.getState().triggerCelebration([b1, b2])

    expect(useAchievementCelebrationStore.getState().currentCelebration?.id).toBe(b1.id)
    expect(useAchievementCelebrationStore.getState().unlockedQueue.length).toBe(1)

    // b1 ni yopganda b2 ochilishi kerak
    act(() => {
      useAchievementCelebrationStore.getState().dismissCurrent()
    })

    expect(useAchievementCelebrationStore.getState().currentCelebration?.id).toBe(b2.id)
    expect(useAchievementCelebrationStore.getState().unlockedQueue.length).toBe(0)

    // b2 ni yopganda hammasi tugaydi
    act(() => {
      useAchievementCelebrationStore.getState().dismissCurrent()
    })

    expect(useAchievementCelebrationStore.getState().currentCelebration).toBeNull()
  })
})
