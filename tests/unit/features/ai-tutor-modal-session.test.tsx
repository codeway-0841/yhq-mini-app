import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { api } from '../../../src/shared/api'
import AiTutorModal from '../../../src/features/test/components/AiTutorModal'

/**
 * AiTutorModal — V2 sessionRef (master ID client'ga chiqmaydi).
 * Premium: AI stream sessionPosition body bilan; free: statik izoh
 * session endpoint'dan. Legacy {questionId} yo'li o'zgarmaydi.
 */
const SESSION_REF = {
  sessionId: '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa',
  position: 0,
  deliveryToken: 'v1.delivery-token-for-position-zero',
  expiresAt: '2027-09-08T12:00:00.000Z',
}

function sseResponse(text: string) {
  return new Response(
    `data: {"text":"${text}"}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

function setUser(tariff: 'free' | 'premium') {
  useAppStore.setState({
    user: {
      id: '12345', firstName: 'Test', lastName: undefined, username: undefined,
      photoUrl: undefined, phone: undefined,
    },
    tariff,
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
}

describe('AiTutorModal — V2 sessionRef', () => {
  beforeEach(() => {
    setUser('premium')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('streams AI through sessionPosition (no master question id on the wire)', async () => {
    const fetchMock = vi.fn(async () => sseResponse('AI javob'))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AiTutorModal sessionRef={SESSION_REF} selectedOptionId="F1" isCorrect={false} language="uz" onClose={() => {}} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI javob')).toBeInTheDocument()
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['sessionPosition']).toMatchObject({ position: 0, sessionId: SESSION_REF.sessionId })
    expect(body).not.toHaveProperty('questionId')
  })

  it('falls back to the static session explanation for free users', async () => {
    setUser('free')
    const staticSpy = vi.spyOn(api, 'getSessionExplanation').mockResolvedValue({ text: 'Statik izoh' })

    render(
      <MemoryRouter>
        <AiTutorModal sessionRef={SESSION_REF} selectedOptionId="F1" isCorrect={false} language="uz" onClose={() => {}} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Statik izoh')).toBeInTheDocument()
    expect(staticSpy).toHaveBeenCalledWith(
      SESSION_REF.sessionId,
      expect.objectContaining({ position: 0, language: 'uz' }),
    )
  })
})
