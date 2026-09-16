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
    expect(screen.getByText('Menyu')).toBeInTheDocument()
  })

  it('markaziy kamera tugmada oq halqa (ring) va ✨ nishon YO‘Q', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    const aiBtn = screen.getByRole('button', { name: /AI Yechish/i })
    expect(aiBtn.className).not.toMatch(/ring-4|ring-pcanvas/)
    expect(aiBtn.textContent).not.toContain('✨')
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

  it('clicking Menyu tab navigates to /rejimlar and triggers haptic selection', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    const menuBtn = screen.getByRole('button', { name: /Menyu/i })
    fireEvent.click(menuBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/rejimlar')
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

  it('qonun (allowlist): dock FAQAT 4 tab-root\'da — /profil, /biletlar, /mavzular yashirin', () => {
    for (const path of ['/profil', '/biletlar', '/mavzular', '/kutubxona', '/reyting', '/xatolar', '/premium', '/shop', '/darslik', '/qidiruv', '/grafik']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <IosDock />
        </MemoryRouter>,
      )
      expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' }), path).not.toBeInTheDocument()
      unmount()
    }
  })

  it('qonun (allowlist): 4 tab-root\'ning HAMMASIDA ko\'rinadi — /, /testlar, /octagon, /rejimlar', () => {
    for (const path of ['/', '/testlar', '/octagon', '/rejimlar']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <IosDock />
        </MemoryRouter>,
      )
      expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' }), path).toBeInTheDocument()
      unmount()
    }
  })

  it('duel match (/octagon/abc) — flow ekran, dock yashirin', () => {
    render(
      <MemoryRouter initialEntries={['/octagon/abc123']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).not.toBeInTheDocument()
  })

  it('shows dock on camera AI tutor route /ai-tutor (tab-root since Wave 2)', () => {
    render(
      <MemoryRouter initialEntries={['/ai-tutor']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
  })

  it('hides dock while reading a library PDF', () => {
    render(
      <MemoryRouter initialEntries={['/kutubxona/kitob/1-sinf-alifbe']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).not.toBeInTheDocument()
  })
})
