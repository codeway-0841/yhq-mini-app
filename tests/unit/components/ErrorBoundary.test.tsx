import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../../src/shared/components/ErrorBoundary'

const ThrowErrorComponent = ({ message }: { message: string }) => {
  throw new Error(message)
}

describe('ErrorBoundary component', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })

  it('catches render error and displays error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowErrorComponent message="Kutilmagan xatolik yuz berdi" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Xato yuz berdi')).toBeInTheDocument()
    expect(screen.getByText('Kutilmagan xatolik yuz berdi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Qayta yuklash' })).toBeInTheDocument()
  })

  it('reloads page when "Qayta yuklash" button is clicked', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    })

    render(
      <ErrorBoundary>
        <ThrowErrorComponent message="Crash test" />
      </ErrorBoundary>
    )

    const reloadBtn = screen.getByRole('button', { name: 'Qayta yuklash' })
    fireEvent.click(reloadBtn)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })
})
