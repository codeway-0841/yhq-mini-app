/**
 * useAnswerTimer — savolga javob berish vaqtini o'lchaydi.
 * Savol almashganda hisob qaytadan boshlanishi shart, aks holda oldingi
 * savolda o'ylab o'tirgan vaqt keyingisiga qo'shilib ketadi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnswerTimer } from '../../../src/shared/hooks/useAnswerTimer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-23T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAnswerTimer', () => {
  it('o\'tgan vaqtni millisekundda qaytaradi', () => {
    const { result } = renderHook(() => useAnswerTimer(1))

    vi.advanceTimersByTime(4200)
    expect(result.current.elapsed()).toBe(4200)
  })

  it('savol almashganda hisob NOLDAN boshlanadi', () => {
    const { result, rerender } = renderHook(({ id }) => useAnswerTimer(id), {
      initialProps: { id: 1 },
    })

    vi.advanceTimersByTime(9000)   // 1-savolda uzoq o'yladi
    rerender({ id: 2 })            // keyingi savol chiqdi

    expect(result.current.elapsed()).toBe(0)
    vi.advanceTimersByTime(1500)
    expect(result.current.elapsed()).toBe(1500)   // 10500 EMAS
  })

  it('bir xil savol qayta render bo\'lsa hisob davom etadi', () => {
    const { result, rerender } = renderHook(({ id }) => useAnswerTimer(id), {
      initialProps: { id: 7 },
    })

    vi.advanceTimersByTime(2000)
    rerender({ id: 7 })            // boshqa sabab bilan render
    vi.advanceTimersByTime(1000)

    expect(result.current.elapsed()).toBe(3000)
  })

  it('restart() qo\'lda qayta boshlaydi', () => {
    const { result } = renderHook(() => useAnswerTimer(1))

    vi.advanceTimersByTime(5000)
    result.current.restart()
    expect(result.current.elapsed()).toBe(0)
  })

  it('elapsed hech qachon manfiy bo\'lmaydi (soat orqaga surilsa)', () => {
    const { result } = renderHook(() => useAnswerTimer(1))

    vi.setSystemTime(new Date('2026-08-23T09:59:00Z'))   // soat 1 daqiqa orqaga
    expect(result.current.elapsed()).toBe(0)
  })
})
