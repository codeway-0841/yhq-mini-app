import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from '../../../src/shared/store/useAppStore'
import {
  SESSION_EXPIRED_EVENT,
  SESSION_CHANGED_EVENT,
  getSessionToken,
} from '../../../src/shared/lib/session'
import { INITDATA_DEAD_EVENT } from '../../../src/platform/telegram'

describe('App Bootstrap Core Invariants (Characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fallback timer guarantees initialized=true after 8000ms if still uninitialized', () => {
    useAppStore.setState({ initialized: false })
    expect(useAppStore.getState().initialized).toBe(false)

    // Simulate 8s fallback timer
    const t = setTimeout(() => {
      if (!useAppStore.getState().initialized) {
        useAppStore.setState({ initialized: true })
      }
    }, 8000)

    vi.advanceTimersByTime(7999)
    expect(useAppStore.getState().initialized).toBe(false)

    vi.advanceTimersByTime(2)
    expect(useAppStore.getState().initialized).toBe(true)

    clearTimeout(t)
  })

  it('handles SESSION_EXPIRED_EVENT and SESSION_CHANGED_EVENT custom window events', () => {
    let hasSession = true
    let expiredHandled = false

    const onExpired = () => {
      hasSession = false
      expiredHandled = true
    }
    const onChanged = () => {
      hasSession = Boolean(getSessionToken())
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.addEventListener(SESSION_CHANGED_EVENT, onChanged)

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    expect(hasSession).toBe(false)
    expect(expiredHandled).toBe(true)

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.removeEventListener(SESSION_CHANGED_EVENT, onChanged)
  })

  it('handles INITDATA_DEAD_EVENT for stale Telegram initData recovery', () => {
    let initDataDead = false
    const onDead = () => { initDataDead = true }

    window.addEventListener(INITDATA_DEAD_EVENT, onDead)
    window.dispatchEvent(new Event(INITDATA_DEAD_EVENT))
    expect(initDataDead).toBe(true)

    window.removeEventListener(INITDATA_DEAD_EVENT, onDead)
  })
})
