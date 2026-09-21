/**
 * Math Board — recognition xato mapper testi (skrinshot bugfix).
 *
 * 429/503/timeout/network → aniq i18n kalit; hammesi "Qayta urinish" emas.
 */
import { describe, it, expect } from 'vitest'
import { ApiError } from '../../../src/shared/api'
import { recognitionErrorKey } from '../../../src/features/math-board/lib/recognize-errors'

describe('recognitionErrorKey', () => {
  it('429 free → quotaFree, 429 daily → quotaDaily', () => {
    expect(recognitionErrorKey(new ApiError(429, 'x', 'free_limit_exceeded'))).toBe('mathBoardQuotaFree')
    expect(recognitionErrorKey(new ApiError(429, 'x', 'daily_limit'))).toBe('mathBoardQuotaDaily')
  })

  it('503 → aiOff', () => {
    expect(recognitionErrorKey(new ApiError(503, 'x'))).toBe('mathBoardAiOff')
  })

  it('timeout → tryAgain', () => {
    expect(recognitionErrorKey(new ApiError(408, 'x', 'timeout'))).toBe('mathBoardTryAgain')
  })

  it('noma’lum → tryAgain', () => {
    expect(recognitionErrorKey(new ApiError(502, 'x'))).toBe('mathBoardUnreadable')
    expect(recognitionErrorKey(new Error('boom'))).toBe('mathBoardTryAgain')
  })

  it('404 → serverOld (eski backend)', () => {
    expect(recognitionErrorKey(new ApiError(404, 'x'))).toBe('mathBoardServerOld')
  })
})
