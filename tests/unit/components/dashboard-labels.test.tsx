import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { ModeRow } from '../../../src/features/dashboard/components/GridCards'
import { TopBar } from '../../../src/features/dashboard/components/TopBar'
import { LearningGuide } from '../../../src/features/dashboard/components/LearningGuide'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'

describe('dashboard localized labels', () => {
  it.each([
    ['uz', 'Biletlar Biletli testlar'],
    ['ru', 'Билеты Тесты по билетам'],
  ] as const)('shows the short ticket description in %s', (language, name) => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, language } }))
    render(<MemoryRouter><LearningGuide mistakesCount={0} /></MemoryRouter>)
    expect(screen.getByRole('button', { name })).toBeVisible()
  })

  it('uses the selected language for the subject after a language change', () => {
    useSubjectStore.getState().setSubject('yhq')
    useAppStore.setState((s) => ({ ...s, settings: { ...s.settings, language: 'uz' } }))
    const { rerender } = render(
      <MemoryRouter>
        <TopBar user={null} displayName="Ali" onSubjects={vi.fn()} onSettings={vi.fn()} onProfile={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText("Yo'l harakati qoidalari")).toBeInTheDocument()
    act(() => {
      useAppStore.setState((s) => ({ ...s, settings: { ...s.settings, language: 'ru' } }))
    })
    rerender(
      <MemoryRouter>
        <TopBar user={null} displayName="Ali" onSubjects={vi.fn()} onSettings={vi.fn()} onProfile={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText('Правила дорожного движения')).toBeInTheDocument()
    expect(screen.queryByText("Yo'l harakati qoidalari")).not.toBeInTheDocument()
  })

  it.each(['Tez orada', 'Скоро'])('shows %s visibly and in the accessible name', (label) => {
    const onClick = vi.fn()
    render(<ModeRow icon={Bot} label="AI Tutor" comingSoon={label} onClick={onClick} />)
    expect(screen.getByText(label)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: `AI Tutor (${label})` }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
