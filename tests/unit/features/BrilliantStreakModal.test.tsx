import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BrilliantStreakModal } from '../../../src/shared/components/BrilliantStreakModal'
import { useAppStore } from '../../../src/shared/store/useAppStore'

vi.mock('../../../src/shared/components/BrilliantEndstateRive', () => ({
  BrilliantEndstateRive: ({ kind, label }: { kind: string; label: string }) => (
    <div data-testid={`mock-rive-${kind}`} aria-label={label} />
  ),
}))

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

describe('BrilliantStreakModal — Brilliant 1:1 100dvh', () => {
  it('seriya ekranida 5-kunlik kalendarni ko‘rsatadi va showCharge bilan zaryadga o‘tadi', () => {
    const onClose = vi.fn()
    render(<BrilliantStreakModal streak={7} showCharge onClose={onClose} />)

    expect(screen.getByTestId('mock-rive-streak')).toBeInTheDocument()
    expect(screen.getAllByText(/^(Ya|Du|Se|Ch|Pa|Ju|Sh)$/)).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('mock-rive-charge')).toBeInTheDocument()
    expect(screen.getByText('1 ta Seriya zaryadini oldingiz!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seriya zaryadi nima?' }))
    expect(screen.getByText('Avtomatik himoya')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tushunarli' }))

    fireEvent.click(screen.getByRole('button', { name: 'Davom etish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('lesson preview rejimida 1:1 dars sahnasi va presetlarni ishlatadi', () => {
    render(<BrilliantStreakModal streak={3} initialView="lesson" xpEarned={45} onClose={vi.fn()} />)

    expect(screen.getByTestId('mock-rive-lesson')).toBeInTheDocument()
    expect(screen.getByText('Dars yakunlandi!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Daraja \(Olmos\)/ }))
    expect(screen.getByText('1-daraja yakunlandi!')).toBeInTheDocument()
  })
})
