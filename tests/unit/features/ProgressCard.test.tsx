/**
 * Dashboard progress kartasi — liga yorlig'i.
 *
 * Avval `totalCorrect >= 1000 ? 'Platinum' : ...` bilan "o'ylab topilardi",
 * haqiqiy liga esa `progress.league`da (haftalik cron yuritadi) — ikkalasi
 * mos kelmasligi mumkin edi (FIXPLAN #60). Endi karta store'dagi haqiqiy
 * qiymatni ko'rsatadi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { ProgressCard } from '../../../src/features/dashboard/components/ProgressCard'
import { useAppStore } from '../../../src/shared/store/useAppStore'

beforeEach(() => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    xp: 0,
    league: 'bronze',
  })
})

const renderCard = () =>
  render(<ProgressCard totalWrong={0} totalAnswered={5} streak={2} totalPool={100} lang="uz" />)

describe('ProgressCard — liga yorlig\'i', () => {
  it('REGRESSIYA: kam progress bilan ham store\'dagi haqiqiy league ko\'rsatiladi (guess emas)', () => {
    // Eski heuristika totalCorrect>=1000 talab qilardi — bu yerda progress
    // atigi 5/100, lekin server league='platinum' desa shu ko'rsatilishi kerak.
    useAppStore.setState({ league: 'platinum' })
    renderCard()
    expect(screen.getByText('Platina')).toBeInTheDocument()
  })

  it.each([
    ['bronze', 'Bronza'],
    ['silver', 'Kumush'],
    ['gold', 'Oltin'],
    ['platinum', 'Platina'],
  ] as const)('league=%s → "%s" ko\'rsatiladi', (league, label) => {
    useAppStore.setState({ league })
    renderCard()
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
