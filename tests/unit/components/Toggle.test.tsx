import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toggle from '../../../src/shared/components/Toggle'

describe('Toggle component', () => {
  it('renders correctly with default off state', () => {
    render(<Toggle checked={false} label="Ovozlar" />)
    const toggleBtn = screen.getByRole('switch', { name: 'Ovozlar' })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false')
  })

  it('renders correctly with on state', () => {
    render(<Toggle checked={true} label="Ovozlar" />)
    const toggleBtn = screen.getByRole('switch', { name: 'Ovozlar' })
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange callback with toggled value when clicked', () => {
    const handleChange = vi.fn()
    render(<Toggle checked={false} onChange={handleChange} label="Vibratsiya" />)
    const toggleBtn = screen.getByRole('switch', { name: 'Vibratsiya' })
    fireEvent.click(toggleBtn)
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('toggles from true to false', () => {
    const handleChange = vi.fn()
    render(<Toggle checked={true} onChange={handleChange} label="Vibratsiya" />)
    const toggleBtn = screen.getByRole('switch', { name: 'Vibratsiya' })
    fireEvent.click(toggleBtn)
    expect(handleChange).toHaveBeenCalledWith(false)
  })
})
