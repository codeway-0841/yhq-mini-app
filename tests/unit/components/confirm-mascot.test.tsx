import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ConfirmDialog, ConfirmMascot } from '../../../src/shared/components/ui'

describe('ConfirmMascot & ConfirmDialog integration', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders 3D LED-eye ConfirmMascot inside ConfirmDialog by default and maps destructive to danger emotion', () => {
    const { rerender } = render(
      <ConfirmDialog
        title="Testdan chiqilsinmi?"
        description="Berilgan javoblar saqlangan."
        confirmLabel="Chiqish"
        cancelLabel="Qolish"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Testdan chiqilsinmi?' })
    const mascot = within(dialog).getByTestId('confirm-mascot')
    expect(mascot).toBeInTheDocument()
    expect(mascot).toHaveAttribute('data-emotion', 'question')

    rerender(
      <ConfirmDialog
        title="Natijani o'chirasizmi?"
        confirmLabel="O'chirish"
        cancelLabel="Bekor qilish"
        destructive
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('confirm-mascot')).toHaveAttribute('data-emotion', 'danger')

    rerender(
      <ConfirmDialog
        title="Oddiy dialog"
        confirmLabel="Tasdiqlash"
        cancelLabel="Bekor qilish"
        mascot={false}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByTestId('confirm-mascot')).not.toBeInTheDocument()
  })

  it('cycles through LED eye phases: look-left -> blink -> center -> symbol -> idle', () => {
    vi.useFakeTimers()
    render(<ConfirmMascot emotion="question" />)

    const mascot = screen.getByTestId('confirm-mascot')
    expect(mascot).toHaveAttribute('data-phase', 'look-left')

    act(() => { vi.advanceTimersByTime(950) })
    expect(mascot).toHaveAttribute('data-phase', 'blink')

    act(() => { vi.advanceTimersByTime(850) })
    expect(mascot).toHaveAttribute('data-phase', 'center')

    act(() => { vi.advanceTimersByTime(750) })
    expect(mascot).toHaveAttribute('data-phase', 'symbol')

    act(() => { vi.advanceTimersByTime(2700) })
    expect(mascot).toHaveAttribute('data-phase', 'idle')
  })

  it('invokes confirm and cancel callbacks from side-by-side action buttons', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        title="Test yakunlansinmi?"
        confirmLabel="Yakunlash"
        cancelLabel="Qolish"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Qolish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Yakunlash' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
