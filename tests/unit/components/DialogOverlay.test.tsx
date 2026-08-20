import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DialogOverlay from '../../../src/shared/components/DialogOverlay'

afterEach(() => {
  document.body.style.overflow = ''
})

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

  it("nested overlay: Escape faqat ENG YUQORI overlay'ni yopadi (pastki ochiq qoladi)", () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()
    render(
      <DialogOverlay onClose={closeOuter}>
        <div>Tashqi modal</div>
      </DialogOverlay>
    )
    render(
      <DialogOverlay onClose={closeInner}>
        <div>Ichki modal</div>
      </DialogOverlay>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeInner).toHaveBeenCalledTimes(1)
    expect(closeOuter).not.toHaveBeenCalled()
  })

  it('body scroll-lock: ochilganda hidden, yopilganda tiklanadi (nested hisob bilan)', () => {
    document.body.style.overflow = 'auto'
    const first = render(<DialogOverlay onClose={() => {}}><div>1</div></DialogOverlay>)
    expect(document.body.style.overflow).toBe('hidden')
    const second = render(<DialogOverlay onClose={() => {}}><div>2</div></DialogOverlay>)
    // Ichki yopilganda — tashqi hali ochiq, lock qoladi
    second.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    // Hammasi yopilganda — tiklanadi
    first.unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it("focus-trap: oxirgi elementda Tab → birinchiga qaytadi", () => {
    render(
      <DialogOverlay onClose={() => {}}>
        <div>
          <button data-testid="a">A</button>
          <button data-testid="b">B</button>
        </div>
      </DialogOverlay>
    )
    const a = screen.getByTestId('a')
    const b = screen.getByTestId('b')
    // Mount'da birinchi element fokuslangan
    expect(document.activeElement).toBe(a)

    b.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(a)

    a.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(b)
  })

  it('focus restore: yopilganda fokus trigger elementga qaytadi', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const modal = render(<DialogOverlay onClose={() => {}}><button>ichki</button></DialogOverlay>)
    expect(document.activeElement).not.toBe(trigger)
    modal.unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it("zIndex prop qo'llanadi (nested/ceremony overlay)", () => {
    render(<DialogOverlay onClose={() => {}} zIndex={70}><div>x</div></DialogOverlay>)
    expect(screen.getByRole('dialog')).toHaveStyle({ zIndex: 70 })
  })
})
