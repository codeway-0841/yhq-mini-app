/**
 * Math Board — useOnline hook (Faza 7 offline).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnline } from '../../../src/features/math-board/hooks/useOnline'

describe('useOnline', () => {
  it('default online, offline event → false, online → true', () => {
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
