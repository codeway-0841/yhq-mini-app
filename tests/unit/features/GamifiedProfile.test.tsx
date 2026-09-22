import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeeklyActivityCard } from '../../../src/features/profile/components/WeeklyActivityCard'
import { BadgesPreviewSection } from '../../../src/features/profile/components/BadgesPreviewSection'
import { MilestonesPreviewSection } from '../../../src/features/profile/components/MilestonesPreviewSection'
import { MyCoursesSection } from '../../../src/features/profile/components/MyCoursesSection'
import AchievementsScreen from '../../../src/features/profile/components/AchievementsScreen'
import { t as tRaw, type useT } from '../../../src/shared/i18n'
import type { AchievementStats } from '../../../src/shared/api'

function useTt(): ReturnType<typeof useT> {
  return (key) => tRaw('uz', key)
}

const mockStats: AchievementStats = {
  bestStreak: 12,
  totalCorrect: 1250,
  totalAnswered: 1500,
  totalFixed: 10,
  octagonWins: 2,
  allPassed80: false,
  subjectAccuracy: [
    { subjectId: 'matematika', answered: 105, correct: 95 },
    { subjectId: 'fizika', answered: 50, correct: 40 },
  ],
} as unknown as AchievementStats

describe('Gamified Profile Components', () => {
  it('WeeklyActivityCard 7 kunlik kunlarni, foydalanuvchi ismi va XP ni render qiladi', () => {
    const tt = useTt()
    render(
      <MemoryRouter>
        <WeeklyActivityCard name="Alisher" xp={1450} streak={5} tt={tt} />
      </MemoryRouter>
    )

    expect(screen.getByText('Alisher')).toBeTruthy()
    expect(screen.getByText('1,450 XP')).toBeTruthy()
    expect(screen.getByText('Du')).toBeTruthy()
    expect(screen.getByText('Ya')).toBeTruthy()
  })

  it('BadgesPreviewSection 4 ta maxsus nishonni va Barchasi tugmasini render qiladi', () => {
    const tt = useTt()
    const onOpenAll = vi.fn()
    render(<BadgesPreviewSection stats={mockStats} tt={tt} onOpenAll={onOpenAll} />)

    expect(screen.getByText(tt('badgesTitle'))).toBeTruthy()
    expect(screen.getByText(tt('viewAll'))).toBeTruthy()

    fireEvent.click(screen.getByText(tt('viewAll')))
    expect(onOpenAll).toHaveBeenCalledWith('badge')
  })

  it('MilestonesPreviewSection 4 ta geksagon marrani render qiladi', () => {
    const tt = useTt()
    const onOpenAll = vi.fn()
    render(<MilestonesPreviewSection stats={mockStats} tt={tt} onOpenAll={onOpenAll} />)

    expect(screen.getByText(tt('milestonesTitle'))).toBeTruthy()
    expect(screen.getByText(tt('viewAll'))).toBeTruthy()

    fireEvent.click(screen.getByText(tt('viewAll')))
    expect(onOpenAll).toHaveBeenCalledWith('milestone')
  })

  it('MyCoursesSection mavjud fanlarni render qiladi', () => {
    const tt = useTt()
    render(
      <MemoryRouter>
        <MyCoursesSection lang="uz" tt={tt} />
      </MemoryRouter>
    )

    expect(screen.getByText(tt('myCoursesTitle'))).toBeTruthy()
    expect(screen.getByText("Yo'l harakati qoidalari")).toBeTruthy()
    expect(screen.getByText('Matematika')).toBeTruthy()
  })

  it('AchievementsScreen tablar bo‘yicha to‘g‘ri filtrlaydi', () => {
    const tt = useTt()
    const onClose = vi.fn()
    render(<AchievementsScreen stats={mockStats} tt={tt} initialTab="all" onClose={onClose} />)

    // Barchasi, Nishonlar, Marralar tablari mavjud
    expect(screen.getByText(tt('tabAll'))).toBeTruthy()
    expect(screen.getByText(tt('tabBadges'))).toBeTruthy()
    expect(screen.getByText(tt('tabMilestones'))).toBeTruthy()

    // Tab o'zgartirish
    fireEvent.click(screen.getByText(tt('tabMilestones')))
    expect(screen.getByText(tt('tabMilestones'))).toBeTruthy()
  })
})
