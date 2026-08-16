import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DialogOverlay from '../../../src/shared/components/DialogOverlay'

describe('DialogOverlay component', () => {
  it('renders modal with role="dialog" and children', () => {
    const handleClose = vi.fn()
    render(
      <DialogOverlay onClose={handleClose} labelId="modal-title">
        <div>
          <h2 id="modal-title">Modal Title</h2>
          <button>Action</button>
        </div>
      </DialogOverlay>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    expect(screen.getByText('Modal Title')).toBeInTheDocument()
  })

  it('calls onClose when clicking backdrop overlay', () => {
    const handleClose = vi.fn()
    const { container } = render(
      <DialogOverlay onClose={handleClose}>
        <div>Modal Content</div>
      </DialogOverlay>
    )

    const backdrop = container.querySelector('.bg-black\\/70')
    expect(backdrop).toBeInTheDocument()
    if (backdrop) fireEvent.click(backdrop)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn()
    render(
      <DialogOverlay onClose={handleClose}>
        <div>Modal Content</div>
      </DialogOverlay>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
