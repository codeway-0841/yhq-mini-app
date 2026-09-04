import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FloatingMenuButton from '../../../src/features/dashboard/components/FloatingMenuButton'
import { haptics } from '../../../src/platform/haptics'

describe('FloatingMenuButton', () => {
  it('renders a 56x56 icon-only button with rounded-[18px] and floating-menu-btn styling', () => {
    render(<FloatingMenuButton onClick={vi.fn()} label="Menyu" />)
    const btn = screen.getByRole('button', { name: 'Menyu' })
    expect(btn).toBeTruthy()
    expect(btn.className).toContain('floating-menu-btn')
    expect(btn.className).toContain('size-14')
    expect(btn.className).toContain('rounded-[18px]')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('updates aria-expanded when open is true', () => {
    render(<FloatingMenuButton onClick={vi.fn()} open={true} label="Menyu" />)
    const btn = screen.getByRole('button', { name: 'Menyu' })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('triggers haptics.selection on pointer down and calls onClick on click', () => {
    const selectionSpy = vi.spyOn(haptics, 'selection').mockImplementation(() => {})
    const handleClick = vi.fn()
    render(<FloatingMenuButton onClick={handleClick} label="Menyu" />)
    const btn = screen.getByRole('button', { name: 'Menyu' })

    fireEvent.pointerDown(btn)
    expect(selectionSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)

    selectionSpy.mockRestore()
  })

  it('applies translate-y-5 and opacity-0 when hidden is true', () => {
    const { rerender } = render(<FloatingMenuButton onClick={vi.fn()} hidden={false} label="Menyu" />)
    const btn = screen.getByRole('button', { name: 'Menyu' })
    expect(btn.className).toContain('translate-y-0')
    expect(btn.className).toContain('opacity-100')
    expect(btn.className).not.toContain('opacity-0')

    rerender(<FloatingMenuButton onClick={vi.fn()} hidden={true} label="Menyu" />)
    expect(btn.className).toContain('translate-y-5')
    expect(btn.className).toContain('opacity-0')
    expect(btn.className).toContain('pointer-events-none')
  })
})
