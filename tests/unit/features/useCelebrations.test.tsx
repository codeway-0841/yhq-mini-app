/**
 * Level-up sahnasi qachon ko'rinishi — `yhq-level-seen` yozuvi mantig'i.
 *
 * Muhim keys: level endi SERVER XP'sidan hisoblanadi (avval totalCorrect/50
 * edi va ancha baland chiqardi), shuning uchun eski yozuv joriy leveldan
 * yuqori bo'lishi mumkin — bu holat to'g'ri qayta bazalanishi kerak.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCelebrations } from '../../../src/features/dashboard/hooks/useCelebrations'

const KEY = 'yhq-level-seen'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

describe('useCelebrations — level up', () => {
  it('birinchi ishga tushirishda sahna chiqmaydi, joriy level yoziladi', () => {
    const { result } = renderHook(() => useCelebrations(5, 0, 'yhq'))

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('5')
  })

  it('level oshsa sahna ko\'rsatiladi va yozuv yangilanadi', () => {
    localStorage.setItem(KEY, '4')
    const { result } = renderHook(() => useCelebrations(5, 0, 'yhq'))

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBe(5)
    expect(localStorage.getItem(KEY)).toBe('5')
  })

  it('level o\'zgarmasa sahna yo\'q', () => {
    localStorage.setItem(KEY, '5')
    const { result } = renderHook(() => useCelebrations(5, 0, 'yhq'))

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBeNull()
  })

  it('REGRESSIYA: eski (shishgan) yozuv joriy leveldan yuqori bo\'lsa qayta bazalanadi', () => {
    // Eski formula (totalCorrect/50) 8-level bergan, yangi XP formulasi 1 beradi
    localStorage.setItem(KEY, '8')
    const { result } = renderHook(() => useCelebrations(1, 0, 'yhq'))

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBeNull()      // pasayganda sahna yo'q
    expect(localStorage.getItem(KEY)).toBe('1')    // yozuv joriy holatga tushdi
  })

  it('qayta bazalangach keyingi level-up normal ishlaydi', () => {
    localStorage.setItem(KEY, '8')
    const first = renderHook(() => useCelebrations(1, 0, 'yhq'))
    act(() => { vi.advanceTimersByTime(1000) })
    first.unmount()

    const { result } = renderHook(() => useCelebrations(2, 0, 'yhq'))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBe(2)
  })

  it('buzilgan yozuv (raqam emas) ham qayta bazalanadi', () => {
    localStorage.setItem(KEY, 'buzuq')
    const { result } = renderHook(() => useCelebrations(3, 0, 'yhq'))

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.levelUp).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('3')
  })
})
