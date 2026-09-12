import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IosDock from '../../../src/shared/components/IosDock'
import { haptics } from '../../../src/platform/haptics'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.spyOn(haptics, 'selection')
vi.spyOn(haptics, 'impact')

describe('IosDock component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 5 tabs on dashboard route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
    expect(screen.getByText('Bosh')).toBeInTheDocument()
    expect(screen.getByText('Testlar')).toBeInTheDocument()
    expect(screen.getByText('AI Yechish')).toBeInTheDocument()
    expect(screen.getByText('Duel')).toBeInTheDocument()
    expect(screen.getByText('Profil')).toBeInTheDocument()
  })

  it('marks active tab with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/testlar']}>
        <IosDock />
      </MemoryRouter>,
    )

    const testlarBtn = screen.getByRole('button', { name: /Testlar/i })
    expect(testlarBtn).toHaveAttribute('aria-current', 'page')

    const homeBtn = screen.getByRole('button', { name: /Bosh sahifa/i })
    expect(homeBtn).not.toHaveAttribute('aria-current')
  })

  it('clicking normal tab navigates and triggers haptic selection', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    const duelBtn = screen.getByRole('button', { name: /Duel/i })
    fireEvent.click(duelBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/octagon')
    expect(haptics.selection).toHaveBeenCalledTimes(1)
  })

  it('clicking center AI button navigates to /ai-tutor and triggers medium impact haptics', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    const aiBtn = screen.getByRole('button', { name: /AI Yechish/i })
    fireEvent.click(aiBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/ai-tutor')
    expect(haptics.impact).toHaveBeenCalledWith('medium')
  })

  it('hides dock on test solving routes like /test/123', () => {
    render(
      <MemoryRouter initialEntries={['/test/123']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).not.toBeInTheDocument()
  })

  it('hides dock on camera AI tutor route /ai-tutor', () => {
    render(
      <MemoryRouter initialEntries={['/ai-tutor']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).not.toBeInTheDocument()
  })
})
