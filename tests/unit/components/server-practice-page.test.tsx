import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { api, ApiError } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useServerTestSessionStore } from '../../../src/shared/store/useServerTestSessionStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import ServerPracticePage from '../../../src/features/test/ServerPracticePage'

const SESSION_ID = '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa'
const EXPIRES = '2027-09-08T12:00:00.000Z'

describe('ServerPracticePage vertical slice', () => {
  beforeEach(() => {
    useServerTestSessionStore.getState().clear()
    useSubjectStore.setState({ subjectId: 'yhq' })
    useAppStore.setState({
      user: { id: 'user-1', firstName: 'Test', tariff: 'free', lastName: undefined, username: undefined, photoUrl: undefined, phone: undefined },
      settings: { ...useAppStore.getState().settings, language: 'uz' },
    })
    vi.spyOn(api, 'createTestSession').mockResolvedValue({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 0, total: 20, expiresAt: EXPIRES },
      questions: [{
        position: 0,
        deliveryToken: 'v1.delivery-token-for-position-zero',
        expiresAt: EXPIRES,
        text: 'Server bergan savol',
        options: [{ id: 'F1', text: 'Variant bir' }, { id: 'F2', text: 'Variant ikki' }],
        media: null,
        topic: null,
      }],
      review: [],
    })
    vi.spyOn(api, 'savedQuestionPositions').mockResolvedValue({ savedPositions: [] })
    vi.spyOn(api, 'toggleSavedQuestion').mockResolvedValue({ ok: true, saved: true })
    vi.spyOn(api, 'getSessionExplanation').mockResolvedValue({ text: 'Chunki shunday' })
    vi.spyOn(api, 'submitTestSessionAnswer').mockResolvedValue({
      attempt: {
        position: 0,
        correct: true,
        correctOptionId: 'F1',
        duplicate: false,
        dailyStreak: 1,
        xp: 10,
        xpEarned: 10,
        coinsEarned: 1,
        coinBalance: 1,
        coinSaved: false,
      },
      append: [{
        position: 1,
        deliveryToken: 'v1.delivery-token-for-position-one',
        expiresAt: EXPIRES,
        text: 'Keyingi server savoli',
        options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
        media: null,
        topic: null,
      }],
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 1, total: 20, expiresAt: EXPIRES },
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('submits only session position + delivery proof and appends the next question', async () => {
    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Variant bir'))

    await waitFor(() => expect(api.submitTestSessionAnswer).toHaveBeenCalledTimes(1))
    const [, payload] = vi.mocked(api.submitTestSessionAnswer).mock.calls[0]!
    expect(payload).toMatchObject({
      position: 0,
      deliveryToken: 'v1.delivery-token-for-position-zero',
      selectedOptionId: 'F1',
    })
    expect(payload).not.toHaveProperty('questionId')
    expect(await screen.findByText('Keyingi server savoli')).toBeInTheDocument()
    expect(useServerTestSessionStore.getState().snapshot?.answers[0]).toBe('correct')
  })

  it('uses the selected bounded random mode when creating a session', async () => {
    vi.mocked(api.createTestSession).mockResolvedValueOnce({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 0, total: 20, expiresAt: EXPIRES },
      questions: [{
        position: 0,
        deliveryToken: 'v1.delivery-token-for-position-zero',
        expiresAt: EXPIRES,
        text: '20 talik server testi',
        options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
        media: null,
        topic: null,
      }],
      review: [],
    })

    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('20 talik server testi')).toBeInTheDocument()
    expect(api.createTestSession).toHaveBeenCalledWith(expect.objectContaining({
      selector: { type: 'random', count: 20 },
    }))
    expect(useServerTestSessionStore.getState().snapshot?.mode).toBe('random20')
  })

  it('requests saved practice without sending bookmark question IDs', async () => {
    render(<MemoryRouter><ServerPracticePage mode="saved" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    expect(api.createTestSession).toHaveBeenCalledWith({
      subjectId: 'yhq', selector: { type: 'saved' }, language: 'uz',
    })
  })

  it('requests unresolved mistakes without sending client question IDs', async () => {
    render(<MemoryRouter><ServerPracticePage mode="mistakes" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    expect(api.createTestSession).toHaveBeenCalledWith({
      subjectId: 'yhq', selector: { type: 'mistakes' }, language: 'uz',
    })
  })

  it('passes a validated topic selector without exposing its mapped question IDs', async () => {
    render(
      <MemoryRouter>
        <ServerPracticePage mode="topic" selector={{ type: 'topic', topicId: 77 }} title="Fizika bileti" />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    expect(api.createTestSession).toHaveBeenCalledWith({
      subjectId: 'yhq', selector: { type: 'topic', topicId: 77 }, language: 'uz',
    })
    expect(screen.getByText('Fizika bileti')).toBeInTheDocument()
  })

  it('does not carry answers from an invalid old session into its replacement', async () => {
    useServerTestSessionStore.getState().save({
      sessionId: '71a5f096-bdf7-4a54-a4e8-ef348a096c82',
      subjectId: 'yhq',
      mode: 'random20',
      selectorKey: '{"type":"random","count":20}',
      total: 20,
      expiresAt: EXPIRES,
      current: 0,
      questions: [{
        position: 0,
        deliveryToken: 'v1.old-delivery-token',
        expiresAt: EXPIRES,
        text: 'Eski savol',
        options: [{ id: 'F1', text: 'Eski variant' }],
        media: null,
        topic: null,
      }],
      answers: ['wrong', ...Array(19).fill(null)],
      selected: ['F1', ...Array(19).fill(null)],
      correctOptions: ['F2', ...Array(19).fill(null)],
      pendingTokens: {},
    })
    vi.spyOn(api, 'resumeTestSession').mockRejectedValue(
      new ApiError(410, 'test_session_expired', 'test_session_expired'),
    )

    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    await waitFor(() => expect(api.createTestSession).toHaveBeenCalledTimes(1))
    expect(useServerTestSessionStore.getState().snapshot?.answers[0]).toBeNull()
    expect(useServerTestSessionStore.getState().snapshot?.selected[0]).toBeNull()
  })

  it('shows rich results + review when the session is already finished', async () => {
    const finishedQuestions = [0, 1].map((position) => ({
      position,
      deliveryToken: `v1.finished-delivery-token-${position}`,
      expiresAt: EXPIRES,
      text: position === 0 ? 'Tugallangan savol bir' : 'Tugallangan savol ikki',
      options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
      media: null,
      topic: { id: 5 },
    }))
    useServerTestSessionStore.getState().save({
      sessionId: SESSION_ID,
      subjectId: 'yhq',
      mode: 'random20',
      selectorKey: '{"type":"random","count":20}',
      total: 2,
      expiresAt: EXPIRES,
      current: 0,
      questions: finishedQuestions,
      answers: ['correct', 'wrong'],
      selected: ['F1', 'F2'],
      correctOptions: ['F1', 'F1'],
      pendingTokens: {},
    })
    vi.spyOn(api, 'resumeTestSession').mockResolvedValue({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 2, total: 2, expiresAt: EXPIRES },
      questions: finishedQuestions,
      review: [
        { position: 0, selectedOptionId: 'F1', correct: true, correctOptionId: 'F1' },
        { position: 1, selectedOptionId: 'F2', correct: false, correctOptionId: 'F1' },
      ],
    })
    vi.spyOn(api, 'getTopics').mockResolvedValue([])

    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    // Boy natija modali ochiladi (legacy paritet: donut + tahlil tugmasi)
    expect(await screen.findByRole('heading', { name: 'Natijalar' })).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Xatolarni tahlil qilish/))

    // Review: default 'faqat xatolar' filtri — faqat 2-savol ko'rinadi
    expect(await screen.findByRole('heading', { name: 'Imtihon tahlili' })).toBeInTheDocument()
    expect(screen.getByText('Tugallangan savol ikki')).toBeInTheDocument()
    expect(screen.queryByText('Tugallangan savol bir')).not.toBeInTheDocument()
  })

  it('asks for confirmation before finishing with unanswered questions', async () => {
    vi.spyOn(api, 'finishTestSession').mockResolvedValue({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'completed', answered: 0, total: 20, expiresAt: EXPIRES },
    })

    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Yakunlash'))
    expect(await screen.findByText('Test yakunlansinmi?')).toBeInTheDocument()

    // Dialogdagi tasdiq (ikkinchi 'Yakunlash')
    fireEvent.click(screen.getAllByText('Yakunlash')[1])
    await waitFor(() => expect(api.finishTestSession).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Natijalar' })).toBeInTheDocument()
  })

  it('finishes a mock exam automatically after 2 wrong answers', async () => {
    vi.mocked(api.createTestSession).mockResolvedValueOnce({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'mock', status: 'active', answered: 0, total: 2, expiresAt: EXPIRES },
      questions: [{
        position: 0,
        deliveryToken: 'mock-tok-0-abcdef',
        expiresAt: EXPIRES,
        text: 'Mock savol bir',
        options: [{ id: 'F1', text: 'Variant A' }, { id: 'F2', text: 'Variant B' }],
        media: null,
        topic: null,
      }],
      review: [],
    })
    const wrongAttempt = (position: number, done: boolean) => ({
      attempt: {
        position, correct: false, correctOptionId: 'F1', duplicate: false,
        dailyStreak: 1, xp: 10, xpEarned: 0, coinsEarned: 0, coinBalance: 0, coinSaved: false,
      },
      append: done ? [] : [{
        position: 1,
        deliveryToken: 'mock-tok-1-abcdef',
        expiresAt: EXPIRES,
        text: 'Mock savol ikki',
        options: [{ id: 'F1', text: 'Variant A' }, { id: 'F2', text: 'Variant B' }],
        media: null,
        topic: null,
      }],
      session: {
        id: SESSION_ID, subjectId: 'yhq', mode: 'mock',
        status: done ? 'completed' : 'active',
        answered: position + 1, total: 2, expiresAt: EXPIRES,
      },
    })
    vi.mocked(api.submitTestSessionAnswer)
      .mockResolvedValueOnce(wrongAttempt(0, false) as Awaited<ReturnType<typeof api.submitTestSessionAnswer>>)
      .mockResolvedValueOnce(wrongAttempt(1, true) as Awaited<ReturnType<typeof api.submitTestSessionAnswer>>)
    vi.spyOn(api, 'finishTestSession').mockResolvedValue({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'mock', status: 'completed', answered: 2, total: 2, expiresAt: EXPIRES },
    })

    render(<MemoryRouter><ServerPracticePage mode="mock" /></MemoryRouter>)

    expect(await screen.findByText('Mock savol bir')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Variant B'))
    expect(await screen.findByText('Mock savol ikki')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Variant B'))
    expect(await screen.findByRole('heading', { name: 'Natijalar' })).toBeInTheDocument()
    expect(api.finishTestSession).toHaveBeenCalled()
  })

  it('opens image zoom and offers text-to-speech', async () => {
    vi.mocked(api.createTestSession).mockResolvedValueOnce({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 0, total: 20, expiresAt: EXPIRES },
      questions: [{
        position: 0,
        deliveryToken: 'zoom-tok-abcdef',
        expiresAt: EXPIRES,
        text: 'Rasmli savol',
        options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
        media: 'img/x.webp',
        topic: null,
      }],
      review: [],
    })

    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Rasmli savol')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kattalashtirish' }))
    expect(await screen.findByAltText('Savol rasmi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Savolni o.qib berish/ })).toBeInTheDocument()
  })

  it('mounts the drawing toolbox (FAB hub opens the drawing toolbar)', async () => {
    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chizib yechish' }))
    expect(await screen.findByRole('toolbar', { name: 'Chizish asboblari' })).toBeInTheDocument()
  })

  it('toggles bookmarks through the session proof (no master question id)', async () => {
    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => expect(api.toggleSavedQuestion).toHaveBeenCalledTimes(1))
    const [sessionId, payload] = vi.mocked(api.toggleSavedQuestion).mock.calls[0]!
    expect(sessionId).toBe(SESSION_ID)
    expect(payload).toMatchObject({
      position: 0,
      deliveryToken: 'v1.delivery-token-for-position-zero',
    })
    expect(payload).not.toHaveProperty('questionId')
    expect(screen.getByRole('button', { name: 'Saqlanganlardan olish' })).toBeInTheDocument()
  })

  it('opens the static explanation after answering', async () => {
    // Append'siz — javobdan keyin shu savolda qoladi (helper shu yerda chiqadi)
    vi.mocked(api.submitTestSessionAnswer).mockResolvedValueOnce({
      attempt: {
        position: 0, correct: true, correctOptionId: 'F1', duplicate: false,
        dailyStreak: 1, xp: 10, xpEarned: 10, coinsEarned: 1, coinBalance: 1, coinSaved: false,
      },
      append: [],
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 1, total: 20, expiresAt: EXPIRES },
    })
    render(<MemoryRouter><ServerPracticePage mode="random20" /></MemoryRouter>)

    expect(await screen.findByText('Server bergan savol')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Variant bir'))
    await waitFor(() => expect(api.submitTestSessionAnswer).toHaveBeenCalledTimes(1))

    fireEvent.click(await screen.findByRole('button', { name: 'Nega shunday?' }))
    expect(await screen.findByText('Chunki shunday')).toBeInTheDocument()
    expect(api.getSessionExplanation).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ position: 0, language: 'uz' }),
    )
  })
})
