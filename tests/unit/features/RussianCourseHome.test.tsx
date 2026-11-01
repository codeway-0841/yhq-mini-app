import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RussianCourseHome from '../../../src/features/darslik-rustili/RussianCourseHome'
import { DARSLIK_BLOCKS } from '../../../src/content/darslik-rustili'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { api } from '../../../src/shared/api'

vi.mock('../../../src/features/darslik-rustili/CourseMapPage', () => ({ default: ({ initialBlockId, onBackHome }: { initialBlockId: number; onBackHome: () => void }) => <div><span>map {initialBlockId}</span><button onClick={onBackHome}>back to blocks</button></div> }))
vi.mock('../../../src/features/lessons', () => ({
  BrilliantHeroIllustration: () => <span />,
  BrilliantLessonRowIcon: ({ state }: { state: string }) => <span data-testid={`node-${state}`} />,
  getBrilliantTheme: () => ({ accent: '#3557ff', dotColor: '#3557ff', buttonBg: '#3557ff', buttonText: '#fff', buttonShadow: '#223', checkBg: '#839cff' }),
  lessonLaunchOrigin: () => ({ x: 0, y: 0, size: 44, sink: 36 }),
  LessonLaunch: () => null,
}))

beforeEach(() => {
  useAppStore.setState({ user: { id: 'home-test', firstName: 'Test' } as never, settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: true } })
  vi.spyOn(api, 'getDarslikProgress').mockResolvedValue({ passed: [] })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('Russian course home', () => {
  it('selects all 15 blocks and opens the selected block, then returns to it', async () => {
    render(<MemoryRouter initialEntries={['/darslik/rus-tili']}><RussianCourseHome /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Boshlash' })).toBeEnabled())
    expect(screen.getByRole('heading', { name: DARSLIK_BLOCKS[0].titleUz })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Bob 15: ${DARSLIK_BLOCKS[14].titleUz}` }))
    expect(screen.getByRole('heading', { name: DARSLIK_BLOCKS[14].titleUz })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(screen.getByText('map 15')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'back to blocks' }))
    expect(screen.getByRole('heading', { name: DARSLIK_BLOCKS[14].titleUz })).toBeInTheDocument()
  })
  it('shows Russian labels and responds to a swipe', async () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    render(<MemoryRouter><RussianCourseHome /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Начать' })).toBeEnabled())
    const carousel = screen.getByLabelText('Выбор блока')
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] })
    fireEvent.touchMove(carousel, { touches: [{ clientX: 150 }] })
    expect(screen.getByRole('button', { name: DARSLIK_BLOCKS[0].titleRu })).toHaveStyle({ '--drag': '-50px' })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 80 }] })
    expect(screen.getByRole('heading', { name: DARSLIK_BLOCKS[1].titleRu })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: DARSLIK_BLOCKS[0].titleRu }))
    expect(screen.getByRole('heading', { name: DARSLIK_BLOCKS[1].titleRu })).toBeInTheDocument()
  })
  it('syncs body background with course canvas and avoids duplicate safe-top padding', async () => {
    document.body.dataset.theme = 'dark'
    const view = render(<MemoryRouter initialEntries={['/darslik/rus-tili']}><RussianCourseHome /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Boshlash' })).toBeEnabled())
    expect(document.body.style.backgroundColor).toBe('rgb(17, 17, 17)')
    await act(async () => {
      document.body.dataset.theme = 'light'
      await Promise.resolve()
    })
    expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)')
    view.unmount()
    delete document.body.dataset.theme

    const css = fs.readFileSync(
      path.resolve(__dirname, '../../../src/features/darslik-rustili/russian-course-home.css'),
      'utf8',
    )
    expect(css).not.toContain('max(12px, var(--safe-top, 0px))')
    expect(css).toContain('.route-page:has(.rus-home)')
  })
})
