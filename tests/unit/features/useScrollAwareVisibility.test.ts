import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScrollAwareVisibility } from '../../../src/features/dashboard/hooks/useScrollAwareVisibility'

describe('useScrollAwareVisibility', () => {
  let originalScrollY: number

  beforeEach(() => {
    originalScrollY = window.scrollY
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true })
    vi.restoreAllMocks()
  })

  it('starts visible at top of page (scrollY = 0)', () => {
    const { result } = renderHook(() => useScrollAwareVisibility())
    expect(result.current).toBe(true)
  })

  it('remains visible when scrolling below topThreshold (< 80px)', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })

    const { result } = renderHook(() => useScrollAwareVisibility({ topThreshold: 80 }))
    act(() => {
      window.scrollY = 50
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(true)

    rafSpy.mockRestore()
  })

  it('hides when scrolling down past threshold beyond topThreshold', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })

    const { result } = renderHook(() => useScrollAwareVisibility({ threshold: 12, topThreshold: 80 }))
    act(() => {
      window.scrollY = 150
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(false)

    rafSpy.mockRestore()
  })

  it('ignores sub-threshold jitter', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })

    const { result } = renderHook(() => useScrollAwareVisibility({ threshold: 12, topThreshold: 80 }))
    // Scroll down to 150 -> hides
    act(() => {
      window.scrollY = 150
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(false)

    // Jitter up by 5px (145px) -> delta is -5, threshold is 12 -> still hidden
    act(() => {
      window.scrollY = 145
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(false)

    rafSpy.mockRestore()
  })

  it('shows when scrolling up past threshold', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })

    const { result } = renderHook(() => useScrollAwareVisibility({ threshold: 12, topThreshold: 80 }))
    // Scroll down to 200 -> hides
    act(() => {
      window.scrollY = 200
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(false)

    // Scroll up by 25px (to 175px) -> delta is -25 <= -12 -> shows!
    act(() => {
      window.scrollY = 175
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(true)

    rafSpy.mockRestore()
  })

  it('restores visibility when returning to top of page', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })

    const { result } = renderHook(() => useScrollAwareVisibility({ threshold: 12, topThreshold: 80 }))
    // Scroll down to 300 -> hides
    act(() => {
      window.scrollY = 300
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(false)

    // Quick jump back to top (scrollY = 30 < 80) -> immediately visible
    act(() => {
      window.scrollY = 30
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBe(true)

    rafSpy.mockRestore()
  })
})
