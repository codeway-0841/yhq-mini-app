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

  it('renders all 4 tabs on dashboard route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
    expect(screen.getByText('Bosh')).toBeInTheDocument()
    expect(screen.getByText('Testlar')).toBeInTheDocument()
    expect(screen.getByText('Duel')).toBeInTheDocument()
    expect(screen.getByText('Menyu')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /AI Yechish/i })).not.toBeInTheDocument()
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

  it('hides dock on test solving routes like /test/123', () => {
    render(
      <MemoryRouter initialEntries={['/test/123']}>
        <IosDock />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' })).not.toBeInTheDocument()
  })

  it('qonun (allowlist): dock /profil, /biletlar, /mavzular va boshqa detail sahifalarda yashirin', () => {
    for (const path of ['/profil', '/biletlar', '/mavzular', '/kutubxona', '/reyting', '/xatolar', '/premium', '/shop', '/darslik?block=1', '/darslik/rus-tili?block=1', '/darslik/rus-adabiyot?block=1', '/qidiruv']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <IosDock />
        </MemoryRouter>,
      )
      expect(screen.queryByRole('navigation', { name: 'Asosiy navigatsiya' }), path).not.toBeInTheDocument()
      unmount()
    }
  })

  it('Darslik Home sahifalarida (/darslik, /darslik/rus-tili, /darslik/rus-adabiyot) pastki navbar ko\'rinadi', () => {
    for (const path of ['/darslik', '/darslik/rus-tili', '/darslik/rus-adabiyot']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <IosDock />
        </MemoryRouter>,
      )
      expect(screen.getByRole('navigation', { name: 'Asosiy navigatsiya' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Bosh sahifa/i })).toHaveAttribute('aria-current', 'page')
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

  it('Brilliant uslubida faol tab ikonasida pill va aksent', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <IosDock />
      </MemoryRouter>,
    )
    const pill = screen.getByTestId('dock-active-pill')
    expect(pill.className).toMatch(/rounded-full/)
    const homeBtn = screen.getByRole('button', { name: /Bosh sahifa/i })
    expect(homeBtn).toHaveAttribute('aria-current', 'page')
  })

  it('Brilliant uslubida har bir faol tab o\'zining pill belgisi bilan chiqadi', () => {
    for (const path of ['/', '/testlar', '/octagon', '/rejimlar']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <IosDock />
        </MemoryRouter>,
      )
      const pill = screen.getByTestId('dock-active-pill')
      expect(pill).toBeInTheDocument()
      unmount()
    }
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
