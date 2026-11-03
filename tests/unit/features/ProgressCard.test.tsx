/**
 * Dashboard progress kartasi — tayyorgarlik foizi va qisqa ko'rinish.
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
  render(<ProgressCard summary={{
    subjectId: 'yhq', totalQuestions: 100, answered: 7, mastered: 5,
    unresolvedMistakes: 2, dueNow: 0, readinessPercent: 5,
  }} streak={2} lang="uz" />)

describe('ProgressCard — tayyorgarlik foizi', () => {
  it('kam progress bilan ham tayyorgarlik foizi to\'g\'ri ko\'rsatiladi', () => {
    renderCard()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('5 / 100')).toBeInTheDocument()
  })
})
