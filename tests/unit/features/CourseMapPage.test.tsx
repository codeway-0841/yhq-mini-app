import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CourseMapPage from '../../../src/features/darslik-rustili/CourseMapPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { api } from '../../../src/shared/api'
import { DARSLIK_BLOCKS, getBlockOutline } from '../../../src/content/darslik-rustili'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => navigate,
}))

const uid = 'course-map-test'

const nodesOf = (blockId: number) =>
  document.querySelector<HTMLElement>(`#cmap-level-${blockId}`)!.closest('.cmap-level')!
    .querySelectorAll<HTMLButtonElement>('.cmap-node')

const sheet = () => document.querySelector<HTMLElement>('.cmap-sheet')!

beforeEach(() => {
  navigate.mockReset()
  useLessonsStore.setState({ byUser: {}, readByUser: {} })
  useAppStore.setState({
    tariff: 'premium',
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
  vi.spyOn(api, 'getDarslikProgress').mockResolvedValue({ passed: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CourseMapPage — kurs xaritasi', () => {
  it('tugma yaltirashi matnni yashirmaydi va o‘qib berilmaydi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const start = within(sheet()).getByRole('button', { name: 'Boshlash' })
    const shimmer = start.querySelector('.cmap-start-sheen')
    expect(shimmer).toHaveAttribute('aria-hidden', 'true')
    expect(shimmer?.querySelectorAll('svg rect')).toHaveLength(2)
    expect(start).toHaveTextContent('Boshlash')
  })

  it('har bir blok uchun pill va mavzu tugunlarini chizadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    expect(screen.getAllByRole('heading', { name: 'Rus tili darsligi' }).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.cmap-level')).toHaveLength(DARSLIK_BLOCKS.length)
    expect(document.querySelector('.cmap-bonus-art')).toBeNull()
    expect(nodesOf(1)).toHaveLength(getBlockOutline(1).length + 1)
    expect(nodesOf(2)).toHaveLength(getBlockOutline(2).length + 1)
    expect(document.querySelectorAll('.cmap-pill[aria-expanded="true"]')).toHaveLength(DARSLIK_BLOCKS.length)
    expect(nodesOf(1)[0].parentElement?.style.getPropertyValue('--off')).toBe('calc(var(--cmap-wave-space) / 2)')
    expect(nodesOf(1)[1].parentElement?.style.getPropertyValue('--off')).toBe('0px')
    expect(nodesOf(2)[0].parentElement?.style.getPropertyValue('--off')).toBe('calc(var(--cmap-wave-space) / 2)')

    // pill sarlavhasi — blok nomi
    expect(document.getElementById('cmap-level-1')!.textContent).toContain(DARSLIK_BLOCKS[0].titleUz)
    expect(nodesOf(1)[getBlockOutline(1).length]).toHaveTextContent('Bo‘lim tekshiruvi')
    expect(nodesOf(1)[getBlockOutline(1).length - 1].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-puck.svg')
    expect(nodesOf(1)[getBlockOutline(1).length].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-check.svg')
    expect(nodesOf(1)[getBlockOutline(1).length]).toHaveAttribute('aria-disabled', 'true')
  })

  it('birinchi mavzu joriy holatda, karta uning nomini ko‘rsatadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const first = nodesOf(1)[0]
    expect(first).toHaveAttribute('aria-current', 'step')
    expect(first.querySelector('.cmap-node-art')).toHaveAttribute('src', '/darslik-map/node-active-base.png')
    expect(first.querySelector('.cmap-node-rive')).toHaveAttribute('aria-hidden', 'true')
    expect(first.querySelector('.cmap-gem')).toBeNull()
    expect(sheet().querySelector('.cmap-sheet-title')!.textContent).toBe(getBlockOutline(1)[0])
    expect(within(sheet()).getByRole('button', { name: 'Boshlash' })).toBeEnabled()
  })

  it('boshqa mavzu tanlansa karta unga o‘tadi, ko‘k disk joriy darsda qoladi va orbit tanlovni ko‘rsatadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const target = getBlockOutline(1).length > 2 ? 2 : 1
    fireEvent.click(nodesOf(1)[target])

    await waitFor(() => expect(sheet().querySelector('.cmap-sheet-title')!.textContent).toBe(getBlockOutline(1)[target]))
    expect(nodesOf(1)[target]).not.toHaveAttribute('aria-current')
    expect(nodesOf(1)[0]).toHaveAttribute('aria-current', 'step')
    expect(nodesOf(1)[0]).toHaveClass('is-active')
    expect(nodesOf(1)[0].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-active-base.png')
    expect(nodesOf(1)[target]).toHaveClass('is-focus')
    expect(nodesOf(1)[target].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-puck.svg')
    expect(nodesOf(1)[target].querySelector('.cmap-node-rive')).toHaveAttribute('aria-hidden', 'true')
    expect(nodesOf(1)[target + 1].querySelector('.cmap-node-rive')).toBeNull()
    expect(nodesOf(1)[0].querySelector('.cmap-node-mascot')).not.toBeNull()
    expect(nodesOf(1)[target].querySelector('.cmap-node-mascot')).toBeNull()
    expect(document.querySelectorAll('img[src="/darslik-map/node-active-base.png"]')).toHaveLength(1)
  })

  it('scroll boshqa mavzuga ergashganda ham ko‘k diskni ko‘chirmaydi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const target = nodesOf(1)[1]
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (!this.classList.contains('cmap-node')) return { top: 0, bottom: 0, height: 0 } as DOMRect
      const top = this === target ? 100 : 10000
      return { top, bottom: top + 134, height: 134 } as DOMRect
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    const originalScrollY = window.scrollY
    window.scrollY = 300
    try {
      fireEvent.scroll(window)
      await waitFor(() => expect(sheet().querySelector('.cmap-sheet-title')).toHaveTextContent(getBlockOutline(1)[1]))
      expect(nodesOf(1)[0]).toHaveClass('is-active')
      expect(nodesOf(1)[0].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-active-base.png')
      expect(target).toHaveClass('is-focus')
      expect(target.querySelector('img')).toHaveAttribute('src', '/darslik-map/node-puck.svg')
    } finally {
      window.scrollY = originalScrollY
    }
  })

  it('o‘tilgan mavzu ko‘k belgi va alohida mashq/qayta o‘qish tugmalarini ko‘rsatadi', async () => {
    vi.mocked(api.getDarslikProgress).mockResolvedValue({ passed: ['1:0'] })
    render(<CourseMapPage />)

    await waitFor(() => expect(nodesOf(1)[1]).toHaveAttribute('aria-current', 'step'))
    expect(nodesOf(1)[0].querySelector('img')).toHaveAttribute('src', '/darslik-map/node-completed.svg')
    fireEvent.click(nodesOf(1)[0])

    expect(nodesOf(1)[0]).not.toHaveAttribute('aria-current')
    expect(nodesOf(1)[1]).toHaveAttribute('aria-current', 'step')
    expect(sheet()).toHaveAttribute('data-done', 'true')
    expect(within(sheet()).getByRole('button', { name: 'Mashqni boshlash' })).toBeEnabled()
    expect(within(sheet()).getByRole('button', { name: 'Qayta o‘qish' })).toBeEnabled()
  })

  it('ketma-ketlik yopiq mavzuni tanlashda “Boshlash” o‘chirilgan bo‘ladi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const lockedIdx = getBlockOutline(1).length - 1
    fireEvent.click(nodesOf(1)[lockedIdx])

    await waitFor(() => expect(sheet()).toHaveAttribute('data-locked', 'true'))
    expect(nodesOf(1)[lockedIdx]).toHaveAttribute('aria-disabled', 'true')
  })

  it('bo‘lim tekshiruvi mavzulardan alohida, blok tugagach mashqqa olib kiradi', async () => {
    vi.mocked(api.getDarslikProgress).mockResolvedValue({
      passed: getBlockOutline(1).map((_, idx) => `1:${idx}`),
    })
    render(<CourseMapPage />)
    await waitFor(() => expect(nodesOf(2)[0]).toHaveAttribute('aria-current', 'step'))

    fireEvent.click(nodesOf(1)[getBlockOutline(1).length])
    expect(nodesOf(1)[getBlockOutline(1).length]).not.toHaveAttribute('aria-disabled')
    expect(sheet()).toHaveAttribute('data-locked', 'false')
    expect(sheet().querySelector('.cmap-sheet-title')).toHaveTextContent('Bo‘lim tekshiruvi')
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Mashqni boshlash' }))
    await waitFor(() => expect(document.querySelector('[data-testid="topic-check"]')).not.toBeNull())
  })
})
