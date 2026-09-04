import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { ModeRow } from '../../../src/features/dashboard/components/GridCards'
import { ProgressCard } from '../../../src/features/dashboard/components/ProgressCard'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

describe('dashboard localized labels', () => {
  it('uses the selected language for the subject after a language change', () => {
    useSubjectStore.getState().setSubject('yhq')
    const { rerender } = render(<MemoryRouter><ProgressCard totalWrong={0} totalAnswered={0} streak={0} totalPool={100} lang="uz" /></MemoryRouter>)
    expect(screen.getByText("Yo'l harakati qoidalari")).toBeInTheDocument()
    rerender(<MemoryRouter><ProgressCard totalWrong={0} totalAnswered={0} streak={0} totalPool={100} lang="ru" /></MemoryRouter>)
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
