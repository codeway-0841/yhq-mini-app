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
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
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
  it('shows real lessons, locks later lessons and practice until reading is done', () => {
    render(<Darslik />)
    expect(screen.getAllByRole('region')).toHaveLength(modules.length)
    expect(screen.getAllByRole('list')).toHaveLength(modules.length)
    expect(screen.getAllByRole('button', { name: 'Joriy darsga' })).toHaveLength(1)
    const buttons = pathButtons()
    expect(buttons).toHaveLength(lessons[1].length * 2)
    expect(buttons[0]).toHaveAttribute('aria-current', 'step')
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeDisabled()
    expect(buttons[2]).toBeDisabled()
    fireEvent.click(buttons[2])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a lesson, saves reading progress and unlocks the next step', () => {
    render(<Darslik />)
    fireEvent.click(pathButtons()[0])
    expect(screen.getByRole('dialog')).toHaveAccessibleName(lessons[1][0].titleUz)
    fireEvent.click(screen.getByRole('button', { name: 'Darsni ochish' }))
    fireEvent.click(screen.getByRole('button', { name: "O'qib bo'ldim — keyingi" }))
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(pathButtons()[1]).toBeEnabled()
    expect(pathButtons()[2]).toHaveAttribute('aria-current', 'step')
    expect(within(document.getElementById('lesson-module-1')!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it('opens practice with the curated question IDs without marking practice completed', () => {
    useLessonsStore.setState({ byUser: { [uid]: { 1: [0] } } })
    render(<Darslik />)
    fireEvent.click(pathButtons()[1])
    fireEvent.click(screen.getByRole('button', { name: 'Mashqni boshlash' }))
    expect(navigate).toHaveBeenCalledWith('/test/1', {
      state: { questionIds: lessonMap['1:0'], title: `${lessons[1][0].titleUz} — mashq` },
    })
    expect(useLessonsStore.getState().byUser[uid][1]).toEqual([0])
  })

  it('keeps other modules directly available for review on the continuous path', () => {
    useLessonsStore.setState({ byUser: { [uid]: { 2: [0] } } })
    render(<Darslik />)
    expect(pathButtons(2)).toHaveLength(lessons[2].length * 2)
    fireEvent.click(pathButtons(2)[0])
    expect(screen.getByRole('dialog')).toHaveAccessibleName(lessons[2][0].titleUz)
    expect(screen.getByRole('button', { name: 'Qayta o‘qish' })).toBeEnabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses Russian labels and handles a completed module without a current step', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'ru' } })
    useLessonsStore.setState({ byUser: { [uid]: { 1: lessons[1].map((_, i) => i) } } })
    render(<Darslik />)
    expect(screen.getByText('Модуль пройден!')).toBeInTheDocument()
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
