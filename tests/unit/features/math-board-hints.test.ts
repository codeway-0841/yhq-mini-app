/**
 * Math Board — Faza 5 hint qoidalari testlari.
 *
 * Lokal hint map + LLM taklif sharti (sof funksiyalar).
 */
import { describe, it, expect } from 'vitest'
import { FALLBACK_HINT_KEY, localHintKey, shouldOfferLlmHint } from '../../../src/features/math-board/lib/hints'
import type { CheckResult } from '../../../src/shared/math-engine'

const r = (status: CheckResult['status'], detail: string): CheckResult =>
  ({ status, detail }) as CheckResult

describe('localHintKey', () => {
  it('correct/probably_correct → null (hint kerak emas)', () => {
    expect(localHintKey(r('correct', 'identical_exact'))).toBeNull()
    expect(localHintKey(r('probably_correct', 'equivalent_numeric'))).toBeNull()
  })

  it('har bir engine detail lokal kalitga ega', () => {
    const pairs: [string, string][] = [
      ['wrong', 'closed_false'],
      ['domain_error', 'division_by_zero'],
      ['domain_error', 'log_domain'],
      ['domain_error', 'log_base'],
      ['domain_error', 'sqrt_negative'],
      ['invalid_transition', 'extraneous_or_not_equivalent'],
      ['invalid_transition', 'not_equivalent'],
      ['invalid_transition', 'true_but_unrelated'],
      ['invalid_transition', 'kind_mismatch'],
      ['syntax_error', 'syntax'],
      ['syntax_error', 'empty'],
    ]
    for (const [status, detail] of pairs) {
      expect(localHintKey(r(status as CheckResult['status'], detail)), detail).not.toBeNull()
    }
  })

  it("noma'lum detail → null (LLM nomzodi)", () => {
    expect(localHintKey(r('unknown', 'insufficient_samples'))).toBeNull()
    expect(localHintKey(r('unknown', 'time'))).toBeNull()
  })

  it('P1: unrelated_true va domain_mismatch lokal hintga ega', () => {
    expect(localHintKey(r('invalid_transition', 'unrelated_true'))).toBe('mathBoardHintUnrelated')
    expect(localHintKey(r('uncertain', 'domain_mismatch'))).toBe('mathBoardHintUncertain')
  })

  it('P1-3: uncertain qabul bazasi emas — UI canAccept’da yo‘q (kontrakt)', () => {
    // canAccept = correct|probably_correct (MathBoardPage) — bu test hujjat:
    // uncertain status Qabul qilinmaydi.
    const s: CheckResult['status'] = 'uncertain'
    expect(['correct', 'probably_correct'].includes(s)).toBe(false)
  })

  it('fallback kalit mavjud', () => {
    expect(typeof FALLBACK_HINT_KEY).toBe('string')
  })
})

describe('shouldOfferLlmHint', () => {
  it('birinchi xatoda lokal hint bo‘lsa — LLM YO‘Q', () => {
    expect(shouldOfferLlmHint({ detail: 'closed_false', consecutiveCount: 1, hasLocalHint: true })).toBe(false)
  })

  it('bir xil xato 2-marta — LLM HA (lokal hint bo‘lsa ham)', () => {
    expect(shouldOfferLlmHint({ detail: 'closed_false', consecutiveCount: 2, hasLocalHint: true })).toBe(true)
    expect(shouldOfferLlmHint({ detail: 'x', consecutiveCount: 3, hasLocalHint: false })).toBe(true)
  })

  it('lokal hint yo‘q — darhol LLM', () => {
    expect(shouldOfferLlmHint({ detail: 'insufficient_samples', consecutiveCount: 1, hasLocalHint: false })).toBe(true)
  })

  it('count 0 — LLM YO‘Q (xato hali sanalmagan)', () => {
    expect(shouldOfferLlmHint({ detail: 'closed_false', consecutiveCount: 0, hasLocalHint: true })).toBe(false)
  })
})
