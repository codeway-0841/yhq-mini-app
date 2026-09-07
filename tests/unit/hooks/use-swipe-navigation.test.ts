import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwipeNavigation } from '../../../src/shared/hooks/useSwipeNavigation'
import { haptics } from '../../../src/platform/haptics'

describe('useSwipeNavigation', () => {
  beforeEach(() => {
    vi.spyOn(haptics, 'impact').mockImplementation(() => {})
  })

  const createTouchEvent = (clientX: number, clientY: number, target = document.createElement('div')) => ({
    touches: [{ clientX, clientY }],
    target,
  } as unknown as React.TouchEvent)

  it('calls onSwipeLeft when swiped left beyond threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        onSwipeRight,
        canSwipeLeft: true,
        threshold: 50,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(150, 200))
    })

    act(() => {
      result.current.touchHandlers.onTouchMove(createTouchEvent(80, 200))
    })

    expect(result.current.isSwiping).toBe(true)
    expect(result.current.dragOffset).toBeLessThan(0)

    act(() => {
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(haptics.impact).toHaveBeenCalledWith('light')
  })

  it('calls onSwipeRight when swiped right beyond threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        onSwipeRight,
        canSwipeRight: true,
        threshold: 50,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(100, 200))
    })

    act(() => {
      result.current.touchHandlers.onTouchMove(createTouchEvent(170, 200))
    })

    expect(result.current.isSwiping).toBe(true)
    expect(result.current.dragOffset).toBeGreaterThan(0)

    act(() => {
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(haptics.impact).toHaveBeenCalledWith('light')
  })

  it('does not trigger swipe when distance is below threshold', () => {
    const onSwipeLeft = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        threshold: 50,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(150, 200))
      result.current.touchHandlers.onTouchMove(createTouchEvent(135, 200)) // deltaX = -15
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('aborts swipe when vertical scroll dominates', () => {
    const onSwipeLeft = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        threshold: 50,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(150, 200))
      // Vertical scroll: deltaY = 40, deltaX = 5
      result.current.touchHandlers.onTouchMove(createTouchEvent(145, 240))
    })

    expect(result.current.isSwiping).toBe(false)
    expect(result.current.dragOffset).toBe(0)

    act(() => {
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('respects canSwipeLeft=false boundary with rubber-band resistance', () => {
    const onSwipeLeft = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        canSwipeLeft: false,
        threshold: 50,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(150, 200))
      result.current.touchHandlers.onTouchMove(createTouchEvent(50, 200)) // deltaX = -100
    })

    // Effective deltaX is scaled down by ~0.18
    expect(result.current.dragOffset).toBeGreaterThan(-30)
    expect(result.current.dragOffset).toBeLessThan(0)

    act(() => {
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores touches originating within edge guard zone', () => {
    const onSwipeRight = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeRight,
        edgeGuardWidth: 24,
      })
    )

    act(() => {
      // Touch starts at clientX = 10 (edge zone)
      result.current.touchHandlers.onTouchStart(createTouchEvent(10, 200))
      result.current.touchHandlers.onTouchMove(createTouchEvent(100, 200))
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('ignores touches when enabled=false', () => {
    const onSwipeLeft = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        enabled: false,
      })
    )

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(200, 200))
      result.current.touchHandlers.onTouchMove(createTouchEvent(100, 200))
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores touches on no-swipe elements like canvas or inputs', () => {
    const onSwipeLeft = vi.fn()

    const { result } = renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
      })
    )

    const inputElement = document.createElement('input')
    const canvasElement = document.createElement('canvas')

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(200, 200, inputElement))
      result.current.touchHandlers.onTouchMove(createTouchEvent(100, 200, inputElement))
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(200, 200, canvasElement))
      result.current.touchHandlers.onTouchMove(createTouchEvent(100, 200, canvasElement))
      result.current.touchHandlers.onTouchEnd()
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
