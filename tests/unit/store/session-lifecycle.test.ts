import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  notifySessionExpired,
  SESSION_EXPIRED_EVENT,
  SESSION_CHANGED_EVENT,
} from '../../../src/shared/lib/session'
import {
  resolveAccent,
  DEFAULT_ACCENT,
  ACCENT_THEMES,
} from '../../../src/shared/config/themes'
import { SHOP_ITEMS } from '../../../shared/shop-items'

describe('Session Lifecycle & Theme Gating Invariants', () => {
  const store = new Map<string, string>()
  const eventTarget = new EventTarget()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
    })
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => eventTarget.dispatchEvent(e),
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => eventTarget.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => eventTarget.removeEventListener(type, listener),
    })
    vi.stubGlobal('Event', Event)
  })

  describe('Session Storage & Event Dispatching', () => {
    it('stores token and dispatches SESSION_CHANGED_EVENT on setSessionToken', () => {
      let eventFired = false
      const handler = () => { eventFired = true }
      window.addEventListener(SESSION_CHANGED_EVENT, handler)

      setSessionToken('test_session_token_xyz')

      expect(getSessionToken()).toBe('test_session_token_xyz')
      expect(eventFired).toBe(true)

      window.removeEventListener(SESSION_CHANGED_EVENT, handler)
    })

    it('clears token and dispatches SESSION_CHANGED_EVENT on clearSessionToken', () => {
      setSessionToken('active_token')
      let eventFired = false
      const handler = () => { eventFired = true }
      window.addEventListener(SESSION_CHANGED_EVENT, handler)

      clearSessionToken()

      expect(getSessionToken()).toBeNull()
      expect(eventFired).toBe(true)

      window.removeEventListener(SESSION_CHANGED_EVENT, handler)
    })

    it('clears token and broadcasts SESSION_EXPIRED_EVENT on 401 expiration', () => {
      setSessionToken('expired_token')
      let expiredEventFired = false
      const handler = () => { expiredEventFired = true }
      window.addEventListener(SESSION_EXPIRED_EVENT, handler)

      notifySessionExpired()

      expect(getSessionToken()).toBeNull()
      expect(expiredEventFired).toBe(true)

      window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
    })
  })

  describe('Theme & Accent Gating (Rule 10)', () => {
    it('forces Free users to DEFAULT_ACCENT if attempting to select a premium accent', () => {
      const premiumAccents = ACCENT_THEMES.filter((t) => t.premium)
      expect(premiumAccents.length).toBeGreaterThan(0)

      for (const theme of premiumAccents) {
        // Free user (isPremium = false)
        const resolved = resolveAccent(theme.id, false)
        expect(resolved).toBe(DEFAULT_ACCENT)
      }
    })

    it('allows Premium users to select any available premium accent', () => {
      const premiumAccents = ACCENT_THEMES.filter((t) => t.premium)

      for (const theme of premiumAccents) {
        // Premium user (isPremium = true)
        const resolved = resolveAccent(theme.id, true)
        expect(resolved).toBe(theme.id)
      }
    })

    it('always permits TRULY-free accents (premium:false VA shop\'da yoq — faqat default) regardless of tariff status', () => {
      // #40: premium:false temalarning bir qismi endi COIN-EKSKLYUZIV (crimson/royal/
      // arctic) — ular egaliksiz yopiq; "har doim ochiq" invariant FAQAT shop'da
      // YO'Q non-premium temalarga (hozir faqat DEFAULT kiwi) tegishli.
      const coinGated = new Set<string>(SHOP_ITEMS.filter((i) => i.kind === 'accent-theme').map((i) => i.id))
      const freeAccents = ACCENT_THEMES.filter((t) => !t.premium && !coinGated.has(t.id))
      expect(freeAccents).toEqual([expect.objectContaining({ id: DEFAULT_ACCENT })])

      for (const theme of freeAccents) {
        expect(resolveAccent(theme.id, false)).toBe(theme.id)
        expect(resolveAccent(theme.id, true)).toBe(theme.id)
      }
    })
  })
})
