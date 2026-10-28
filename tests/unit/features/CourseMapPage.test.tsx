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
  it('har bir blok uchun pill va mavzu tugunlarini chizadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    expect(screen.getAllByRole('heading', { name: 'Rus tili darsligi' }).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.cmap-level')).toHaveLength(DARSLIK_BLOCKS.length)
    expect(nodesOf(1)).toHaveLength(getBlockOutline(1).length)
    expect(nodesOf(2)).toHaveLength(getBlockOutline(2).length)
    expect(document.querySelectorAll('.cmap-pill[aria-expanded="true"]')).toHaveLength(DARSLIK_BLOCKS.length)
    expect(nodesOf(1)[0].parentElement?.style.getPropertyValue('--off')).toBe('0px')
    expect(nodesOf(2)[0].parentElement?.style.getPropertyValue('--off')).toBe('50px')

    // pill sarlavhasi — blok nomi
    expect(document.getElementById('cmap-level-1')!.textContent).toContain(DARSLIK_BLOCKS[0].titleUz)
  })

  it('birinchi mavzu joriy holatda, karta uning nomini ko‘rsatadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const first = nodesOf(1)[0]
    expect(first).toHaveAttribute('aria-current', 'step')
    expect(sheet().querySelector('.cmap-sheet-title')!.textContent).toBe(getBlockOutline(1)[0])
    expect(within(sheet()).getByRole('button', { name: 'Boshlash' })).toBeEnabled()
  })

  it('boshqa tugun tanlansa karta sarlavhasi va joriy tugun yangilanadi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const target = getBlockOutline(1).length > 2 ? 2 : 1
    fireEvent.click(nodesOf(1)[target])

    await waitFor(() => expect(sheet().querySelector('.cmap-sheet-title')!.textContent).toBe(getBlockOutline(1)[target]))
    expect(nodesOf(1)[target]).toHaveAttribute('aria-current', 'step')
    expect(nodesOf(1)[0]).not.toHaveAttribute('aria-current')
  })

  it('ketma-ketlik yopiq mavzuni tanlashda “Boshlash” o‘chirilgan bo‘ladi', async () => {
    render(<CourseMapPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    const lockedIdx = getBlockOutline(1).length - 1
    fireEvent.click(nodesOf(1)[lockedIdx])

    await waitFor(() => expect(sheet()).toHaveAttribute('data-locked', 'true'))
    expect(nodesOf(1)[lockedIdx]).toHaveAttribute('aria-disabled', 'true')
  })
})
