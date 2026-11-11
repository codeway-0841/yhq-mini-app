import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  BrilliantLeagueModal,
  getLeagueTier,
  BRILLIANT_LEAGUES,
} from '../../../src/shared/components/BrilliantLeagueModal'
import { useAppStore } from '../../../src/shared/store/useAppStore'

vi.mock('../../../src/shared/components/BrilliantExtrasRive', () => ({
  BrilliantExtrasRive: ({ kind, label }: { kind: string; label: string }) => (
    <div data-testid={`mock-extras-${kind}`} aria-label={label} />
  ),
}))

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'uz' } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BrilliantLeagueModal — Brilliant 1:1 League Endstate', () => {
  it('getLeagueTier 10 ta Brilliant ligasini to‘g‘ri ajratadi', () => {
    expect(BRILLIANT_LEAGUES).toHaveLength(10)
    expect(getLeagueTier(1, 'uz').name).toBe('Bronza')
    expect(getLeagueTier(2, 'uz').name).toBe('Kumush')
    expect(getLeagueTier(3, 'ru').name).toBe('Золото')
    expect(getLeagueTier('silver', 'uz').name).toBe('Kumush')
    expect(getLeagueTier('gold', 'ru').name).toBe('Золото')
  })

  it('modal ko‘tarilish (promote) holatida 1:1 Brilliant tuzilmasini ko‘rsatadi', () => {
    const onClose = vi.fn()
    render(
      <BrilliantLeagueModal
        isOpen
        leagueLevel={2}
        leagueState="promote"
        rank={1}
        score={640}
        onClose={onClose}
      />,
    )

    expect(screen.getByTestId('mock-extras-league')).toBeInTheDocument()
    expect(screen.getByText('Yangi ligaga ko‘tarildingiz!')).toBeInTheDocument()
    expect(screen.getByText(/Kumush ligasi \(2\/10\)/)).toBeInTheDocument()
    expect(screen.getByText('Siz')).toBeInTheDocument()
    expect(screen.getByText('640 XP')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rus tilida to‘g‘ri tarjima va xabarlarni chiqaradi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    const onClose = vi.fn()
    render(
      <BrilliantLeagueModal
        isOpen
        leagueLevel={3}
        leagueState="promote"
        rank={2}
        score={500}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('Повышение в лиге!')).toBeInTheDocument()
    expect(screen.getByText(/Золото лига \(3\/10\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument()
  })
})
