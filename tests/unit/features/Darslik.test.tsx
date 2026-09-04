import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import Darslik from '../../../src/features/lessons/Darslik'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import { lessons } from '../../../src/content/lessons'
import lessonMap from '../../../src/content/lessonMap.yhq.json'
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
const pathButtons = (id = 1) => {
  return within(document.getElementById(`lesson-module-${id}`)!).getAllByRole('button')
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

describe('Darslik learning path', () => {
  it('allows the first lesson for free, then asks for Premium instead of opening lesson two', () => {
    useAppStore.setState({ tariff: 'free' })
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash', exact: true }))
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
    fireEvent.click(pathButtons(moduleId)[idx])
    fireEvent.click(screen.getByRole('button', { name: 'Premium bilan ochish' }))
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

  it('requires Premium for the module check, including the first module', () => {
    useAppStore.setState({ tariff: 'free' })
    render(<Darslik />)
    fireEvent.click(pathButtons()[lessons[1].length])
    fireEvent.click(screen.getByRole('button', { name: 'Premium bilan ochish' }))
    expect(navigate).toHaveBeenCalledWith('/premium')
    expect(navigate).not.toHaveBeenCalledWith('/test/1', expect.anything())
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

  it('celebrates a newly finished module and automatically opens the next path', () => {
    vi.useFakeTimers()
    finishFirstModule()
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Modul tugallandi!')
    expect(within(screen.getByRole('dialog')).getByText('Chorrahalar')).toBeInTheDocument()
    expect(document.getElementById('lesson-module-title-2')).not.toHaveFocus()
    act(() => vi.advanceTimersByTime(MODULE_TRANSITION_MS))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
    expect(pathButtons(2)[0]).toHaveAttribute('aria-current', 'step')
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
    expect(document.getElementById('lesson-module-title-2')).not.toHaveFocus()
  })

  it.each(['gap', 'review'])('does not auto-advance on %s completion', (scenario) => {
    const last = lessons[1].length - 1
    useLessonsStore.setState({ byUser: { [uid]: { 1: scenario === 'review' ? lessons[1].map((_, i) => i) : [] } } })
    location.state = { moduleId: 1, lessonIdx: last }
    render(<Darslik />)
    fireEvent.click(screen.getByRole('button', { name: 'Modulni yakunlash' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('lesson-module-title-2')).not.toHaveFocus()
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
  it('shows lessons plus one level check per module, with one global current step', () => {
    render(<Darslik />)
    expect(screen.getAllByRole('region')).toHaveLength(modules.length)
    expect(screen.getAllByRole('list')).toHaveLength(modules.length)
    expect(screen.getAllByRole('button', { name: 'Joriy darsga' })).toHaveLength(1)
    const buttons = pathButtons()
    expect(buttons).toHaveLength(lessons[1].length + 1)
    expect(buttons[0]).toHaveAttribute('aria-current', 'step')
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeEnabled()
    expect(buttons[2]).toBeEnabled()
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    expect(buttons[2].querySelector('.learning-tile')).toHaveAttribute('data-state', 'unread')
    fireEvent.click(buttons[2])
    expect(screen.getByRole('button', { name: 'Shu darsga o‘tish' })).toBeInTheDocument()
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
  })

  it('opens a lesson, saves reading progress and unlocks the next step', () => {
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    expect(screen.getByRole('region', { name: lessons[1][0].titleUz })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(pathButtons()[1]).toBeEnabled()
    expect(pathButtons()[1]).toHaveAttribute('aria-current', 'step')
    expect(within(document.getElementById('lesson-module-1')!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it('opens practice with the curated question IDs without marking practice completed', () => {
    useLessonsStore.setState({ byUser: { [uid]: { 1: [0] } } })
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    expect(screen.queryByRole('button', { name: 'Mashqni boshlash' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta o‘qish' }))
    fireEvent.click(screen.getByRole('button', { name: /Mavzu bo'yicha mashq/ }))
    expect(navigate).toHaveBeenCalledWith('/test/1', {
      state: { questionIds: lessonMap['1:0'], title: `${lessons[1][0].titleUz} — mashq` },
    })
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
  })

  it('keeps other modules directly available for review on the continuous path', () => {
    useLessonsStore.setState({ byUser: { [uid]: { 2: [0] } } })
    render(<Darslik />)
    expect(pathButtons(2)).toHaveLength(lessons[2].length + 1)
    fireEvent.click(pathButtons(2)[0])
    expect(screen.getByRole('region', { name: lessons[2][0].titleUz })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Qayta o‘qish' })).toBeEnabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: lessons[2][0].titleUz })).not.toBeInTheDocument()
    expect(pathButtons(2)[0]).toHaveFocus()
  })

  it('switches the single preview between modules without locking page scroll', () => {
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    expect(pathButtons()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(document.body.style.overflow).not.toBe('hidden')
    fireEvent.click(pathButtons(2)[0])
    expect(pathButtons()[0]).toHaveAttribute('aria-pressed', 'false')
    expect(pathButtons(2)[0]).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelectorAll('#lesson-preview')).toHaveLength(1)
    expect(screen.getByRole('region', { name: lessons[2][0].titleUz })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shu darsga o‘tish' }))
    expect(document.getElementById('lesson-preview')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: `1-dars. ${lessons[2][0].titleUz}` })).toBeInTheDocument()
  })

  it('jumps to a future lesson without crediting skipped lessons', () => {
    render(<Darslik />)
    fireEvent.click(pathButtons()[3])
    fireEvent.click(screen.getByRole('button', { name: 'Shu darsga o‘tish' }))
    expect(screen.getByRole('heading', { name: `4-dars. ${lessons[1][3].titleUz}` })).toBeInTheDocument()
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([3])
  })

  it('starts the level check using all unique curated module questions', () => {
    render(<Darslik />)
    const check = pathButtons()[lessons[1].length]
    expect(check.querySelector('[data-check="true"] polygon.learning-orbit')).toBeInTheDocument()
    fireEvent.click(check)
    fireEvent.click(screen.getByRole('button', { name: 'Sinovni boshlash' }))
    const map = lessonMap as Record<string, number[]>
    const ids = [...new Set(lessons[1].flatMap((_, idx) => map[`1:${idx}`] ?? []))]
    expect(navigate).toHaveBeenCalledWith('/test/1', {
      state: { questionIds: ids, title: "Yo'l belgilari — Modul sinovi" },
    })
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
  })

  it('returns to the current lesson with the floating arrow after browsing ahead', () => {
    render(<Darslik />)
    const scroll = vi.fn()
    pathButtons()[0].scrollIntoView = scroll
    fireEvent.click(pathButtons()[3])
    expect(screen.getByRole('button', { name: 'Shu darsga o‘tish' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Joriy darsga' }))
    expect(pathButtons()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(pathButtons()[0]).toHaveFocus()
    expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'center' })
    expect(screen.getByRole('button', { name: 'Boshlash', exact: true })).toBeInTheDocument()
  })

  it('reveals the reader behind the launch scene before fading the scene away', () => {
    vi.useFakeTimers()
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: false } })
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash', exact: true }))
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
    fireEvent.click(pathButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash', exact: true }))
    act(() => vi.advanceTimersByTime(elapsed))
    fireEvent.keyDown(document, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(LESSON_LAUNCH_MS))
    expect(screen.queryByRole('dialog', { name: 'Dars ochilmoqda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: `1-dars. ${lessons[1][0].titleUz}` })).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(useLessonsStore.getState().byUser[uid]).toBeUndefined()
  })

  it('changes selection and dock title on scroll without moving keyboard focus', () => {
    vi.useFakeTimers()
    let scrolled = false
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      let top = 2000
      let height = 130
      if (this.tagName === 'HEADER') { top = 0; height = 60 }
      if (this.dataset.module === '1') {
        const idx = Number(this.dataset.lesson)
        top = scrolled ? idx === 2 ? 280 : -200 : idx === 1 ? 280 : -200
      }
      return { top, bottom: top + height, left: 0, right: 320, width: 320, height, x: 0, y: top, toJSON() {} }
    })
    render(<Darslik />)
    const first = pathButtons()[0]
    first.focus()
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(32))
    expect(pathButtons()[1]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: lessons[1][1].titleUz })).toBeInTheDocument()
    scrolled = true
    fireEvent.scroll(window)
    act(() => vi.advanceTimersByTime(32))
    expect(pathButtons()[2]).toHaveAttribute('aria-pressed', 'true')
    expect(pathButtons()[1]).toHaveAttribute('aria-pressed', 'false')
    expect(first).toHaveFocus()
  })

  it('uses Russian labels and handles a completed module without a current step', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    useLessonsStore.setState({ byUser: { [uid]: { 1: lessons[1].map((_, i) => i) } } })
    render(<Darslik />)
    expect(screen.queryByText('Модуль пройден!')).not.toBeInTheDocument()
    expect(pathButtons().every((b) => !b.hasAttribute('aria-current'))).toBe(true)
    expect(pathButtons().every((b) => !(b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('preserves the dashboard deep link and returns to its module', () => {
    location.state = { moduleId: 2, lessonIdx: 0 }
    render(<Darslik />)
    expect(screen.getByRole('heading', { name: `1-dars. ${lessons[2][0].titleUz}` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(document.getElementById('lesson-module-title-2')).toHaveFocus()
  })
})
