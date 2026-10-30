import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import Darslik from '../../../src/features/lessons/Darslik'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import { lessons } from '../../../src/content/lessons'
import lessonMap from '../../../shared/lesson-map.yhq.json'
import { modules } from '../../../src/content/modules'
import { MODULE_TRANSITION_MS } from '../../../src/features/lessons/ModuleComplete'
import { LESSON_LAUNCH_MS, LESSON_LAUNCH_REVEAL_MS } from '../../../src/features/lessons/LessonLaunch'

const { navigate, location } = vi.hoisted(() => ({
  navigate: vi.fn(), location: { state: null as null | { moduleId: number; lessonIdx: number } },
}))
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => navigate, useLocation: () => location,
}))

const uid = 'learning-path-test'
const lessonRowButtons = (id = 1) => {
  const section = document.getElementById(`lesson-module-${id}`)!
  return within(within(section).getByRole('list')).getAllByRole('button')
}

beforeEach(() => {
  navigate.mockReset()
  location.state = null
  useLessonsStore.setState({ byUser: {} })
  useAppStore.setState({
    tariff: 'premium',
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz', noAnimation: true },
  })
  vi.spyOn(useDailyStore.getState(), 'touchActivity').mockResolvedValue()
})
afterEach(() => { vi.useRealTimers() })

function finishFirstModule() {
  const last = lessons[1].length - 1
  useLessonsStore.setState({ byUser: { [uid]: { 1: Array.from({ length: last }, (_, i) => i) } } })
  location.state = { moduleId: 1, lessonIdx: last }
  render(<Darslik />)
  fireEvent.click(screen.getByRole('button', { name: 'Modulni yakunlash' }))
}

describe('Darslik Brilliant 1-to-1 Swipe Levels screen', () => {
  it('allows the first lesson for free, then asks for Premium instead of opening lesson two', () => {
    useAppStore.setState({ tariff: 'free' })
    render(<Darslik />)
    fireEvent.click(lessonRowButtons()[0])
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    expect(screen.getByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(navigate).toHaveBeenCalledWith('/premium')
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
    expect(screen.queryByRole('heading', { name: `2-dars. ${lessons[1][1].titleUz}` })).not.toBeInTheDocument()
  })

  it.each([[1, 1], [2, 0], [8, 0]])('requires Premium for module %i lesson index %i even if already read', (moduleId, idx) => {
    useAppStore.setState({ tariff: 'free' })
    useLessonsStore.setState({ byUser: { [uid]: { [moduleId]: [idx] } } })
    render(<Darslik />)
    const tab = screen.getByRole('tab', { name: `LEVEL ${moduleId}` })
    fireEvent.click(tab)
    fireEvent.click(lessonRowButtons(moduleId)[idx])
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    expect(navigate).toHaveBeenCalledWith('/premium')
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).not.toBeInTheDocument()
    expect(document.querySelector('.lesson-reader')).not.toBeInTheDocument()
  })

  it('does not reveal a paid lesson through a dashboard deep link', () => {
    useAppStore.setState({ tariff: 'free' })
    location.state = { moduleId: 2, lessonIdx: 0 }
    render(<Darslik />)
    expect(navigate).toHaveBeenCalledWith('/premium')
    expect(document.querySelector('.lesson-reader')).not.toBeInTheDocument()
  })

  it('closes paid reading when the existing entitlement becomes free', () => {
    location.state = { moduleId: 1, lessonIdx: 0 }
    render(<Darslik />)
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(screen.getByRole('heading', { name: `2-dars. ${lessons[1][1].titleUz}` })).toBeInTheDocument()
    act(() => useAppStore.setState({ tariff: 'free' }))
    expect(document.querySelector('.lesson-reader')).not.toBeInTheDocument()
    expect(navigate).toHaveBeenCalledWith('/premium')
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
  })

  it('celebrates a newly finished module and automatically switches to the next level', () => {
    vi.useFakeTimers()
    finishFirstModule()
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Modul tugallandi!')
    expect(within(screen.getByRole('dialog')).getByText('Chorrahalar')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(MODULE_TRANSITION_MS))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
    expect(lessonRowButtons(2)[0]).toHaveAttribute('aria-current', 'step')
    expect(useLessonsStore.getState().byUser[uid][1]).toHaveLength(lessons[1].length)
    expect(useLessonsStore.getState().byUser[uid][2]).toBeUndefined()
  })

  it('can continue immediately, without a later timer skipping another module', () => {
    vi.useFakeTimers()
    finishFirstModule()
    fireEvent.click(screen.getByRole('button', { name: 'Keyingi modulga o‘tish' }))
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
    act(() => vi.advanceTimersByTime(MODULE_TRANSITION_MS * 2))
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
  })

  it('cancels automatic navigation when the learner stays in the completed module', () => {
    vi.useFakeTimers()
    finishFirstModule()
    fireEvent.click(screen.getByRole('button', { name: 'Shu modulda qolish' }))
    act(() => vi.advanceTimersByTime(MODULE_TRANSITION_MS * 2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('lesson-module-title-2')).not.toBeInTheDocument()
  })

  it.each(['gap', 'review'])('does not auto-advance on %s completion', (scenario) => {
    const last = lessons[1].length - 1
    useLessonsStore.setState({ byUser: { [uid]: { 1: scenario === 'review' ? lessons[1].map((_, i) => i) : [] } } })
    location.state = { moduleId: 1, lessonIdx: last }
    render(<Darslik />)
    fireEvent.click(screen.getByRole('button', { name: 'Modulni yakunlash' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('finishes the course without attempting to open a nonexistent module', () => {
    vi.useFakeTimers()
    const final = modules[modules.length - 1]
    const last = lessons[final.id].length - 1
    const progress = Object.fromEntries(modules.map((m) => [m.id, lessons[m.id].map((_, i) => i).filter((i) => m.id !== final.id || i !== last)]))
    useLessonsStore.setState({ byUser: { [uid]: progress } })
    location.state = { moduleId: final.id, lessonIdx: last }
    render(<Darslik />)
    fireEvent.click(screen.getByRole('button', { name: 'Modulni yakunlash' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Barcha modullar tugallandi!')
    act(() => vi.advanceTimersByTime(MODULE_TRANSITION_MS * 2))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Darslikka qaytish' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the 1-to-1 Brilliant layout without the old snake path and switches levels via swipe or dots', () => {
    render(<Darslik />)
    expect(screen.getByTestId('brilliant-darslik-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('brilliant-recommended-badge')).not.toBeInTheDocument()
    expect(screen.getByTestId('brilliant-level-subtitle')).toHaveTextContent('LEVEL 1')
    expect(screen.getByTestId('brilliant-hero-1')).toBeInTheDocument()

    const buttons = lessonRowButtons(1)
    expect(buttons).toHaveLength(lessons[1].length)
    expect(buttons[0]).toHaveAttribute('aria-current', 'step')

    // Swipe left on the 3D Hero Stage to go to Level 2
    const stage = screen.getByTestId('brilliant-swipe-stage')
    fireEvent.touchStart(stage, { touches: [{ clientX: 250 }] })
    fireEvent.touchMove(stage, { touches: [{ clientX: 160 }] })
    fireEvent.touchEnd(stage)

    expect(screen.getByTestId('brilliant-level-subtitle')).toHaveTextContent('LEVEL 2')
    expect(screen.getByTestId('brilliant-start-button')).toHaveStyle({ backgroundColor: '#f6b31f' })
    expect(screen.getByRole('tab', { name: 'LEVEL 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('brilliant-hero-2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keyingi daraja' }))
    expect(screen.getByTestId('brilliant-level-subtitle')).toHaveTextContent('LEVEL 3')

    // Click pagination dot for Level 4 to verify RECOMMENDED badge appears
    fireEvent.click(screen.getByRole('tab', { name: 'LEVEL 4' }))
    expect(screen.getByTestId('brilliant-level-subtitle')).toHaveTextContent('LEVEL 4')
    expect(screen.getByTestId('brilliant-recommended-badge')).toHaveTextContent('RECOMMENDED')
  })

  it('opens a lesson via the Start button, saves reading progress and advances the current step', () => {
    render(<Darslik />)
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(lessonRowButtons(1)[1]).toHaveAttribute('aria-current', 'step')
  })

  it('desktop kurs progressini ko‘rsatadi va tema o‘zgarishini fon bilan sinxronlaydi', async () => {
    document.body.dataset.theme = 'dark'
    useLessonsStore.setState({ byUser: { [uid]: { 1: [0, 1] } } })
    location.state = { moduleId: 1 }
    const view = render(<Darslik />)
    const progress = document.querySelector('.yhq-home-progress')
    expect(progress).toHaveAttribute('aria-valuenow', '2')
    expect(progress).toHaveAttribute('aria-valuemax', String(lessons[1].length))
    expect(document.body.style.backgroundColor).toBe('rgb(17, 17, 17)')
    await act(async () => { document.body.dataset.theme = 'light'; await Promise.resolve() })
    expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)')
    view.unmount()
    delete document.body.dataset.theme
  })

  it('opens practice with the curated question IDs without marking practice completed', () => {
    useLessonsStore.setState({ byUser: { [uid]: { 1: [0] } } })
    render(<Darslik />)
    fireEvent.click(lessonRowButtons(1)[0])
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    fireEvent.click(screen.getByRole('button', { name: /Mavzu bo'yicha mashq/ }))
    expect(navigate).toHaveBeenCalledWith('/test/1', {
      state: {
        questionIds: lessonMap['1:0'],
        mode: 'lesson',
        serverSelector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
        title: `${lessons[1][0].titleUz} — mashq`,
      },
    })
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
  })

  it('jumps to a future lesson row when selected without crediting skipped lessons', () => {
    render(<Darslik />)
    fireEvent.click(lessonRowButtons(1)[3])
    expect(lessonRowButtons(1)[3]).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    expect(screen.getByRole('heading', { name: `4-dars. ${lessons[1][3].titleUz}` })).toBeInTheDocument()
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([3])
  })

  it('reveals the reader behind the launch scene before fading the scene away', () => {
    vi.useFakeTimers()
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: false } })
    render(<Darslik />)
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(LESSON_LAUNCH_REVEAL_MS))
    expect(screen.getByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Dars ochilmoqda' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(LESSON_LAUNCH_MS - LESSON_LAUNCH_REVEAL_MS))
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).not.toBeInTheDocument()
  })

  it.each([400, LESSON_LAUNCH_REVEAL_MS + 20])('cancels launch at %i ms without a delayed reader reopening', (elapsed) => {
    vi.useFakeTimers()
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: false } })
    render(<Darslik />)
    fireEvent.click(screen.getByTestId('brilliant-start-button'))
    act(() => vi.advanceTimersByTime(elapsed))
    fireEvent.keyDown(document, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(LESSON_LAUNCH_MS))
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
  })

  it('uses Russian labels and handles a completed module without a current step', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    useLessonsStore.setState({ byUser: { [uid]: { 1: lessons[1].map((_, i) => i) } } })
    location.state = { moduleId: 1, lessonIdx: 0 }
    render(<Darslik />)
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByText('Модуль пройден!')).not.toBeInTheDocument()
    expect(lessonRowButtons(1).every((b) => !b.hasAttribute('aria-current'))).toBe(true)
    expect(lessonRowButtons(1).every((b) => !(b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('preserves the dashboard deep link and returns to its module', () => {
    location.state = { moduleId: 2, lessonIdx: 0 }
    render(<Darslik />)
    expect(screen.getByRole('heading', { name: `1-dars. ${lessons[2][0].titleUz}` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
  })
})
