/**
 * AchievementsScreen — profildagi ixcham "Yutuqlarim" qatori bosilganda
 * ochiladigan to'liq ekran: barcha yutuqlar render bo'ladi, umumiy progress
 * ko'rinadi, ← back onClose'ni chaqiradi. AchievementsSection esa faqat
 * kompakt qator ko'rsatadi (grid endi profilni band qilmaydi).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockGetAchievements } = vi.hoisted(() => ({ mockGetAchievements: vi.fn() }))
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, getAchievements: mockGetAchievements } }
})

import AchievementsScreen from '../../../src/features/profile/components/AchievementsScreen'
import { AchievementsSection } from '../../../src/features/profile/components/AchievementsSection'
import { ACHIEVEMENTS } from '../../../src/shared/config/achievements'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { t as tRaw, type useT } from '../../../src/shared/i18n'
import type { AchievementStats } from '../../../src/shared/api'

const stats: AchievementStats = {
  bestStreak: 10, totalCorrect: 120, totalAnswered: 200,
  totalFixed: 5, octagonWins: 0, allPassed80: false,
} as AchievementStats

/** Test'lar uchun tt (useT aslida oddiy curry — hook emas). */
function useTt(): ReturnType<typeof useT> {
  return (key) => tRaw('uz', key)
}

beforeEach(() => {
  mockGetAchievements.mockReset()
  mockGetAchievements.mockResolvedValue({ stats })
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

describe('AchievementsScreen', () => {
  it('barcha yutuqlarni va umumiy progressni ko\'rsatadi', () => {
    const tt = useTt()
    render(<AchievementsScreen stats={stats} tt={tt} onClose={vi.fn()} />)

    // 11 ta yutuq config'da — barchasi grid'da
    for (const a of ACHIEVEMENTS) {
      expect(screen.getAllByText(tt(a.titleKey)).length).toBeGreaterThan(0)
    }
    // bestStreak=10 → streak7; totalCorrect=120 → correct100 (2 ta ochiq)
    expect(screen.getByText(`2 / ${ACHIEVEMENTS.length}`)).toBeTruthy()
  })

  it('orqaga (←) tugmasi onClose\'ni chaqiradi', () => {
    const tt = useTt()
    const onClose = vi.fn()
    render(<AchievementsScreen stats={stats} tt={tt} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AchievementsSection (ixcham qator)', () => {
  it('faqat kompakt qator ko\'rsatadi — yutuq nomlari yopiq holda ko\'rinmaydi', async () => {
    render(<AchievementsSection lang="uz" tt={useTt()} userId="42" />)

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeTruthy()
    })
    // Grid elementlari profilda ko'rinmasligi kerak — faqat umumiy sarlavha
    expect(screen.queryByText('7 kunlik seriya')).toBeNull()
    expect(screen.getByText(`2/${ACHIEVEMENTS.length}`)).toBeTruthy()
  })

  it('qator bosilsa to\'liq ekran ochiladi', async () => {
    render(<AchievementsSection lang="uz" tt={useTt()} userId="42" />)

    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy())
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Orqaga' })).toBeTruthy()
    })
  })
})
