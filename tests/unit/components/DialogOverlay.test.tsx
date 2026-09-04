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

  describe('swipe-to-dismiss gesture behavior', () => {
    function firePointer(type: string, target: HTMLElement, init: { clientY?: number; clientX?: number; pointerId?: number } = {}) {
      const ev = new Event(type, { bubbles: true, cancelable: true }) as any
      ev.clientY = init.clientY ?? 0
      ev.clientX = init.clientX ?? 0
      ev.pointerId = init.pointerId ?? 1
      ev.pointerType = 'touch'
      ev.button = 0
      ev.isPrimary = true
      target.dispatchEvent(ev)
    }

    it('swipeToDismiss=false (default): pointer events don\'t wrap sheet in draggable container', () => {
      const { container } = render(
        <DialogOverlay onClose={() => {}}>
          <div data-testid="content">Modal Content</div>
        </DialogOverlay>
      )
      expect(container.querySelector('.will-change-transform')).not.toBeInTheDocument()
    })

    it('swipeToDismiss=true: renders sheet wrapper with gesture handlers', () => {
      const { container } = render(
        <DialogOverlay onClose={() => {}} swipeToDismiss>
          <div data-testid="content">
            <div data-drag-handle data-testid="handle" />
            <button>Option</button>
          </div>
        </DialogOverlay>
      )
      const wrapper = container.querySelector('.will-change-transform')
      expect(wrapper).toBeInTheDocument()
    })

    it('dragHandleOnly=true: pointer down outside drag handle does not start drag', () => {
      const handleClose = vi.fn()
      render(
        <DialogOverlay onClose={handleClose} swipeToDismiss dragHandleOnly>
          <div>
            <div data-drag-handle data-testid="handle">Handle</div>
            <div data-testid="content" style={{ marginTop: '100px' }}>Body content</div>
          </div>
        </DialogOverlay>
      )
      const content = screen.getByTestId('content')
      // Simulate click far from top
      firePointer('pointerdown', content, { clientY: 300, clientX: 100 })
      firePointer('pointermove', content, { clientY: 450, clientX: 100 })
      firePointer('pointerup', content, { clientY: 450, clientX: 100 })

      expect(handleClose).not.toHaveBeenCalled()
    })

    it('direction lock: horizontal swipe (dx > dy) is ignored by sheet drag', () => {
      const handleClose = vi.fn()
      render(
        <DialogOverlay onClose={handleClose} swipeToDismiss>
          <div>
            <div data-drag-handle data-testid="handle">Handle</div>
          </div>
        </DialogOverlay>
      )
      const handle = screen.getByTestId('handle')
      firePointer('pointerdown', handle, { clientY: 10, clientX: 10 })
      // Move 80px horizontally and only 10px vertically
      firePointer('pointermove', handle, { clientY: 20, clientX: 90 })
      firePointer('pointerup', handle, { clientY: 20, clientX: 90 })

      expect(handleClose).not.toHaveBeenCalled()
    })

    it('downward drag past threshold triggers onClose after animation timeout', async () => {
      vi.useFakeTimers()
      const handleClose = vi.fn()
      render(
        <DialogOverlay onClose={handleClose} swipeToDismiss>
          <div style={{ height: '300px' }}>
            <div data-drag-handle data-testid="handle">Handle</div>
          </div>
        </DialogOverlay>
      )
      const handle = screen.getByTestId('handle')
      firePointer('pointerdown', handle, { clientY: 10, clientX: 100 })
      // Drag down 180px (well past threshold)
      firePointer('pointermove', handle, { clientY: 190, clientX: 100 })
      firePointer('pointerup', handle, { clientY: 190, clientX: 100 })

      // Should not call immediately before animation
      expect(handleClose).not.toHaveBeenCalled()

      // Advance timers for exit animation
      vi.advanceTimersByTime(300)
      expect(handleClose).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('accidental click is suppressed after dragging gesture', () => {
      const handleClick = vi.fn()
      render(
        <DialogOverlay onClose={() => {}} swipeToDismiss>
          <div>
            <div data-drag-handle data-testid="handle">Handle</div>
            <button onClick={handleClick} data-testid="btn">Click me</button>
          </div>
        </DialogOverlay>
      )
      const handle = screen.getByTestId('handle')
      const btn = screen.getByTestId('btn')

      // Drag > 8px
      firePointer('pointerdown', handle, { clientY: 10, clientX: 100 })
      firePointer('pointermove', handle, { clientY: 25, clientX: 100 })
      firePointer('pointerup', handle, { clientY: 25, clientX: 100 })

      // Clicking immediately after drag should be suppressed
      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()

      // Next genuine click should work normally
      fireEvent.click(btn)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})
