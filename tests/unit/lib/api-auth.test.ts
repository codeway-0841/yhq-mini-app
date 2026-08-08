/**
 * API qatlami auth header TANLOVI + 401 sessiya o'chirish testlari.
 * - initData bor → FAQAT x-telegram-init-data (token YUBORILMAYDI)
 * - initData yo'q + token bor → Authorization: Bearer
 * - Bearer + 401 → token o'chiriladi + 'yhq:session-expired' event
 * Run with: npx vitest tests/unit/lib/api-auth.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// platform/telegram moduli mock — initData holatini test boshqaradi
vi.mock('../../../src/platform/telegram', () => ({
  getInitData: vi.fn(() => undefined as string | undefined),
}))

import { getInitData } from '../../../src/platform/telegram'
import { api, ApiError } from '../../../src/shared/api'
import { getSessionToken, setSessionToken, SESSION_EXPIRED_EVENT } from '../../../src/shared/lib/session'

const memory = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v) },
  removeItem: (k: string) => { memory.delete(k) },
}

const fetchMock = vi.fn()

/** Minimal valid FullProfile (contract parse o'tishi uchun) */
const PROFILE = {
  user: { id: 'p_998901234567', firstName: 'Ali', tariff: 'free' },
  progress: { totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, wrongByTicket: {} },
  settings: {
    autoNextCorrect: true, autoNextWrong: false, noAnimation: false, shuffleOptions: false,
    fontSize: 'medium', fontStyle: 'default', language: 'uz', theme: 'dark', offlineMode: true,
  },
  savedQuestions: [],
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'mock',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

function lastCallHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> } | undefined
  return init?.headers ?? {}
}

beforeEach(() => {
  memory.clear()
  fetchMock.mockReset()
  vi.stubGlobal('localStorage', localStorageStub)
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getInitData).mockReturnValue(undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api auth header tanlovi', () => {
  it("initData BOR — faqat x-telegram-init-data; token bo'lsa ham Bearer YUBORILMAYDI", async () => {
    vi.mocked(getInitData).mockReturnValue('INITDATA')
    setSessionToken('tok-secret')
    fetchMock.mockResolvedValue(jsonResponse(200, PROFILE))

    await api.getProfile('p_998901234567')

    const headers = lastCallHeaders()
    expect(headers['x-telegram-init-data']).toBe('INITDATA')
    expect(headers['Authorization']).toBeUndefined()
  })

  it("initData YO'Q + token BOR — Authorization: Bearer yuboriladi", async () => {
    setSessionToken('tok-secret')
    fetchMock.mockResolvedValue(jsonResponse(200, PROFILE))

    await api.getProfile('p_998901234567')

    const headers = lastCallHeaders()
    expect(headers['Authorization']).toBe('Bearer tok-secret')
    expect(headers['x-telegram-init-data']).toBeUndefined()
  })

  it('hech qanday credential yo\'q — auth header umuman qo\'yilmaydi', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, PROFILE))

    await api.getProfile('p_998901234567')

    const headers = lastCallHeaders()
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['x-telegram-init-data']).toBeUndefined()
  })

  it('Bearer + 401 (invalid_session) — token o\'chadi + session-expired event tarqaladi', async () => {
    const dispatch = vi.fn()
    vi.stubGlobal('window', { dispatchEvent: dispatch })
    setSessionToken('tok-expired')
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid_session' }))

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
    expect(getSessionToken()).toBeNull()
    const types = dispatch.mock.calls.map((c) => (c[0] as Event).type)
    expect(types).toContain(SESSION_EXPIRED_EVENT)
  })

  it('initData + 401 (imzo xatosi) — lokal session token\'ga TEGILMAYDI', async () => {
    const dispatch = vi.fn()
    vi.stubGlobal('window', { dispatchEvent: dispatch })
    vi.mocked(getInitData).mockReturnValue('BAD-INITDATA')
    setSessionToken('tok-untouched')
    dispatch.mockClear() // setSessionToken'ning o'zi 'changed' event tarqatgan

    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Invalid Telegram initData signature' }))
    await expect(api.getAuthMe()).rejects.toBeInstanceOf(ApiError)

    expect(getSessionToken()).toBe('tok-untouched')
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('api auth metodlar — contract parse', () => {
  it('registerPhone — to\'g\'ri javob AuthResponse sifatida qaytariladi', async () => {
    const body = { ...PROFILE, providers: ['phone'], sessionToken: 'x'.repeat(64) }
    fetchMock.mockResolvedValue(jsonResponse(201, body))

    const res = await api.registerPhone({ phone: '+998901234567', password: 'parol12345', firstName: 'Ali' })
    expect(res.sessionToken).toBe('x'.repeat(64))
    expect(res.user.id).toBe('p_998901234567')

    // register endpoint post + body
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toContain('/auth/phone/register')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ phone: '+998901234567', password: 'parol12345', firstName: 'Ali' })
  })

  it('registerPhone — contract\'siz javob bad_response xatosi beradi', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }))
    await expect(
      api.registerPhone({ phone: '+998901234567', password: 'parol12345', firstName: 'Ali' }),
    ).rejects.toMatchObject({ status: 0, code: 'bad_response' })
  })

  it("logout — server javobi yutsa ham (offline) xato tashlamaydi", async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(api.logout()).resolves.toEqual({ ok: true })
  })
})
