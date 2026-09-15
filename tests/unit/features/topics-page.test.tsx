/**
 * TopicsPage — har fanda O'Z mavzulari (2026-09-15 "hamma fanda bir xil" fix).
 * YHQ curated ko'rinishda qoladi, boshqa fanlar server topics'dan.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import TopicsPage from '../../../src/features/topics/TopicsPage'
import { config } from '../../../src/shared/config'
import { api } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'

const FIZIKA_TOPICS = [
  { id: 1, nameUz: 'Kinematika', nameRu: 'Кинематика', slug: 'kinematika' },
  { id: 2, nameUz: 'Dinamika', nameRu: 'Динамика', slug: 'dinamika' },
]
const FIZIKA_QUESTIONS = [
  { id: 11, text: 'q1', image: null, options: [], topicId: 1 },
  { id: 12, text: 'q2', image: null, options: [], topicId: 1 },
  { id: 21, text: 'q3', image: null, options: [], topicId: 2 },
]

function setFizikaLoaded() {
  useSubjectStore.getState().setSubject('fizika')
  useQuestionsStore.setState({
    questions: FIZIKA_QUESTIONS,
    topics: FIZIKA_TOPICS,
    loaded: true,
    loading: false,
    error: null,
    subjectId: 'fizika',
    lang: 'uz',
    failedKey: null,
  })
}

beforeEach(() => {
  mockNavigate.mockReset()
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    solvedQuestions: [],
  })
})

describe('TopicsPage — fan bo\'yicha mavzular', () => {
  it('fizikada FIZIKA mavzulari chiqadi, YHQ modullari yo\'q', () => {
    setFizikaLoaded()
    render(<TopicsPage />)

    expect(screen.getByText('Kinematika')).toBeInTheDocument()
    expect(screen.getByText('Dinamika')).toBeInTheDocument()
    expect(screen.queryByText('Chorrahalar')).toBeNull()
    expect(screen.queryByText("Yo'l belgilari")).toBeNull()
  })

  it('mavzu bosilganda shu mavzu savollari bilan test ochiladi', () => {
    setFizikaLoaded()
    render(<TopicsPage />)

    fireEvent.click(screen.getByText('Kinematika'))

    expect(mockNavigate).toHaveBeenCalledWith('/test/1', {
      state: { questionIds: [11, 12], title: 'Kinematika' },
    })
  })

  it('yechilganlar progressda ko\'rinadi (1/2)', () => {
    setFizikaLoaded()
    useAppStore.setState({ solvedQuestions: ['fizika:11'] })
    render(<TopicsPage />)

    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('YHQ da curated modullar qoladi', () => {
    useSubjectStore.getState().setSubject('yhq')
    render(<TopicsPage />)

    expect(screen.queryByText('Kinematika')).toBeNull()
    // Header + YHQ modullaridan kamida bittasi
    expect(screen.getByRole('heading', { name: 'Mavzular' })).toBeInTheDocument()
  })

  it('xatoda qayta urinish tugmasi chiqadi', () => {
    useSubjectStore.getState().setSubject('fizika')
    useQuestionsStore.setState({
      questions: [],
      topics: [],
      loaded: false,
      loading: false,
      error: 'boom',
      subjectId: 'fizika',
      lang: 'uz',
      failedKey: 'fizika::uz',
    })
    render(<TopicsPage />)

    expect(screen.getByText(/Savollarni yuklab bo'lmadi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Qayta urinish/ })).toBeInTheDocument()
  })
})

describe('TopicsPage v2 (metadata-only)', () => {
  beforeEach(() => {
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = true
  })

  afterEach(() => {
    ;(config as { testSessionsV2Enabled: boolean }).testSessionsV2Enabled = false
  })

  function setFizikaMeta() {
    useSubjectStore.getState().setSubject('fizika')
    useQuestionsStore.setState({
      questions: [],
      topics: [
        { id: 1, nameUz: 'Kinematika', nameRu: 'Кинематика', slug: 'kinematika', questionCount: 2 },
        { id: 2, nameUz: 'Dinamika', nameRu: 'Динамика', slug: 'dinamika', questionCount: 1 },
      ],
      loaded: false,
      loading: false,
      error: null,
      subjectId: 'fizika',
      lang: 'uz',
      failedKey: null,
    })
  }

  it('savollarsiz metadata-dan mavzular chiqadi', () => {
    setFizikaMeta()
    render(<TopicsPage />)

    expect(screen.getByText('Kinematika')).toBeInTheDocument()
    expect(screen.getByText('Dinamika')).toBeInTheDocument()
    // Savol-darajali progress metadata'da yo'q — chiziq ko'rinmaydi
    expect(screen.queryByText('1/2')).toBeNull()
  })

  it('mavzu bosilganda server topic selector bilan ochiladi (master ID YO\'Q)', () => {
    setFizikaMeta()
    render(<TopicsPage />)

    fireEvent.click(screen.getByText('Kinematika'))

    expect(mockNavigate).toHaveBeenCalledWith('/test/1', {
      state: {
        mode: 'topic',
        serverSelector: { type: 'topic', topicId: 1 },
        title: 'Kinematika',
      },
    })
  })

  it('progress chizig\'i server agregatidan chiqadi (savollarsiz)', async () => {
    useAppStore.setState({ user: { id: 'u1', firstName: 'A' } as never })
    const progressSpy = vi.spyOn(api, 'getTopicProgress').mockResolvedValue({
      subjectId: 'fizika',
      topics: [{ topicId: 1, solved: 1 }],
    })
    setFizikaMeta()
    render(<TopicsPage />)

    expect(await screen.findByText('1/2')).toBeTruthy()
    expect(progressSpy).toHaveBeenCalledWith('u1', 'fizika')
  })
})
