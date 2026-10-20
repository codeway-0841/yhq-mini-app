import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import RussianDarslikPage from '../../../src/features/darslik-rustili/RussianDarslikPage'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { api } from '../../../src/shared/api'
import type {
  DarslikAnswerValue,
  DarslikCheckResult,
  DarslikPublicCheck,
} from '../../../shared/darslik-mastery'
import { DARSLIK_PROGRESS_MODULE_OFFSET, getBlockOutline } from '../../../src/content/darslik-rustili'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => navigate,
}))

const uid = 'rus-darslik-pilot-test'
const moduleIdOf = (blockId: number) => DARSLIK_PROGRESS_MODULE_OFFSET + blockId
const pathNode = (blockId: number, idx: number) =>
  document.querySelector<HTMLButtonElement>(`[data-path-node][data-module="${blockId}"][data-lesson="${idx}"]`)!

const CHECK: DarslikPublicCheck = {
  format: 'lesson',
  questions: [
    {
      id: 'p1', kind: 'mcq', prompt: 'Что мы произносим и слышим?',
      options: ['Буквы', 'Звуки', 'Знаки', 'Слоги'],
    },
    { id: 'p2', kind: 'input', prompt: 'Сколько звуков в слове «дом»?' },
    {
      id: 'p3', kind: 'word_bank', prompt: 'Собери правило о буквах.',
      tokens: ['Буквы', 'мы', 'видим', 'и', 'пишем', 'слышим'],
    },
    {
      id: 'p4', kind: 'match', prompt: 'Сопоставь слово и количество звуков.',
      left: ['дом', 'ёлка', 'юла'],
      right: ['5 звуков', '3 звука', '4 звука'],
    },
    {
      id: 'p5', kind: 'listening', prompt: 'Слушай слово. Сколько в нём звуков?',
      options: ['3', '4', '5', '6'], audioText: 'ёлка',
    },
  ],
}

const EXPECTED: Record<string, DarslikAnswerValue> = {
  p1: '1',
  p2: '3',
  p3: ['Буквы', 'мы', 'видим', 'и', 'пишем'],
  p4: ['3 звука', '5 звуков', '4 звука'],
  p5: '2',
}

const PASSED: DarslikCheckResult = {
  passed: true,
  correct: 5,
  total: 5,
  accuracy: 100,
  xpEarned: 30,
  xp: 130,
  dailyStreak: 3,
  alreadyPassed: false,
  feedback: CHECK.questions.map(question => ({
    id: question.id,
    correct: true,
    explanation: 'Изох ' + question.id,
    correctAnswer: '—',
  })),
}

async function continueExercise(runner: HTMLElement) {
  fireEvent.click(within(runner).getByRole('button', { name: 'Davom etish' }))
  await waitFor(() => expect(within(runner).queryByTestId('lesson-feedback')).not.toBeInTheDocument())
}

async function advanceToPractice(reader: HTMLElement) {
  await waitFor(() => expect(within(reader).getByTestId('micro-lesson-card')).toBeInTheDocument())
  for (let step = 0; step < 20; step++) {
    const next = within(reader).queryByRole('button', { name: 'Davom etish' })
    if (!next) break
    fireEvent.click(next)
  }
  return within(reader).getByRole('button', { name: 'Mashqni boshlash' })
}

async function completePilotLesson(runner: HTMLElement) {
  fireEvent.click(within(runner).getByRole('button', { name: 'Звуки' }))
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  await within(runner).findByTestId('lesson-feedback')
  await continueExercise(runner)

  fireEvent.change(within(runner).getByPlaceholderText('Javobingizni yozing'), { target: { value: '3' } })
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  await within(runner).findByTestId('lesson-feedback')
  await continueExercise(runner)

  for (const token of ['Буквы', 'мы', 'видим', 'и', 'пишем']) {
    fireEvent.click(within(runner).getByRole('button', { name: token, exact: true }))
  }
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  await within(runner).findByTestId('lesson-feedback')
  await continueExercise(runner)

  fireEvent.click(within(runner).getByRole('button', { name: /^дом/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '3 звука' }))
  fireEvent.click(within(runner).getByRole('button', { name: /^ёлка/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '5 звуков' }))
  fireEvent.click(within(runner).getByRole('button', { name: /^юла/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '4 звука' }))
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  await within(runner).findByTestId('lesson-feedback')
  await continueExercise(runner)

  fireEvent.click(within(runner).getByRole('button', { name: '5', exact: true }))
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  await within(runner).findByTestId('lesson-feedback')
  fireEvent.click(within(runner).getByRole('button', { name: 'Yakunlash' }))
}

beforeEach(() => {
  navigate.mockReset()
  useLessonsStore.setState({ byUser: {}, readByUser: {} })
  useAppStore.setState({
    tariff: 'premium',
    user: { id: uid, firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
  vi.spyOn(api, 'getDarslikProgress').mockResolvedValue({ passed: [] })
  vi.spyOn(api, 'getDarslikCheck').mockResolvedValue(CHECK)
  vi.spyOn(api, 'checkDarslikExercise').mockImplementation(async (_topicId, exerciseId, answer) => {
    const expected = EXPECTED[exerciseId]
    const actual = Array.isArray(expected) ? (Array.isArray(answer) ? answer : [answer]) : answer
    return {
      correct: JSON.stringify(actual) === JSON.stringify(expected),
      explanation: 'Изох ' + exerciseId,
      correctAnswer: '—',
    }
  })
  vi.spyOn(api, 'submitDarslikCheck').mockResolvedValue(PASSED)
  vi.spyOn(api, 'getAchievements').mockRejectedValue(new Error('achievements skipped'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RussianDarslikPage — v2 pilot darsi', () => {
  it('v2 dars pass bo‘lgach keyingi mavzuni ochadi va reader’ni suradi', async () => {
    render(<RussianDarslikPage />)
    await waitFor(() => expect(api.getDarslikProgress).toHaveBeenCalled())

    expect(pathNode(1, 1)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(pathNode(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'Boshlash' }))

    const reader = document.querySelector('.lesson-reader') as HTMLElement
    await waitFor(() => expect(reader.textContent).toContain(`1-blok · 1/${getBlockOutline(1).length}`))
    fireEvent.click(await advanceToPractice(reader))

    const runner = await screen.findByTestId('lesson-runner')
    await completePilotLesson(runner)

    const result = await screen.findByTestId('lesson-result')
    expect(within(result).getByText('Dars yakunlandi!')).toBeInTheDocument()

    // Server natijasi lokal mastery'ga tushdi va keyingi tugun ochildi.
    await waitFor(() => expect(pathNode(1, 1)).not.toHaveAttribute('aria-disabled'))
    expect(useLessonsStore.getState().byUser[uid]?.[moduleIdOf(1)]).toContain(0)

    fireEvent.click(within(result).getByRole('button', { name: 'Davom etish' }))
    await waitFor(() => expect(reader.textContent).toContain(`1-blok · 2/${getBlockOutline(1).length}`))
  }, 30_000)
})
