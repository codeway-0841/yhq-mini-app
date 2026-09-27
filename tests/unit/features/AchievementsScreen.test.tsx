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
    // totalCorrect=120, bestStreak=10 → correct100, speedMaster, streak7 (3 ta ochiq)
    expect(screen.getByText(`3 / ${ACHIEVEMENTS.length}`)).toBeTruthy()
  })

  it('orqaga (←) tugmasi onClose\'ni chaqiradi', () => {
    const tt = useTt()
    const onClose = vi.fn()
    render(<AchievementsScreen stats={stats} tt={tt} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('badgeImage mavjud yutuqlarda img elementlari render qilinadi', () => {
    const tt = useTt()
    render(<AchievementsScreen stats={stats} tt={tt} onClose={vi.fn()} />)

    const badgeImages = document.body.querySelectorAll('img')
    const srcList = Array.from(badgeImages).map((img) => img.getAttribute('src'))

    expect(srcList).toContain('/badges/badge-100.webp')
    expect(srcList).toContain('/badges/badge-500.webp')
    expect(srcList).toContain('/badges/badge-1000.webp')
    expect(srcList).toContain('/badges/badge-2000.webp')
    expect(srcList).toContain('/badges/badge-10000.webp')
    expect(srcList).toContain('/badges/badge-15000.webp')
    expect(srcList).toContain('/badges/badge-20000.webp')
    expect(srcList).toContain('/badges/badge-25000.webp')
    expect(srcList).toContain('/badges/badge-30000.webp')
    expect(srcList).toContain('/badges/badge-35000.webp')
    expect(srcList).toContain('/badges/badge-40000.webp')
    expect(srcList).toContain('/badges/badge-45000.webp')
    expect(srcList).toContain('/badges/badge-50000.webp')
    expect(srcList).toContain('/badges/badge-100000.webp')
    expect(srcList).toContain('/badges/badge-subject-matematika.webp')
    expect(srcList).toContain('/badges/badge-subject-fizika.webp')
    expect(srcList).toContain('/badges/badge-subject-biologiya.webp')
    expect(srcList).toContain('/badges/badge-subject-tarix.webp')
    expect(srcList).toContain('/badges/badge-subject-geografiya.webp')
    expect(srcList).toContain('/badges/badge-subject-onatili.webp')
    expect(srcList).toContain('/badges/badge-subject-adabiyot.webp')
    expect(srcList).toContain('/badges/badge-subject-rustili.webp')
    expect(srcList).toContain('/badges/badge-subject-kimyo.webp')
    expect(srcList).toContain('/badges/badge-target-accuracy.webp')
    expect(srcList).toContain('/badges/badge-league-champion.webp')
    expect(srcList).toContain('/badges/badge-speed-master.webp')
    expect(srcList).toContain('/badges/badge-streak-7.webp')
    expect(srcList).toContain('/badges/badge-all-subjects-80.webp')
    expect(srcList).toContain('/badges/badge-octagon-10.webp')
    expect(srcList).toContain('/badges/badge-kivvi-master.webp')
  })
})

describe('AchievementsSection (ixcham qator)', () => {
  it('faqat kompakt qator ko\'rsatadi — yutuq nomlari yopiq holda ko\'rinmaydi', async () => {
    render(<AchievementsSection lang="uz" tt={useTt()} userId="42" />)

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeTruthy()
    })
    // Grid elementlari profilda ko'rinmasligi kerak — faqat umumiy sarlavha
    expect(screen.queryByText('100 ta to\'g\'ri javob')).toBeNull()
    expect(screen.getByText(`3/${ACHIEVEMENTS.length}`)).toBeTruthy()
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
