import React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LearningGuide } from '../../../src/features/dashboard/components/LearningGuide'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'

beforeEach(() => {
  useSubjectStore.getState().setSubject('yhq')
  useTestSessionStore.getState().clear()
  useLessonsStore.setState({ byUser: {} })
})

it.each([
  ['uz', 'Xatolar ustida ishlang', 'Xato qilgan savollaringizni qayta yeching.', 'Takrorlash'],
  ['ru', 'Работа над ошибками', 'Решите заново вопросы с ошибками.', 'Повторить'],
] as const)('shows concise mistake review copy in %s', (language, title, hint, action) => {
  useSubjectStore.getState().setSubject('rustili')
  useQuestionsStore.setState({ subjectId: 'rustili', loaded: true, questions: [], topics: [] })
  useAppStore.setState((s) => ({ settings: { ...s.settings, language } }))
  render(<MemoryRouter><LearningGuide mistakesCount={3} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: title })).toBeVisible()
  expect(screen.getByText(hint)).toBeVisible()
  expect(screen.getByRole('button', { name: action })).toBeVisible()
})

describe.each([
  ['uz', 'Keyingi mavzu', 'Darsni boshlash', 'Tugallanmagan test', 'Testni davom ettirish', 'Test vaqti tugagan'],
  ['ru', 'Следующая тема', 'Начать урок', 'Незавершённый тест', 'Продолжить тест', 'Время теста истекло'],
] as const)('learning guide context in %s', (language, nextTopic, startLesson, pendingTest, continueTest, expired) => {
  beforeEach(() => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, language } }))
  })

  it('explains that a new topic opens a lesson', () => {
    render(<MemoryRouter><LearningGuide mistakesCount={0} /></MemoryRouter>)
    expect(screen.getByText(nextTopic)).toBeVisible()
    expect(screen.getByRole('button', { name: startLesson })).toBeVisible()
  })

  it.each([false, true])('distinguishes a saved test from a lesson (expired=%s)', (isExpired) => {
    useTestSessionStore.getState().save({
      key: 'all', subjectId: 'yhq', mode: null, title: 'Saved topic', questionIds: [1],
      current: 0, answers: [null], selected: [null], finished: false,
      startedAt: Date.now() - (isExpired ? 60 * 60 * 1000 : 0),
    })
    render(<MemoryRouter><LearningGuide mistakesCount={0} /></MemoryRouter>)
    if (isExpired) {
      expect(screen.getByText(expired)).toBeVisible()
      expect(screen.queryByRole('button', { name: continueTest })).not.toBeInTheDocument()
      expect(screen.queryByText(pendingTest)).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(pendingTest)).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Saved topic' })).toBeVisible()
      expect(screen.getByRole('button', { name: continueTest })).toBeVisible()
    }
  })
})
