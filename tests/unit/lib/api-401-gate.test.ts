import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../../../src/shared/api'
import {
  setSessionToken,
  getSessionToken,
  SESSION_EXPIRED_EVENT,
} from '../../../src/shared/lib/session'

/**
 * Audit CRITICAL regression-guard (src/shared/api/index.ts request 401-gate):
 * Bearer bilan yuborilgan so'rovning har qanday 401'i LOGOUT qilmasligi kerak —
 * FAQAT server auth middleware'ining 'invalid_session' kodi sessiyani o'chiradi.
 * Biznes-logika 401'lari (invalid_otp / invalid_credentials /
 * invalid_current_password — server/modules/auth/*) joriy sessiyaga TEGMAYDI:
 * aks holda Profil'da bitta xato parol/OTP yozish = TO'LIQ LOGOUT bo'lardi.
 */
describe('API request — 401 session-gate', () => {
  const store = new Map<string, string>()
  const eventTarget = new EventTarget()
  let expiredCount = 0
  const onExpired = () => { expiredCount++ }

  beforeEach(() => {
    store.clear()
    expiredCount = 0
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
    })
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => eventTarget.dispatchEvent(e),
      addEventListener: (type: string, l: EventListenerOrEventListenerObject) => eventTarget.addEventListener(type, l),
      removeEventListener: (type: string, l: EventListenerOrEventListenerObject) => eventTarget.removeEventListener(type, l),
    })
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
  })

  function mockFetchOnce(status: number, body: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json' } },
    )))
  }

  it("biznes-401 (invalid_otp) sessiyani BUZMAYDI", async () => {
    setSessionToken('tok_valid_1')
    mockFetchOnce(401, { error: 'invalid_otp' })

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401, code: 'invalid_otp' })
    expect(expiredCount).toBe(0)
    expect(getSessionToken()).toBe('tok_valid_1')
  })

  it("biznes-401 (invalid_credentials) sessiyani BUZMAYDI", async () => {
    setSessionToken('tok_valid_2')
    mockFetchOnce(401, { error: 'invalid_credentials' })

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' })
    expect(expiredCount).toBe(0)
    expect(getSessionToken()).toBe('tok_valid_2')
  })

  it("biznes-401 (invalid_current_password) sessiyani BUZMAYDI", async () => {
    setSessionToken('tok_valid_3')
    mockFetchOnce(401, { error: 'invalid_current_password' })

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401, code: 'invalid_current_password' })
    expect(expiredCount).toBe(0)
    expect(getSessionToken()).toBe('tok_valid_3')
  })

  it("'invalid_session' kodi sessiyani O'CHIRADI + SESSION_EXPIRED_EVENT tarqaladi", async () => {
    setSessionToken('tok_expired')
    mockFetchOnce(401, { error: 'invalid_session' })

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
    expect(expiredCount).toBe(1)
    expect(getSessionToken()).toBeNull()
  })

  it("500 server xatosi sessiyaga tegmaydi", async () => {
    setSessionToken('tok_valid_4')
    mockFetchOnce(500, { error: 'internal' })

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 500 })
    expect(expiredCount).toBe(0)
    expect(getSessionToken()).toBe('tok_valid_4')
  })
})

/**
 * v2 initData→Bearer exchange (2026-08-27): credential TANLOVI va TG-muhitdagi
 * invalid_session recovery.
 *
 *  - Bearer sessiya initData'dan USTUVOR (initData = faqat bootstrap credential;
 *    /init sessiyasiz init'da 30-kunlik token chiqaradi).
 *  - TG muhitida invalid_session = LOGOUT EMAS: token jim o'chirilib so'rov
 *    initData bilan BIR MARTA qayta yuboriladi (401 = server bajarmagan).
 *  - initData'siz muhitda (brauzer/APK) — eski xatti-harakat: SESSION_EXPIRED.
 */
describe('API request — v2 credential preference + TG invalid_session recovery', () => {
  const store = new Map<string, string>()
  const eventTarget = new EventTarget()
  let expiredCount = 0
  const onExpired = () => { expiredCount++ }
  const reloadMock = vi.fn()

  beforeEach(() => {
    store.clear()
    expiredCount = 0
    reloadMock.mockReset()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
    })
    // TG Mini App muhiti: initData MAVJUD
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => eventTarget.dispatchEvent(e),
      addEventListener: (type: string, l: EventListenerOrEventListenerObject) => eventTarget.addEventListener(type, l),
      removeEventListener: (type: string, l: EventListenerOrEventListenerObject) => eventTarget.removeEventListener(type, l),
      location: { reload: reloadMock },
      Telegram: { WebApp: { initData: 'stub-initdata', initDataUnsafe: { user: { id: 1 }, auth_date: Math.floor(Date.now() / 1000) } } },
    })
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
  })

  it('Bearer + initData ikkalasi ham bor — FAQAT Bearer yuboriladi (initData bootstrap-only)', async () => {
    setSessionToken('tok_preferred')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getAuthMe().catch(() => {}) // parse xatosi bo'lsa ham header tekshiruvi o'tadi

    const headers = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    expect(headers['Authorization']).toBe('Bearer tok_preferred')
    expect(headers['x-telegram-init-data']).toBeUndefined()
  })

  it('Bearer yo\'q — initData yuboriladi (bootstrap)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getAuthMe().catch(() => {})

    const headers = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    expect(headers['x-telegram-init-data']).toBe('stub-initdata')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('TG muhitida invalid_session → LOGOUT EMAS: jim token-clear + initData bilan 1 retry', async () => {
    setSessionToken('tok_expired_tg')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getAuthMe().catch(() => {})

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 1-urinish Bearer bilan, 2-si initData bilan
    const h1 = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
    const h2 = (fetchMock.mock.calls[1]?.[1] as { headers: Record<string, string> }).headers
    expect(h1['Authorization']).toBe('Bearer tok_expired_tg')
    expect(h2['x-telegram-init-data']).toBe('stub-initdata')
    expect(h2['Authorization']).toBeUndefined()
    // LOGOUT BO'LMADI: expired event tarqalmadi, lekin eski token o'chirildi
    expect(expiredCount).toBe(0)
    expect(getSessionToken()).toBeNull()
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it("retry ham 401 qaytarsa — ApiError ko'tariladi, cheksiz sikl YO'Q (jami 2 fetch)", async () => {
    setSessionToken('tok_expired_tg2')
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: 'invalid_session' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getAuthMe()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(expiredCount).toBe(0)
  })
})
