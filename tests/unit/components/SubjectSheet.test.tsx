import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubjectSheet from '../../../src/shared/components/SubjectSheet'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'

describe('SubjectSheet component', () => {
  beforeEach(() => {
    useSubjectStore.setState({ subjectId: 'yhq' })
    useAppStore.setState({
      settings: {
        language: 'uz',
        theme: 'dark',
        sound: true,
        vibration: true,
        autoNext: true,
        fontSize: 'md',
        noAnimation: false,
        lowDataMode: false,
      },
    })
  })

  it('renders subject list title and subjects in Uzbek', () => {
    const handleClose = vi.fn()
    render(<SubjectSheet onClose={handleClose} />)

    expect(screen.getByText('Fan tanlash')).toBeInTheDocument()
    expect(screen.getByText("Yo'l harakati qoidalari")).toBeInTheDocument()
  })

  it('renders in Russian when language is ru', () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        language: 'ru',
      },
    })
    const handleClose = vi.fn()
    render(<SubjectSheet onClose={handleClose} />)

    expect(screen.getByText('Выбрать предмет')).toBeInTheDocument()
    expect(screen.getByText('Правила дорожного движения')).toBeInTheDocument()
  })

  it('selects available subject and closes sheet', () => {
    const handleClose = vi.fn()
    render(<SubjectSheet onClose={handleClose} />)

    const subjectBtn = screen.getByText("Yo'l harakati qoidalari").closest('button')
    expect(subjectBtn).toBeInTheDocument()
    if (subjectBtn) fireEvent.click(subjectBtn)

    expect(useSubjectStore.getState().subjectId).toBe('yhq')
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
