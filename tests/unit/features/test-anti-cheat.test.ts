import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAntiCheat } from '../../../src/features/test/hooks/useAntiCheat'

describe('useAntiCheat (Production Hook Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers strike 1 and strike 2 on leaving and returning in official exam', () => {
    const onDisqualify = vi.fn()
    const { result } = renderHook(() =>
      useAntiCheat({
        isOfficialExam: true,
        isFinished: false,
        onDisqualify,
      })
    )

    expect(result.current.cheatViolations).toBe(0)
    expect(result.current.activeStrike).toBeNull()

    // 1-marta chiqib qaytish
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(1)
    expect(result.current.activeStrike).toBe(1)
    expect(result.current.disqualifiedByCheat).toBe(false)
    expect(onDisqualify).not.toHaveBeenCalled()

    // Dismiss strike
    act(() => {
      result.current.dismissStrike()
    })
    expect(result.current.activeStrike).toBeNull()

    // 2-marta chiqib qaytish
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(2)
    expect(result.current.activeStrike).toBe(2)
    expect(result.current.disqualifiedByCheat).toBe(false)
  })

  it('triggers strike 3 and disqualification on 3rd violation', () => {
    const onDisqualify = vi.fn()
    const { result } = renderHook(() =>
      useAntiCheat({
        isOfficialExam: true,
        isFinished: false,
        onDisqualify,
      })
    )

    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(3)
    expect(result.current.disqualifiedByCheat).toBe(true)
    expect(onDisqualify).toHaveBeenCalledTimes(1)
  })

  it('removes window and document event listeners on unmount (listener cleanup)', () => {
    const removeWindowSpy = vi.spyOn(window, 'removeEventListener')
    const removeDocSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useAntiCheat({
        isOfficialExam: true,
        isFinished: false,
        onDisqualify: vi.fn(),
      })
    )

    unmount()

    expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('blur', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('focus', expect.any(Function))
  })

  it('does not track violations if not an official exam or already finished', () => {
    const onDisqualify = vi.fn()
    const { result } = renderHook(() =>
      useAntiCheat({
        isOfficialExam: false,
        isFinished: false,
        onDisqualify,
      })
    )

    act(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.cheatViolations).toBe(0)
    expect(result.current.activeStrike).toBeNull()
    expect(onDisqualify).not.toHaveBeenCalled()
  })
})
