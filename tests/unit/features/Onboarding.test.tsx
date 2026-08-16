import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Onboarding from '../../../src/features/onboarding/Onboarding'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

describe('Onboarding component flow', () => {
  beforeEach(() => {
    localStorage.clear()
    useSubjectStore.setState({ subjectId: 'yhq' })
  })

  it('navigates through all 3 steps and calls onDone callback', () => {
    const handleDone = vi.fn()
    render(<Onboarding onDone={handleDone} />)

    // Step 0: Welcome
    expect(screen.getByText(/Xush/i)).toBeInTheDocument()
    const startBtn = screen.getByRole('button', { name: /Boshlash/i })
    fireEvent.click(startBtn)

    // Step 1: Subject Selection
    expect(screen.getByText(/Qaysi/i)).toBeInTheDocument()
    const continueBtn = screen.getByRole('button', { name: /Davom etish/i })
    fireEvent.click(continueBtn)

    // Step 2: Goal Selection
    expect(screen.getByText(/Kuniga qancha vaqt/i)).toBeInTheDocument()
    const goalBtn = screen.getByRole('button', { name: /1 soat/i })
    fireEvent.click(goalBtn)

    const finishBtn = screen.getByRole('button', { name: /Boshlash/i })
    fireEvent.click(finishBtn)

    expect(handleDone).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('yhq-goal')).toBe('60')
  })

  it('allows going back from step 1 to step 0', () => {
    const handleDone = vi.fn()
    render(<Onboarding onDone={handleDone} />)

    // Move to step 1
    fireEvent.click(screen.getByRole('button', { name: /Boshlash/i }))
    expect(screen.getByText(/Qaysi/i)).toBeInTheDocument()

    // Back to step 0
    const backBtn = screen.getByRole('button', { name: /Orqaga/i })
    fireEvent.click(backBtn)
    expect(screen.getByText(/Xush/i)).toBeInTheDocument()
  })
})
