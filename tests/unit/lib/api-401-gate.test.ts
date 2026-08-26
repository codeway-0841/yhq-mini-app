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
