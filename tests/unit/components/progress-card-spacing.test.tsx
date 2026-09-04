import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressCard } from '../../../src/features/dashboard/components/ProgressCard'

vi.mock('../../../src/shared/hooks/useCountUp', () => ({ useCountUp: (value: number) => value }))

describe('compact dashboard progress card', () => {
  it.each(['uz', 'ru'] as const)('keeps readable content and stat controls in %s', (lang) => {
    const { container } = render(
      <MemoryRouter>
        <ProgressCard totalWrong={0} totalAnswered={25} totalPool={100} streak={7} lang={lang} />
      </MemoryRouter>,
    )
    const card = container.querySelector('.hero-gradient-card')!
    // Compact whitespace only: retain horizontal gutters, type sizes and touch padding.
    expect(card).toHaveClass('px-4', 'py-3', 'sm:px-5', 'sm:py-4', 'mb-4')
    expect(card).not.toHaveClass('p-4', 'sm:p-5')
    expect(screen.getByText('25')).toHaveClass('text-[44px]')
    expect(screen.getByText('25 / 100').parentElement).toHaveClass('mt-3')
    expect(card.querySelector('.grid-cols-3')).toHaveClass('mt-2')
    expect(screen.getAllByRole('button')).toHaveLength(3)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('py-2')
      expect(button).toHaveAccessibleName()
    }
  })
})
