import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LearningGuide } from '../../../src/features/dashboard/components/LearningGuide'
import { resumeRouteState } from '../../../src/features/dashboard/next-step'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { makeSessionKey, type TestSessionSnapshot } from '../../../src/shared/lib/test-session'

vi.mock('../../../src/shared/store/useAppStore', () => ({
  useAppStore: (select: (s: unknown) => unknown) => select({ user: { id: 'learner' }, settings: { language: 'uz' } }),
}))
const snapshot: TestSessionSnapshot = {
  key: 'ids:1,2,3', subjectId: 'yhq', mode: null, title: 'Test', questionIds: [3,1,2],
  current: 1, answers: ['correct', null, null], selected: ['a', null, null], startedAt: Date.now(), finished: false,
}
function Location() {
  const location = useLocation()
  return <output data-testid="destination">{JSON.stringify({ path: location.pathname, state: location.state })}</output>
}
function guide(mistakesCount = 0) {
  return render(<MemoryRouter><LearningGuide mistakesCount={mistakesCount} /><Location /></MemoryRouter>)
}
beforeEach(() => {
  useSubjectStore.getState().setSubject('yhq')
  useTestSessionStore.getState().clear()
  useLessonsStore.setState({ byUser: {} })
})

describe('learning guide', () => {
  it('offers a first test and two clear paths without a fake resume', () => {
    guide()
    expect(screen.queryByText('Testni davom ettiring')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /O‘rganish/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/testlar')
  })
  it('explains and opens the current-subject mistake recommendation', () => {
    guide(7)
    expect(screen.getByText(/Oldingi xatolaringizni/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/xatolar')
  })
  it('resumes the original session key even when the stored questions were shuffled', () => {
    useTestSessionStore.getState().save(snapshot)
    guide()
    fireEvent.click(screen.getByRole('button', { name: /Davom/ }))
    const target = JSON.parse(screen.getByTestId('destination').textContent!)
    expect(target.path).toBe('/test/1')
    expect(makeSessionKey(target.state.mode, target.state.questionIds)).toBe(snapshot.key)
  })
  it('shows only one primary start action when a test and mistakes both exist', () => {
    useTestSessionStore.getState().save(snapshot)
    guide(7)
    expect(screen.queryByRole('button', { name: 'Boshlash' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Davom/ }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/test/1')
  })
  it('opens lesson path without bypassing its lesson access checks', () => {
    useLessonsStore.setState({ byUser: { learner: { 1: [0] } } })
    guide()
    fireEvent.click(screen.getByRole('button', { name: /Davom/ }))
    const target = JSON.parse(screen.getByTestId('destination').textContent!)
    expect(target).toEqual({ path: '/darslik', state: { moduleId: 1 } })
  })
  it('does not suggest YHQ lesson progress for another subject', () => {
    useSubjectStore.getState().setSubject('rustili')
    useLessonsStore.setState({ byUser: { learner: { 1: [0] } } })
    guide()
    expect(screen.queryByText('O‘qishni davom ettiring')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /O‘rganish/ }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/mavzular')
  })
  it('keeps every extra mode reachable', () => {
    guide()
    fireEvent.click(screen.getByRole('button', { name: 'Barcha rejimlar' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/rejimlar')
  })
})
describe('resume eligibility', () => {
  it('excludes finished, empty, mismatched-subject and invalid-key snapshots', () => {
    expect(resumeRouteState({ ...snapshot, finished: true }, 'yhq')).toBeNull()
    expect(resumeRouteState({ ...snapshot, questionIds: [] }, 'yhq')).toBeNull()
    expect(resumeRouteState(snapshot, 'rustili')).toBeNull()
    expect(resumeRouteState({ ...snapshot, key: 'ids:nope' }, 'yhq')).toBeNull()
  })
  it('preserves mode-based and whole-bank resume keys', () => {
    expect(resumeRouteState({ ...snapshot, mode: 'numeric', key: 'mode:numeric' }, 'yhq')?.mode).toBe('numeric')
    const state = resumeRouteState({ ...snapshot, key: 'all' }, 'yhq')!
    expect(makeSessionKey(state.mode, state.questionIds)).toBe('all')
  })
})
