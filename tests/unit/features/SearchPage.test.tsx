/**
 * SearchPage v2 (testSessionsV2Enabled) — server-side qidiruv:
 * authenticated bounded hit'lar launch token bilan, master ID yo'q;
 * single-sessiya launch'i serverSelector orqali.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../../../src/shared/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/config')>()
  return { ...actual, config: { ...actual.config, testSessionsV2Enabled: true } }
})

import SearchPage from '../../../src/features/search/SearchPage'
import { api } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

const EXPIRES = '2026-09-08T12:00:00.000Z'
const LAUNCH_TOKEN = 'lt1.1788888888.aXYtYWtlLWl2.c29tZS1jaXBoZXJ0ZXh0LXRhZw'

beforeEach(() => {
  mockNavigate.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
  })
  // v2'da savollar indeksi xotirada KERAK EMAS — topics faqat nom lookup uchun
  useQuestionsStore.setState({
    questions: [],
    topics: [{ id: 10, nameUz: 'Belgilar', nameRu: 'Знаки' }] as never[],
    loaded: true,
    loading: false,
  })
  vi.spyOn(api, 'searchQuestions').mockResolvedValue({
    hits: [
      { text: 'Qaysi belgi to\'xtashni taqiqlaydi?', topicId: 10, launchToken: LAUNCH_TOKEN, expiresAt: EXPIRES },
    ],
  })
})

afterEach(() => vi.restoreAllMocks())

describe('SearchPage v2 — server-owned search + safe launch', () => {
  it('qidiruvni server orqali bajaradi (xotira bankisiz)', async () => {
    render(<SearchPage />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'to\'xtash' } })

    expect(await screen.findByText('Qaysi belgi to\'xtashni taqiqlaydi?')).toBeInTheDocument()
    await waitFor(() => expect(api.searchQuestions).toHaveBeenCalledWith('yhq', 'to\'xtash', 'uz'))
  })

  it('hit bosilganda single sessiyani launch token bilan ochadi — master ID yo\'q', async () => {
    render(<SearchPage />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'to\'xtash' } })
    fireEvent.click(await screen.findByText('Qaysi belgi to\'xtashni taqiqlaydi?'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state).toMatchObject({
      mode: 'single',
      serverSelector: { type: 'single', launchToken: LAUNCH_TOKEN },
    })
    expect(opts.state).not.toHaveProperty('questionIds')
    expect(JSON.stringify(opts.state)).not.toContain('"questionId"')
  })

  it('mavzu nomini topics metadata\'sidan ko\'rsatadi', async () => {
    render(<SearchPage />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'to\'xtash' } })

    expect(await screen.findByText('Belgilar')).toBeInTheDocument()
  })

  it('qisqa so\'rovda serverga bormaydi', async () => {
    render(<SearchPage />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 't' } })
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(api.searchQuestions).not.toHaveBeenCalled()
  })
})
