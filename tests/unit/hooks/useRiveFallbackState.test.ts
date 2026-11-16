import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRiveFallbackState } from '../../../src/shared/hooks/useRiveFallbackState'

describe('useRiveFallbackState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tez (<160ms) yuklashda fallbackni ko‘rsatmaydi va silliq kechikishsiz ochiladi', () => {
    const { result } = renderHook(() => useRiveFallbackState(160))

    expect(result.current.status).toBe('loading')
    expect(result.current.showFallback).toBe(false)

    act(() => {
      vi.advanceTimersByTime(60)
      result.current.markReady()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.showFallback).toBe(false)
    expect(result.current.shouldFadeIn).toBe(false)
    expect(result.current.canvasVisibilityClass).toBe('opacity-100')
  })

  it('sekin (>160ms) yuklashda fallbackni ko‘rsatadi va tayyor bo‘lganda silliq almashadi', () => {
    const { result } = renderHook(() => useRiveFallbackState(160))

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(result.current.status).toBe('loading')
    expect(result.current.showFallback).toBe(true)

    act(() => {
      result.current.markReady()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.showFallback).toBe(false)
    expect(result.current.shouldFadeIn).toBe(true)
    expect(result.current.canvasVisibilityClass).toContain('transition-opacity')
  })

  it('xato va qayta yuklash (beginLoading) holatlarini to‘g‘ri tiklaydi', () => {
    const { result } = renderHook(() => useRiveFallbackState(160))

    act(() => {
      result.current.markError()
    })
    expect(result.current.status).toBe('error')
    expect(result.current.showFallback).toBe(true)
    expect(result.current.canvasVisibilityClass).toBe('opacity-0')

    act(() => {
      result.current.beginLoading()
    })
    expect(result.current.status).toBe('loading')
    expect(result.current.showFallback).toBe(false)

    act(() => {
      vi.advanceTimersByTime(165)
    })
    expect(result.current.showFallback).toBe(true)
  })
})
