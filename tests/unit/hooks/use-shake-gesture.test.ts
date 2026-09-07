import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShakeGesture } from '../../../src/shared/hooks/useShakeGesture'

describe('useShakeGesture', () => {
  let addEventListenerSpy: any
  let removeEventListenerSpy: any
  let motionHandler: ((e: any) => void) | null = null

  beforeEach(() => {
    motionHandler = null
    addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'devicemotion') {
        motionHandler = handler as (e: any) => void
      }
    })
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation((event) => {
      if (event === 'devicemotion') {
        motionHandler = null
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMotionEvent = (x: number, y: number, z: number) => ({
    accelerationIncludingGravity: { x, y, z },
    acceleration: { x, y, z },
  })

  it('attaches and detaches devicemotion listener based on enabled flag', () => {
    const onShake = vi.fn()
    const { unmount } = renderHook(() => useShakeGesture({ onShake, enabled: true }))

    expect(addEventListenerSpy).toHaveBeenCalledWith('devicemotion', expect.any(Function), { passive: true })
    expect(motionHandler).not.toBeNull()

    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('devicemotion', expect.any(Function))
    expect(motionHandler).toBeNull()
  })

  it('does not attach listener when enabled is false', () => {
    const onShake = vi.fn()
    renderHook(() => useShakeGesture({ onShake, enabled: false }))

    expect(motionHandler).toBeNull()
  })

  it('triggers onShake when device is shaken twice rapidly above threshold', () => {
    const onShake = vi.fn()
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    renderHook(() => useShakeGesture({ onShake, threshold: 15, timeout: 800 }))
    expect(motionHandler).not.toBeNull()

    // 1st event: initialization
    act(() => {
      motionHandler!(createMotionEvent(0, 0, 9.8))
    })
    expect(onShake).not.toHaveBeenCalled()

    // 2nd event: rapid acceleration in +X (dt: 100ms, dx: 30) -> speed ~ 3000 > 15
    now += 100
    act(() => {
      motionHandler!(createMotionEvent(30, 0, 9.8))
    })
    expect(onShake).not.toHaveBeenCalled() // shakeCount = 1

    // 3rd event: reverse acceleration in -X (dt: 100ms, dx: 60) -> shakeCount = 2 -> trigger!
    now += 100
    act(() => {
      motionHandler!(createMotionEvent(-30, 0, 9.8))
    })
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it('debounces subsequent shakes within the timeout period', () => {
    const onShake = vi.fn()
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    renderHook(() => useShakeGesture({ onShake, threshold: 15, timeout: 800 }))

    // Initial event
    act(() => { motionHandler!(createMotionEvent(0, 0, 9.8)) })

    // 1st shake (2 movements)
    now += 100
    act(() => { motionHandler!(createMotionEvent(30, 0, 9.8)) })
    now += 100
    act(() => { motionHandler!(createMotionEvent(-30, 0, 9.8)) })
    expect(onShake).toHaveBeenCalledTimes(1)

    // Immediate subsequent movements within timeout (e.g. 200ms later) should NOT trigger
    now += 100
    act(() => { motionHandler!(createMotionEvent(30, 0, 9.8)) })
    now += 100
    act(() => { motionHandler!(createMotionEvent(-30, 0, 9.8)) })
    expect(onShake).toHaveBeenCalledTimes(1)

    // After timeout has elapsed (> 800ms): phone rests, then shakes twice rapidly
    now += 900
    act(() => { motionHandler!(createMotionEvent(0, 0, 9.8)) }) // rest
    now += 100
    act(() => { motionHandler!(createMotionEvent(30, 0, 9.8)) }) // 1st motion (shakeCount = 1)
    now += 100
    act(() => { motionHandler!(createMotionEvent(-30, 0, 9.8)) }) // 2nd motion (shakeCount = 2 -> triggers!)
    expect(onShake).toHaveBeenCalledTimes(2)
  })

  it('safely handles null or undefined acceleration fields', () => {
    const onShake = vi.fn()
    renderHook(() => useShakeGesture({ onShake }))

    expect(() => {
      act(() => {
        motionHandler!({ accelerationIncludingGravity: null, acceleration: null })
        motionHandler!({ accelerationIncludingGravity: { x: null, y: null, z: null } })
      })
    }).not.toThrow()
    expect(onShake).not.toHaveBeenCalled()
  })
})
