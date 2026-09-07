import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import PinchableImage from '../../../src/shared/components/PinchableImage'
import { haptics } from '../../../src/platform/haptics'

describe('PinchableImage', () => {
  beforeEach(() => {
    vi.spyOn(haptics, 'impact').mockImplementation(() => {})
  })

  it('renders image, alt text, zoom label and has data-no-swipe attribute', () => {
    render(
      <PinchableImage
        src="https://example.com/test.png"
        alt="Savol 5 rasmi"
        zoomLabel="Kattalashtirish"
      />
    )

    const img = screen.getByAltText('Savol 5 rasmi')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/test.png')

    const button = screen.getByRole('button', { name: 'Savol 5 rasmi' })
    expect(button).toHaveAttribute('data-no-swipe', 'true')
    expect(screen.getByText('Kattalashtirish')).toBeInTheDocument()
  })

  it('calls onOpenModal on single tap after debounce delay', () => {
    vi.useFakeTimers()
    const onOpenModal = vi.fn()

    render(
      <PinchableImage
        src="https://example.com/test.png"
        alt="Question Image"
        onOpenModal={onOpenModal}
      />
    )

    const button = screen.getByRole('button', { name: 'Question Image' })
    fireEvent.click(button, { clientX: 100, clientY: 100 })

    expect(onOpenModal).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(onOpenModal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('zooms on double-tap and resets on subsequent double-tap', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    render(
      <PinchableImage
        src="https://example.com/test.png"
        alt="Question Image"
      />
    )

    const button = screen.getByRole('button', { name: 'Question Image' })

    // First tap
    fireEvent.click(button, { clientX: 100, clientY: 100 })

    // Second tap within 300ms at nearly same position
    now += 150
    fireEvent.click(button, { clientX: 102, clientY: 101 })

    expect(haptics.impact).toHaveBeenCalledWith('medium')
    // When zoomed, zoom indicator chip is hidden and backdrop is visible
    expect(screen.queryByText('Kattalashtirish')).not.toBeInTheDocument()

    // Third tap
    now += 500
    fireEvent.click(button, { clientX: 102, clientY: 101 })

    // Fourth tap (double tap to reset)
    now += 150
    fireEvent.click(button, { clientX: 102, clientY: 101 })

    expect(haptics.impact).toHaveBeenCalledWith('light')
  })

  it('supports keyboard navigation with Enter key', () => {
    const onOpenModal = vi.fn()
    render(
      <PinchableImage
        src="https://example.com/test.png"
        alt="Question Image"
        onOpenModal={onOpenModal}
      />
    )

    const button = screen.getByRole('button', { name: 'Question Image' })
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(onOpenModal).toHaveBeenCalledTimes(1)
  })

  it('handles two-finger pinch touch interaction without error', () => {
    render(
      <PinchableImage
        src="https://example.com/test.png"
        alt="Question Image"
      />
    )

    const button = screen.getByRole('button', { name: 'Question Image' })

    // Touch start with 2 fingers
    fireEvent.touchStart(button, {
      touches: [
        { clientX: 100, clientY: 200 },
        { clientX: 200, clientY: 200 },
      ],
    })

    // Pinch out: distance increases from 100 to 180
    fireEvent.touchMove(button, {
      touches: [
        { clientX: 60, clientY: 200 },
        { clientX: 240, clientY: 200 },
      ],
    })

    // Touch end
    fireEvent.touchEnd(button, {
      touches: [],
    })

    expect(haptics.impact).toHaveBeenCalledWith('light')
  })
})
