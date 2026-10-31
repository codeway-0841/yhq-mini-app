import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LessonRunner from '../../../src/features/darslik-rustili/LessonRunner'
import { ApiError, api } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useDailyStore } from '../../../src/shared/store/useDailyStore'
import type {
  DarslikAnswerFeedback,
  DarslikAnswerValue,
  DarslikCheckResult,
  DarslikPublicCheck,
} from '../../../shared/darslik-mastery'

const speech = vi.hoisted(() => ({ speak: vi.fn(), stopSpeaking: vi.fn() }))
const analytics = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock('../../../src/shared/lib/speech', () => ({
  speak: speech.speak,
  stopSpeaking: speech.stopSpeaking,
  isSpeaking: () => false,
  subscribeSpeaking: () => () => {},
}))
vi.mock('../../../src/shared/lib/analytics', () => ({
  track: analytics.track,
}))
vi.mock('../../../src/features/ai-tutor', () => ({
  SocraticChatSheet: ({ context, onClose }: { context: { questionText: string; subjectId: string }; onClose: () => void }) => (
    <div data-testid="lesson-tutor"><span>{context.subjectId}: {context.questionText}</span><button onClick={onClose}>Yopish yordam</button></div>
  ),
}))

const CHECK: DarslikPublicCheck = {
  format: 'lesson',
  questions: [
    {
      id: 'q1', kind: 'mcq', prompt: 'Что мы произносим и слышим?',
      options: ['Буквы', 'Звуки', 'Знаки препинания', 'Слоги'],
    },
    {
      id: 'q2', kind: 'input', prompt: 'Сколько звуков в слове «дом»?',
    },
    {
      id: 'q3', kind: 'word_bank', prompt: 'Собери правило о буквах.',
      tokens: ['Буквы', 'мы', 'видим', 'и', 'пишем', 'слышим'],
    },
    {
      id: 'q4', kind: 'match', prompt: 'Сопоставь слово и количество звуков.',
      left: ['дом', 'ёлка', 'юла'],
      right: ['5 звуков', '3 звука', '4 звука'],
    },
    {
      id: 'q5', kind: 'listening', prompt: 'Слушай слово. Сколько в нём звуков?',
      options: ['3', '4', '5', '6'], audioText: 'ёлка',
    },
  ],
}

const EXPECTED: Record<string, DarslikAnswerValue> = {
  q1: '1',
  q2: '3',
  q3: ['Буквы', 'мы', 'видим', 'и', 'пишем'],
  q4: ['3 звука', '5 звуков', '4 звука'],
  q5: '2',
}

const CORRECT_ANSWERS: Record<string, string> = {
  q1: 'Звуки',
  q2: '3',
  q3: 'Буквы мы видим и пишем',
  q4: 'дом → 3 звука; ёлка → 5 звуков; юла → 4 звука',
  q5: '5',
}

function feedbackFor(id: string, correct: boolean): DarslikAnswerFeedback {
  return {
    correct,
    explanation: 'Изох ' + id,
    correctAnswer: CORRECT_ANSWERS[id] ?? '—',
  }
}

function resultFor(passed: boolean): DarslikCheckResult {
  return {
    passed,
    correct: passed ? 5 : 4,
    total: 5,
    accuracy: passed ? 100 : 80,
    xpEarned: passed ? 32 : 0,
    xp: passed ? 132 : 100,
    dailyStreak: passed ? 4 : undefined,
    alreadyPassed: false,
    feedback: CHECK.questions.map(question => ({
      id: question.id,
      correct: true,
      explanation: 'Изох ' + question.id,
      correctAnswer: CORRECT_ANSWERS[question.id],
    })),
  }
}

function renderRunner(overrides: Partial<{
  onClose: () => void
  onPassed: () => void
  onNext: () => void
}> = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onPassed = overrides.onPassed ?? vi.fn()
  const onNext = overrides.onNext ?? vi.fn()
  render(
    <LessonRunner
      topicId="1:0"
      title="ЗВУКИ И БУКВЫ"
      onClose={onClose}
      onPassed={onPassed}
      onNext={onNext}
      hasNext
    />,
  )
  return { onClose, onPassed, onNext }
}

async function continueExercise(runner: HTMLElement) {
  fireEvent.click(within(runner).getByRole('button', { name: 'Davom etish' }))
  await waitFor(() => expect(within(runner).queryByTestId('lesson-feedback')).not.toBeInTheDocument())
}

async function answerMcq(runner: HTMLElement, option: string) {
  fireEvent.click(within(runner).getByRole('button', { name: option }))
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  return within(runner).findByTestId('lesson-feedback')
}

async function answerInput(runner: HTMLElement, value: string) {
  fireEvent.change(within(runner).getByPlaceholderText('Javobingizni yozing'), { target: { value } })
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  return within(runner).findByTestId('lesson-feedback')
}

async function answerWordBank(runner: HTMLElement) {
  for (const token of ['Буквы', 'мы', 'видим', 'и', 'пишем']) {
    fireEvent.click(within(runner).getByRole('button', { name: token, exact: true }))
  }
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  return within(runner).findByTestId('lesson-feedback')
}

async function answerMatch(runner: HTMLElement) {
  fireEvent.click(within(runner).getByRole('button', { name: /^дом/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '3 звука' }))
  fireEvent.click(within(runner).getByRole('button', { name: /^ёлка/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '5 звуков' }))
  fireEvent.click(within(runner).getByRole('button', { name: /^юла/ }))
  fireEvent.click(within(runner).getByRole('button', { name: '4 звука' }))
  fireEvent.click(within(runner).getByRole('button', { name: 'Tekshirish' }))
  return within(runner).findByTestId('lesson-feedback')
}

async function completeLesson(runner: HTMLElement) {
  await answerMcq(runner, 'Звуки')
  await continueExercise(runner)
  await answerInput(runner, '3')
  await continueExercise(runner)
  await answerWordBank(runner)
  await continueExercise(runner)
  await answerMatch(runner)
  await continueExercise(runner)
  fireEvent.click(within(runner).getByRole('button', { name: 'Tinglash' }))
  const listening = await answerMcq(runner, '5')
  expect(listening).toHaveAttribute('data-correct', 'true')
  fireEvent.click(within(runner).getByRole('button', { name: 'Yakunlash' }))
}

beforeEach(() => {
  speech.speak.mockReset()
  speech.stopSpeaking.mockReset()
  analytics.track.mockReset()
  useAppStore.setState({
    tariff: 'premium',
    user: { id: 'lesson-runner-test', firstName: 'Test' } as never,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    xp: 100,
  })
  useDailyStore.setState({ streaks: {}, activityKey: null, coinSaved: false })

  vi.spyOn(api, 'getDarslikCheck').mockResolvedValue(CHECK)
  vi.spyOn(api, 'getAchievements').mockRejectedValue(new Error('achievements skipped in unit test'))
  vi.spyOn(api, 'checkDarslikExercise').mockImplementation(async (_topicId, exerciseId, answer) => {
    const expected = EXPECTED[exerciseId]
    const actual = Array.isArray(expected)
      ? (Array.isArray(answer) ? answer : [answer])
      : answer
    const correct = JSON.stringify(actual) === JSON.stringify(expected)
    return feedbackFor(exerciseId, correct)
  })
  vi.spyOn(api, 'submitDarslikCheck').mockResolvedValue(resultFor(true))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LessonRunner — v2 Duolingo oqimi', () => {
  it('mascot orqali joriy savol konteksti bilan yordamchini ochadi va yopadi', async () => {
    renderRunner()
    const runner = await screen.findByTestId('lesson-runner')
    fireEvent.click(within(runner).getByRole('button', { name: 'AI yordamchidan so‘rash' }))
    const tutor = await screen.findByTestId('lesson-tutor')
    expect(within(tutor).getByText('rustili: Что мы произносим и слышим?')).toBeInTheDocument()
    fireEvent.click(within(tutor).getByRole('button', { name: 'Yopish yordam' }))
    expect(screen.queryByTestId('lesson-tutor')).not.toBeInTheDocument()
  })
  it('xato javob, javobni ko‘rish va izohni alohida ko‘rsatadi', async () => {
    const { onPassed } = renderRunner()
    const runner = await screen.findByTestId('lesson-runner')
    const feedback = await answerMcq(runner, 'Буквы')
    expect(feedback).toHaveAttribute('data-correct', 'false')
    expect(within(feedback).queryByText('Звуки')).not.toBeInTheDocument()
    fireEvent.click(within(runner).getByRole('button', { name: 'Javobni ko‘rish' }))
    expect(feedback).toHaveAttribute('data-revealed', 'true')
    expect(within(feedback).getByText('Звуки')).toBeInTheDocument()
    expect(within(runner).getByRole('button', { name: 'Звуки' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(runner).getByRole('button', { name: 'Nima uchun?' }))
    expect(await screen.findByText('Изох q1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tushundim' }))
    fireEvent.click(within(runner).getByRole('button', { name: 'Izohni o‘tkazish' }))
    await waitFor(() => expect(within(runner).getByText('2/5')).toBeInTheDocument())
    expect(onPassed).not.toHaveBeenCalled()
  })

  it('xatodan keyin qayta urinishda yangi javobni serverga tekshirtiradi', async () => {
    renderRunner()
    const runner = await screen.findByTestId('lesson-runner')
    await answerMcq(runner, 'Буквы')
    fireEvent.click(within(runner).getByRole('button', { name: 'Qayta urinish' }))
    expect(within(runner).getByRole('button', { name: 'Tekshirish' })).toBeDisabled()
    const feedback = await answerMcq(runner, 'Звуки')
    expect(feedback).toHaveAttribute('data-correct', 'true')
    expect(api.checkDarslikExercise).toHaveBeenLastCalledWith('1:0', 'q1', '1')
    fireEvent.click(within(runner).getByRole('button', { name: 'Nima uchun?' }))
    expect(await screen.findByText('Изох q1')).toBeInTheDocument()
  })

  it('javobni ko‘rish foydalanuvchining javobini almashtirmaydi', async () => {
    vi.mocked(api.getDarslikCheck).mockResolvedValue({ format: 'lesson', questions: [CHECK.questions[0]] })
    vi.mocked(api.submitDarslikCheck).mockResolvedValue(resultFor(false))
    const { onPassed } = renderRunner()
    const runner = await screen.findByTestId('lesson-runner')
    await answerMcq(runner, 'Буквы')
    fireEvent.click(within(runner).getByRole('button', { name: 'Javobni ko‘rish' }))
    fireEvent.click(within(runner).getByRole('button', { name: 'Izohni o‘tkazish' }))
    await screen.findByTestId('lesson-result')
    expect(api.submitDarslikCheck).toHaveBeenCalledWith('1:0', { q1: '0' })
    expect(onPassed).not.toHaveBeenCalled()
  })

  it('5 turdagi mashqni o‘tib, natija ekranida aniqlik, XP va streakni ko‘rsatadi', async () => {
    const onPassed = vi.fn()
    const onNext = vi.fn()
    renderRunner({ onPassed, onNext })
    const runner = await screen.findByTestId('lesson-runner')

    await answerMcq(runner, 'Звуки')
    expect(within(runner).getByText('To‘g‘ri!')).toBeInTheDocument()
    await continueExercise(runner)

    await answerInput(runner, '3')
    expect(within(runner).getByText('To‘g‘ri!')).toBeInTheDocument()
    await continueExercise(runner)

    await answerWordBank(runner)
    expect(within(runner).getByText('To‘g‘ri!')).toBeInTheDocument()
    await continueExercise(runner)

    await answerMatch(runner)
    expect(within(runner).getByText('To‘g‘ri!')).toBeInTheDocument()
    await continueExercise(runner)

    expect(within(runner).getByText('5/5')).toBeInTheDocument()
    fireEvent.click(within(runner).getByRole('button', { name: 'Tinglash' }))
    expect(speech.speak).toHaveBeenCalledWith('ёлка', 'ru')
    await answerMcq(runner, '5')
    expect(within(runner).getByTestId('lesson-combo')).toBeInTheDocument()
    fireEvent.click(within(runner).getByRole('button', { name: 'Yakunlash' }))

    const result = await screen.findByTestId('lesson-result')
    expect(within(result).getByText('Dars yakunlandi!')).toBeInTheDocument()
    expect(within(result).getByText('100%')).toBeInTheDocument()
    expect(within(result).getByText('+32')).toBeInTheDocument()
    expect(within(result).getByText('4')).toBeInTheDocument()
    expect(onPassed).toHaveBeenCalledTimes(1)
    expect(api.submitDarslikCheck).toHaveBeenCalledWith('1:0', expect.objectContaining({
      q1: '1',
      q2: '3',
      q3: ['Буквы', 'мы', 'видим', 'и', 'пишем'],
      q4: ['3 звука', '5 звуков', '4 звука'],
      q5: '2',
    }))
    expect(useAppStore.getState().xp).toBe(132)
    expect(useDailyStore.getState().streaks.rustili).toBe(4)
    expect(analytics.track).toHaveBeenCalledWith('lesson_start', expect.any(Object))
    expect(analytics.track).toHaveBeenCalledWith('exercise_answer', expect.objectContaining({ correct: true }))
    expect(analytics.track).toHaveBeenCalledWith('lesson_complete', expect.any(Object))
    expect(analytics.track).toHaveBeenCalledWith('check_passed', expect.any(Object))

    fireEvent.click(within(result).getByRole('button', { name: 'Davom etish' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('submitda 409 bo‘lsa darsni yangi revision bilan qayta yuklaydi', async () => {
    const revision = 'c'.repeat(64)
    vi.mocked(api.getDarslikCheck).mockResolvedValue({ ...CHECK, revision })
    vi.mocked(api.submitDarslikCheck).mockRejectedValueOnce(
      new ApiError(409, 'PRACTICE_CHANGED', 'PRACTICE_CHANGED'),
    )
    const onPassed = vi.fn()
    renderRunner({ onPassed })
    const runner = await screen.findByTestId('lesson-runner')

    await completeLesson(runner)

    await waitFor(() => expect(api.getDarslikCheck).toHaveBeenCalledTimes(2))
    const reloaded = await screen.findByTestId('lesson-runner')
    expect(within(reloaded).getByTestId('lesson-updated')).toBeInTheDocument()
    expect(within(reloaded).getByText(/Dars yangilandi/)).toBeInTheDocument()
    expect(api.submitDarslikCheck).toHaveBeenCalledWith(
      '1:0',
      expect.objectContaining({ q1: '1' }),
      revision,
    )
    expect(onPassed).not.toHaveBeenCalled()
  })

  it('pass bo‘lmasa retry boshlanadi va keyingi mavzu chaqirilmaydi', async () => {
    vi.mocked(api.submitDarslikCheck).mockResolvedValue(resultFor(false))
    const onPassed = vi.fn()
    const onNext = vi.fn()
    renderRunner({ onPassed, onNext })
    const runner = await screen.findByTestId('lesson-runner')

    await completeLesson(runner)
    const result = await screen.findByTestId('lesson-result')
    expect(within(result).getByText('Dars yakunlanmadi')).toBeInTheDocument()
    expect(within(result).getByText('80%')).toBeInTheDocument()
    expect(onPassed).not.toHaveBeenCalled()
    expect(analytics.track).toHaveBeenCalledWith('check_failed', expect.any(Object))

    fireEvent.click(within(result).getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByText('Что мы произносим и слышим?')).toBeInTheDocument()
    expect(within(screen.getByTestId('lesson-runner')).getByText('1/5')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('maskotni avatar variantida (yasama qovoqlarsiz) ko‘rsatadi va javob holatiga moslashtiradi', async () => {
    renderRunner()
    const runner = await screen.findByTestId('lesson-runner')
    const mascotIdle = runner.querySelector('.learning-mascot')
    expect(mascotIdle).toHaveAttribute('data-variant', 'avatar')
    expect(mascotIdle).toHaveAttribute('data-animation', 'idle')
    expect(runner.querySelector('.learning-mascot-eyelid')).toBeNull()

    await answerMcq(runner, 'Звуки')
    const mascotHappy = runner.querySelector('.learning-mascot')
    expect(mascotHappy).toHaveAttribute('data-variant', 'avatar')
    expect(mascotHappy).toHaveAttribute('data-animation', 'happy')
  })
})
