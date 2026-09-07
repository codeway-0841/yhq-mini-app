import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { api, ApiError } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useServerTestSessionStore } from '../../../src/shared/store/useServerTestSessionStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import ServerPracticePage from '../../../src/features/test/ServerPracticePage'

const SESSION_ID = '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa'
const EXPIRES = '2026-09-08T12:00:00.000Z'

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
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 0, total: 50, expiresAt: EXPIRES },
      questions: [{
        position: 0,
        deliveryToken: 'v1.delivery-token-for-position-zero',
        expiresAt: EXPIRES,
        text: '50 talik server testi',
        options: [{ id: 'F1', text: 'A' }, { id: 'F2', text: 'B' }],
        media: null,
        topic: null,
      }],
      review: [],
    })

    render(<MemoryRouter><ServerPracticePage mode="random50" /></MemoryRouter>)

    expect(await screen.findByText('50 talik server testi')).toBeInTheDocument()
    expect(api.createTestSession).toHaveBeenCalledWith(expect.objectContaining({
      selector: { type: 'random', count: 50 },
    }))
    expect(useServerTestSessionStore.getState().snapshot?.mode).toBe('random50')
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
})
