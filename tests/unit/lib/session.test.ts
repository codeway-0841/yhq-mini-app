/**
 * session store (Bearer token) unit testlari — localStorage + event tarqalishi.
 * Run with: npx vitest tests/unit/lib/session.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSessionToken, setSessionToken, clearSessionToken, notifySessionExpired,
  SESSION_EXPIRED_EVENT, SESSION_CHANGED_EVENT,
} from '../../../src/shared/lib/session'

const memory = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v) },
  removeItem: (k: string) => { memory.delete(k) },
}

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', localStorageStub)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session store — token saqlash', () => {
  it("boshlang'ich holatda token yo'q", () => {
    expect(getSessionToken()).toBeNull()
  })

  it('set → get qaytaradi; clear → null', () => {
    setSessionToken('tok-123')
    expect(getSessionToken()).toBe('tok-123')
    clearSessionToken()
    expect(getSessionToken()).toBeNull()
  })

  it("localStorage tashqarisida (undefined) ham yiqilmaydi — null qaytaradi", () => {
    vi.stubGlobal('localStorage', undefined)
    expect(getSessionToken()).toBeNull()
  })
})

describe('session store — event\'lar', () => {
  it("set/clear — 'yhq:session-changed' event tarqaladi", () => {
    const dispatch = vi.fn()
    vi.stubGlobal('window', { dispatchEvent: dispatch })
    setSessionToken('abc')
    clearSessionToken()
    const types = dispatch.mock.calls.map((c) => (c[0] as Event).type)
    expect(types).toEqual([SESSION_CHANGED_EVENT, SESSION_CHANGED_EVENT])
  })

  it("notifySessionExpired — token o'chadi + changed + expired ketma-ketligi", () => {
    const dispatch = vi.fn()
    vi.stubGlobal('window', { dispatchEvent: dispatch })
    setSessionToken('abc')
    dispatch.mockClear()
    notifySessionExpired()
    expect(getSessionToken()).toBeNull()
    const types = dispatch.mock.calls.map((c) => (c[0] as Event).type)
    expect(types).toEqual([SESSION_CHANGED_EVENT, SESSION_EXPIRED_EVENT])
  })

  it("window yo'q muhitda (node) — xatosiz o'tadi", () => {
    // window stub'lanmagan — server-side xavfsizlik
    expect(() => notifySessionExpired()).not.toThrow()
  })
})
