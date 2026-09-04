import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LearningGuide } from '../../../src/features/dashboard/components/LearningGuide'
import { resumeRouteState } from '../../../src/features/dashboard/next-step'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useTestSessionStore } from '../../../src/shared/store/useTestSessionStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useLessonsStore } from '../../../src/shared/store/useLessonsStore'
import { makeSessionKey, type TestSessionSnapshot } from '../../../src/shared/lib/test-session'

const appState = vi.hoisted(() => ({ solvedQuestions: [] as string[] }))
vi.mock('../../../src/shared/store/useAppStore', () => ({
  useAppStore: (select: (s: unknown) => unknown) => select({ user: { id: 'learner' }, settings: { language: 'uz' }, solvedQuestions: appState.solvedQuestions }),
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
  appState.solvedQuestions = []
  useSubjectStore.getState().setSubject('yhq')
  useTestSessionStore.getState().clear()
  useLessonsStore.setState({ byUser: {} })
  useQuestionsStore.setState({ questions: [], topics: [], loaded: false, subjectId: 'yhq' })
})

describe('learning guide', () => {
  it('offers results for an expired session while preserving its route and answers', () => {
    const expired = { ...snapshot, startedAt: Date.now() - 26 * 60 * 1000 }
    useTestSessionStore.getState().save(expired)
    guide()
    expect(screen.getByRole('heading', { name: 'Test vaqti tugagan' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Natijani ko‘rish' }))
    const target = JSON.parse(screen.getByTestId('destination').textContent!)
    expect(target.path).toBe('/test/1')
    expect(makeSessionKey(target.state.mode, target.state.questionIds)).toBe(snapshot.key)
    expect(useTestSessionStore.getState().session?.answers).toEqual(snapshot.answers)
  })

  it('shows actual modules and starts the displayed module', () => {
    guide()
    expect(screen.queryByText('Testni davom ettiring')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /O‘rganish/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(screen.getByText('Chorrahalar')).toBeInTheDocument()
    expect(JSON.parse(screen.getByTestId('destination').textContent!)).toEqual({path: '/darslik', state: {moduleId: 1}})
  })
  it('explains and opens the current-subject mistake recommendation', () => {
    useSubjectStore.getState().setSubject('rustili')
    guide(7)
    expect(screen.getByText(/Oldingi xatolaringizni/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xatolarni takrorlash' }))
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
  it('starts only questions belonging to the displayed subject topic', () => {
    useSubjectStore.getState().setSubject('rustili')
    useQuestionsStore.setState({loaded: true, subjectId: 'rustili', topics: [
      {id: 10, nameUz: 'Fonetika', nameRu: 'Фонетика', slug: 'phonetics'},
      {id: 20, nameUz: 'Morfologiya', nameRu: 'Морфология', slug: 'morphology'},
    ], questions: [
      {id: 101, topicId: 10, text: 'A', image: null, options: []},
      {id: 202, topicId: 20, text: 'B', image: null, options: []},
    ]})
    guide()
    expect(screen.getByRole('heading', {name: 'Fonetika'})).toBeInTheDocument()
    expect(screen.getByText('Morfologiya')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Boshlash'}))
    expect(JSON.parse(screen.getByTestId('destination').textContent!)).toEqual({path:'/test/1',state:{questionIds:[101],title:'Fonetika'}})
    fireEvent.click(screen.getByRole('button', {name: 'Morfologiya'}))
    expect(JSON.parse(screen.getByTestId('destination').textContent!)).toEqual({path:'/test/1',state:{questionIds:[202],title:'Morfologiya'}})
  })
  it('never displays cached topics from another subject', () => {
    useSubjectStore.getState().setSubject('rustili')
    useQuestionsStore.setState({loaded: true, subjectId: 'yhq', topics: [{id: 1, nameUz: 'Old topic', nameRu: 'Old topic', slug: 'old'}], questions: [{id: 1, topicId: 1, text: 'A', image: null, options: []}]})
    guide()
    expect(screen.queryByText('Old topic')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Boshlash'})).not.toBeInTheDocument()
  })
  function twoTopics() {
    useSubjectStore.getState().setSubject('rustili')
    useQuestionsStore.setState({loaded: true, subjectId: 'rustili', topics: [
      {id: 10, nameUz: 'Fonetika', nameRu: 'Фонетика', slug: 'phonetics'},
      {id: 20, nameUz: 'Morfologiya', nameRu: 'Морфология', slug: 'morphology'},
    ], questions: [
      {id: 101, topicId: 10, text: 'A', image: null, options: []},
      {id: 102, topicId: 10, text: 'B', image: null, options: []},
      {id: 202, topicId: 20, text: 'C', image: null, options: []},
    ]})
  }
  it('advances only after all topic questions have been answered and survives remount', () => {
    twoTopics()
    appState.solvedQuestions = ['rustili:101']
    const view = guide()
    expect(screen.getByRole('heading', {name: 'Fonetika'})).toBeInTheDocument()
    appState.solvedQuestions = ['rustili:101', 'rustili:102']
    view.unmount()
    guide()
    expect(screen.getByRole('heading', {name: 'Morfologiya'})).toBeInTheDocument()
    expect(screen.getByText(/Tugallangan mavzular/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: /Davom/}))
    expect(JSON.parse(screen.getByTestId('destination').textContent!)).toEqual({path:'/test/1',state:{questionIds:[202],title:'Morfologiya'}})
  })
  it('does not count answers from a different subject', () => {
    twoTopics()
    appState.solvedQuestions = ['yhq:101', 'yhq:102']
    guide()
    expect(screen.getByRole('heading', {name: 'Fonetika'})).toBeInTheDocument()
    expect(screen.queryByText(/Tugallangan mavzular/)).not.toBeInTheDocument()
  })
  it('shows a completed state rather than silently restarting the course', () => {
    twoTopics()
    appState.solvedQuestions = ['rustili:101', 'rustili:102', 'rustili:202']
    guide()
    expect(screen.getByRole('heading', {name: 'Barcha mavzular tugallandi!'})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Boshlash'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Qayta takrorlash'}))
    expect(JSON.parse(screen.getByTestId('destination').textContent!).state.questionIds).toEqual([101,102])
  })
  it('moves to the next YHQ module and preserves lesson access checks', () => {
    useLessonsStore.setState({byUser: {learner: {1: [0,1,2,3,4,5,6]}}})
    guide()
    expect(screen.getByRole('heading', {name: 'Chorrahalar'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: /Davom/}))
    expect(JSON.parse(screen.getByTestId('destination').textContent!)).toEqual({path:'/darslik',state:{moduleId:2}})
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
