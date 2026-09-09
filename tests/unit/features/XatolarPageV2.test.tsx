/**
 * XatolarPage v2 (testSessionsV2Enabled) — overview SERVER'dan:
 * total/byTopic/Top-10 full-bank xotira indeksi TALAB QILINMAYDI;
 * Top-10 launch'i `single` serverSelector (launch token) bilan,
 * mavzu/barcha mashqlari server-owned mistakes selector bilan.
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

import XatolarPage from '../../../src/features/mistakes/XatolarPage'
import { api } from '../../../src/shared/api'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import { useQuestionsStore } from '../../../src/shared/store/useQuestionsStore'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'

const EXPIRES = '2026-09-08T12:00:00.000Z'
const TOP_TOKEN = 'lt1.1788888888.aXYtYWtlLWl2.c29tZS1jaXBoZXJ0ZXh0LXRhZw'

const OVERVIEW = {
  total: 3,
  byTopic: [
    { topicId: 10, count: 2 },
    { topicId: 20, count: 1 },
  ],
  top: [
    { text: 'Eng qiyin savol', count: 5, topicId: 10, launchToken: TOP_TOKEN, expiresAt: EXPIRES },
  ],
}

beforeEach(() => {
  mockNavigate.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  // v2'da xato ro'yxati serverdan — full-bank BO'SH bo'lsa ham sahifa ishlaydi
  useQuestionsStore.setState({ questions: [], topics: [
    { id: 10, nameUz: 'Belgilar', nameRu: 'Знаки' },
    { id: 20, nameUz: "Yo'l chizig'i", nameRu: 'Разметка' },
  ] as never[], loaded: true, loading: false })
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'uz' },
    wrongByTicket: {},
    tariff: 'premium',
  })
  vi.spyOn(api, 'getTopMistakes').mockResolvedValue(OVERVIEW)
})

afterEach(() => vi.restoreAllMocks())

describe('XatolarPage v2 — server overview + safe launch', () => {
  it('total/byTopic/Top-10 ni serverdan oladi (xotira bankisiz)', async () => {
    render(<XatolarPage />)

    expect(await screen.findByText('Eng qiyin savol')).toBeInTheDocument()
    await waitFor(() => expect(api.getTopMistakes).toHaveBeenCalledWith('yhq', 'uz'))
    expect(screen.getByText('3')).toBeInTheDocument()          // server total
    expect(screen.getByText('Belgilar')).toBeInTheDocument()   // byTopic nomi
  })

  it('"Barchasini mashq qilish" server-owned mistakes selector bilan ochadi', async () => {
    render(<XatolarPage />)
    fireEvent.click(await screen.findByText(/Barchasini mashq|mashq qilish/i))

    const [path, opts] = mockNavigate.mock.calls[0]!
    expect(path).toBe('/test/1')
    expect(opts.state).toMatchObject({ mode: 'mistakes', serverSelector: 'mistakes' })
    expect(opts.state).not.toHaveProperty('questionIds')
  })

  it('mavzu mashqi topicId bilan server selector yuboradi — ID massivisiz', async () => {
    render(<XatolarPage />)
    fireEvent.click(await screen.findByText('Belgilar'))

    const [, opts] = mockNavigate.mock.calls[0]!
    expect(opts.state).toMatchObject({
      mode: 'mistakes',
      serverSelector: { type: 'mistakes', topicId: 10 },
      title: 'Belgilar',
    })
    expect(opts.state).not.toHaveProperty('questionIds')
  })

  it('Top-10 savolni launch token bilan single sessiyaga ochadi', async () => {
    render(<XatolarPage />)
    fireEvent.click(await screen.findByText('Eng qiyin savol'))

    const [, opts] = mockNavigate.mock.calls[0]!
    expect(opts.state).toMatchObject({
      mode: 'single',
      serverSelector: { type: 'single', launchToken: TOP_TOKEN },
    })
    expect(opts.state).not.toHaveProperty('questionIds')
    expect(JSON.stringify(opts.state)).not.toContain('"questionId"')
  })

  it('free foydalanuvchiga Top-10 va mavzu kesimi ko\'rsatilmaydi', async () => {
    useAppStore.setState({ tariff: 'free' })
    render(<XatolarPage />)

    expect(await screen.findByText(/Obuna bo'lish/i)).toBeInTheDocument()
    expect(screen.queryByText('Eng qiyin savol')).toBeNull()
    expect(screen.queryByText('Belgilar')).toBeNull()
  })

  it('server javobi bo\'lmasa (xato/0) bo\'sh holat ko\'rsatiladi', async () => {
    vi.mocked(api.getTopMistakes).mockResolvedValue({ total: 0, byTopic: [], top: [] })
    render(<XatolarPage />)

    expect(await screen.findByText("Xatolar yo'q")).toBeInTheDocument()
  })
})
