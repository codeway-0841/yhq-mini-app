import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PasswordInput from '../../../src/features/auth/components/PasswordInput'

describe('PasswordInput component', () => {
  it('renders password input with hidden text by default', () => {
    const handleChange = vi.fn()
    render(<PasswordInput value="secret123" onChange={handleChange} label="Parol" id="pwd-1" />)

    const input = screen.getByLabelText('Parol')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('secret123')
  })

  it('toggles visibility on toggle button click', () => {
    const handleChange = vi.fn()
    render(<PasswordInput value="secret123" onChange={handleChange} label="Parol" id="pwd-2" />)

    const input = screen.getByLabelText('Parol')
    const toggleBtn = screen.getByRole('button', { name: "Parolni ko'rsatish" })

    fireEvent.click(toggleBtn)
    expect(input).toHaveAttribute('type', 'text')

    const hideBtn = screen.getByRole('button', { name: 'Parolni yashirish' })
    fireEvent.click(hideBtn)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('displays password strength meter when enabled', () => {
    const handleChange = vi.fn()
    const { rerender } = render(
      <PasswordInput value="123" onChange={handleChange} showStrengthMeter={true} label="Parol" id="pwd-3" />
    )

    expect(screen.getByText('Zaif')).toBeInTheDocument()

    rerender(
      <PasswordInput value="Password123!" onChange={handleChange} showStrengthMeter={true} label="Parol" id="pwd-3" />
    )
    expect(screen.getByText('Juda kuchli')).toBeInTheDocument()
    expect(screen.getByText('Kamida 8 belgi')).toBeInTheDocument()
    expect(screen.getByText('Kamida 1 raqam')).toBeInTheDocument()
  })
})
