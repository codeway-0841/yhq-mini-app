/**
 * Math Board — useStepCheck: debounce + revisionId stale-himoya (Faza 3).
 *
 * Talab: debounce 150–200ms; eskirgan (stale) natija ekranga chiqmaydi —
 * faqat oxirgi kiritish baholanadi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStepCheck, STEP_DEBOUNCE_MS } from '../../../src/features/math-board/hooks/useStepCheck'
import { boardProblemById } from '../../../src/features/math-board/lib/problems'

const BOARD = boardProblemById('log-1')

function renderCheck(initialAscii: string, previousAscii: string, isFirst: boolean) {
  return renderHook(
    ({ ascii, prev, first }) => useStepCheck(ascii, BOARD.problem, prev, first),
    { initialProps: { ascii: initialAscii, prev: previousAscii, first: isFirst } },
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useStepCheck', () => {
  it('boshida idle, kiritishdan keyin checking', () => {
    const { result, rerender } = renderCheck('', BOARD.promptAscii, true)
    expect(result.current.status).toBe('idle')
    rerender({ ascii: 'log(2,32)=5', prev: BOARD.promptAscii, first: true })
    expect(result.current.status).toBe('checking')
  })

  it('debounce byudjeti 150–200ms oraligida', () => {
    expect(STEP_DEBOUNCE_MS).toBeGreaterThanOrEqual(150)
    expect(STEP_DEBOUNCE_MS).toBeLessThanOrEqual(200)
  })

  it('togri qadam correct/probably_correct beradi', () => {
    const { result, rerender } = renderCheck('', BOARD.promptAscii, true)
    rerender({ ascii: 'log(2,32)=5', prev: BOARD.promptAscii, first: true })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    expect(['correct', 'probably_correct']).toContain(result.current.status)
  })

  it('stale natija tashlanadi — faqat oxirgi kiritish baholanadi', () => {
    const { result, rerender } = renderCheck('', BOARD.promptAscii, true)
    // Tez ketma-ket 2 kiritish: birinchisi eskiradi
    rerender({ ascii: 'x+', prev: BOARD.promptAscii, first: true })
    rerender({ ascii: 'log(2,32)=5', prev: BOARD.promptAscii, first: true })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    // Oxirgi (togri) natija — syntax_error (eski 'x+') emas
    expect(['correct', 'probably_correct']).toContain(result.current.status)
  })

  it("bo'sh kiritish idle qaytaradi va revision'ni bekor qiladi", () => {
    const { result, rerender } = renderCheck('', BOARD.promptAscii, true)
    rerender({ ascii: 'log(2,32)=5', prev: BOARD.promptAscii, first: true })
    rerender({ ascii: '   ', prev: BOARD.promptAscii, first: true })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    expect(result.current.status).toBe('idle')
  })

  it('birinchi qadam yopiq-rost ochilish → opening_true', () => {
    const { result, rerender } = renderCheck('', BOARD.promptAscii, true)
    rerender({ ascii: '2^5=32', prev: BOARD.promptAscii, first: true })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    expect(result.current).toEqual({ status: 'probably_correct', detail: 'opening_true' })
  })

  it('birinchi bolmagan qadamda yumshatish ishlamaydi', () => {
    const { result, rerender } = renderCheck('', 'x=1', false)
    rerender({ ascii: '2^5=32', prev: 'x=1', first: false })
    act(() => {
      vi.advanceTimersByTime(STEP_DEBOUNCE_MS + 50)
    })
    expect(result.current.status).toBe('invalid_transition')
  })
})
