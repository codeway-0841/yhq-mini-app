import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import RussianDarslikPage from '../../../src/features/darslik-rustili/RussianDarslikPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import {
  DARSLIK_BLOCKS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  DARSLIK_SECTION_COUNT,
  getBlockOutline,
} from '../../../src/content/darslik-rustili'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => navigate,
}))

const uid = 'rus-darslik-test'
const moduleIdOf = (blockId: number) => DARSLIK_PROGRESS_MODULE_OFFSET + blockId
const pathNode = (blockId: number, idx: number) =>
  document.querySelector<HTMLButtonElement>(`[data-path-node][data-module="${blockId}"][data-lesson="${idx}"]`)!

beforeEach(() => {
  navigate.mockReset()
  useLessonsStore.setState({ byUser: {} })
  useAppStore.setState({
    tariff: 'premium',
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
})

describe('RussianDarslikPage — learning path', () => {
  it('har bir blok uchun learning path va umumiy progressni ko‘rsatadi', () => {
    render(<RussianDarslikPage />)

    // Mobil header va desktop karta — ikkalasi ham sarlavhani beradi
    expect(screen.getAllByRole('heading', { name: 'Rus tili darsligi' }).length).toBeGreaterThan(0)
    expect(screen.getByText(`0/${DARSLIK_SECTION_COUNT}`)).toBeInTheDocument()

    for (const block of DARSLIK_BLOCKS) {
      const section = document.getElementById(`rus-block-${block.id}`)
      expect(section).toBeTruthy()
      expect(section!.querySelectorAll('[data-path-node]').length).toBe(getBlockOutline(block.id).length)
    }
  })

  it('o‘qilgan mavzular progressda aks etadi', () => {
    useLessonsStore.setState({
      byUser: { [uid]: { [moduleIdOf(1)]: [0, 1], [moduleIdOf(2)]: [0] } },
    })
    render(<RussianDarslikPage />)

    expect(screen.getByText(`3/${DARSLIK_SECTION_COUNT}`)).toBeInTheDocument()
    const banner = document.getElementById('rus-block-1')!
    expect(banner.textContent).toContain(`2/${getBlockOutline(1).length}`)
  })

  it('tugunni bosib mavzuni ochadi, o‘qilgan deb belgilaydi va keyingisiga o‘tadi', async () => {
    render(<RussianDarslikPage />)

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))

    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })
    expect(within(reader).getAllByText(/ЗВУКИ И БУКВЫ/).length).toBeGreaterThan(0)

    fireEvent.click(within(reader).getByRole('button', { name: /qib bo/ }))
    expect(useLessonsStore.getState().byUser[uid][moduleIdOf(1)]).toEqual([0])

    // Keyingi mavzuga o'tadi (o'quvchi yopilmaydi)
    await waitFor(() => {
      expect(document.querySelector('.lesson-reader')!.textContent).toContain(`1-blok · 2/${getBlockOutline(1).length}`)
    })
  })

  it('o‘quvchini yopadi va path progressini yangilaydi', async () => {
    render(<RussianDarslikPage />)

    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))
    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => {
      expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`)
    })

    fireEvent.click(within(reader).getByRole('button', { name: /qib bo/ }))
    fireEvent.click(within(reader).getByRole('button', { name: 'O‘qishni yopish' }))

    expect(screen.getAllByRole('heading', { name: 'Rus tili darsligi' }).length).toBeGreaterThan(0)
    expect(screen.getByText(`1/${DARSLIK_SECTION_COUNT}`)).toBeInTheDocument()
  })

  it('o‘qilgan mavzu uchun "Qayta o‘qish" taklif qiladi', async () => {
    useLessonsStore.setState({ byUser: { [uid]: { [moduleIdOf(1)]: [0] } } })
    render(<RussianDarslikPage />)

    fireEvent.click(pathNode(1, 0))
    expect(await screen.findByRole('button', { name: 'Qayta o‘qish' })).toBeInTheDocument()
  })

  it('rus tilida modul va mavzu sarlavhalarini ruscha ko‘rsatadi', () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      settings: { ...useAppStore.getState().settings, language: 'ru' },
    })
    render(<RussianDarslikPage />)

    expect(screen.getAllByRole('heading', { name: 'Учебник русского языка' }).length).toBeGreaterThan(0)
    const banner = document.getElementById('rus-block-1')!
    expect(banner.textContent).toContain(DARSLIK_BLOCKS[0].titleRu)
  })
})
