/**
 * FE-4 regression — submitAnswer'da fatal 4xx "offline"ga YUTILMASLIGI kerak:
 *  - ApiError retryable=false (4xx) → outbox'siz { fatal: true } (javob yo'q,
 *    UI xato toast + rollback qiladi);
 *  - tarmoq xatosi → outbox'ga yozilib null (offline UX to'g'ri).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../../src/shared/api'

const postResult = vi.fn()
const enqueueOutbox = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { postResult: (...args: unknown[]) => postResult(...args) } }
})
vi.mock('../../../src/shared/lib/outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/lib/outbox')>()
  return { ...actual, enqueueOutbox: (...args: unknown[]) => enqueueOutbox(...args) }
})

// zustand persist create() paytida localStorage'ga tegadi — importdan OLDIN stub
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => store.get(k) ?? null,
  setItem:    (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear:      () => store.clear(),
})

beforeEach(() => {
  vi.resetModules()
  postResult.mockReset()
  enqueueOutbox.mockReset()
  store.clear()
})

async function setup() {
  const { useAppStore } = await import('../../../src/shared/store/useAppStore')
  useAppStore.setState({
    user: { id: 'u1', firstName: 'T', lastName: undefined, username: undefined, photoUrl: undefined, phone: undefined, tariff: 'free' },
  })
  return useAppStore.getState()
}

describe('submitAnswer fatal/offline ajratuvi (FE-4)', () => {
  it('4xx fatal → outbox YOQ, { fatal: true } qaytaradi', async () => {
    postResult.mockRejectedValue(new ApiError(401, 'POST /progress/u1/result → 401: unauthorized', 'session_expired'))
    const { submitAnswer } = await setup()

    const res = await submitAnswer(42, 'a')

    expect(res).toEqual({ fatal: true, code: 'session_expired' })
    expect(enqueueOutbox).not.toHaveBeenCalled()   // eski kod: navbatga yozib tashlab yuborardi
  })

  it('tarmoq xatosi → outbox\'ga yoziladi, null (offline UX)', async () => {
    postResult.mockRejectedValue(new TypeError('fetch failed'))
    const { submitAnswer } = await setup()

    const res = await submitAnswer(42, 'a')

    expect(res).toBeNull()
    expect(enqueueOutbox).toHaveBeenCalledTimes(1)
    expect(enqueueOutbox.mock.calls[0]?.[1]).toBe('result')
    expect(enqueueOutbox.mock.calls[0]?.[2]).toMatchObject({ questionId: 42 })
  })

  it('muvaffaqiyatli javob → server natijasi (fatal EMAS), outbox yo\'q', async () => {
    postResult.mockResolvedValue({ ok: true, correct: true, correctAnswer: 'a', dailyStreak: 3, duplicate: false })
    const { submitAnswer } = await setup()

    const res = await submitAnswer(42, 'a')

    expect(res).toMatchObject({ correct: true, correctAnswer: 'a', duplicate: false })
    expect(res && !('fatal' in res)).toBe(true)
    expect(enqueueOutbox).not.toHaveBeenCalled()
  })
})
