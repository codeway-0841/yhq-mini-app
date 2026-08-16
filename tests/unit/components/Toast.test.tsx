import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toast from '../../../src/shared/components/Toast'

describe('Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders success toast message', () => {
    const handleClose = vi.fn()
    render(
      <Toast id="t1" type="success" message="Amaliyot muvaffaqiyatli bajarildi" onClose={handleClose} />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Amaliyot muvaffaqiyatli bajarildi')).toBeInTheDocument()
  })

  it('renders error toast with role="alert"', () => {
    const handleClose = vi.fn()
    render(
      <Toast id="t2" type="error" message="Xatolik yuz berdi" onClose={handleClose} />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Xatolik yuz berdi')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <Toast id="t3" type="info" message="Ma'lumot" onClose={handleClose} />
    )

    const closeBtn = screen.getByRole('button', { name: 'Yopish' })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledWith('t3')
  })

  it('auto-dismisses after specified duration', () => {
    const handleClose = vi.fn()
    render(
      <Toast id="t4" type="success" message="Vaqtli xabar" duration={2000} onClose={handleClose} />
    )

    expect(handleClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(handleClose).toHaveBeenCalledWith('t4')
  })
})
