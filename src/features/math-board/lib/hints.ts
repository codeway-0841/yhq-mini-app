/**
 * Math Board — lokal hint qoidalari (Faza 5).
 *
 * Tartib: avval LOKAL hint (tez, bepul, deterministik). LLM faqat:
 *  1. bir xil xato 2-marta takrorlansa, yoki
 *  2. lokal qoida hint topa olmasa (`unknown` / noma'lum detail).
 * LLM ishlamasa — deterministik fallback (umumiy hint) qoladi.
 */

import type { Keys } from '../../../shared/i18n'
import type { CheckResult } from '../../../shared/math-engine'

/** Engine detail → lokal hint i18n kaliti (bo'lmasa null = LLM nomzodi) */
const LOCAL_HINTS: Record<string, Keys> = {
  closed_false: 'mathBoardHintArithmetic',
  division_by_zero: 'mathBoardHintDivZero',
  zero_to_zero: 'mathBoardHintDivZero',
  zero_to_negative: 'mathBoardHintDivZero',
  log_domain: 'mathBoardHintLogDomain',
  log_base: 'mathBoardHintLogBase',
  sqrt_negative: 'mathBoardHintSqrt',
  trig_domain: 'mathBoardHintDomain',
  extraneous_or_not_equivalent: 'mathBoardHintExtraneous',
  not_equivalent: 'mathBoardHintNotFollow',
  true_but_unrelated: 'mathBoardHintUnrelated',
  kind_mismatch: 'mathBoardHintKind',
  unrelated_true: 'mathBoardHintUnrelated',
  domain_mismatch: 'mathBoardHintUncertain',
  trivial_agreement: 'mathBoardHintUncertain',
  empty: 'mathBoardHintEmpty',
  syntax: 'mathBoardHintSyntax',
}

/** Deterministik fallback — LLM o'chiq/bo'sh bo'lsa */
export const FALLBACK_HINT_KEY = 'mathBoardHintFallback' as Keys

/** Berilgan check natijasi uchun lokal hint kaliti (topilmasa null) */
export function localHintKey(result: CheckResult): Keys | null {
  if (result.status === 'correct' || result.status === 'probably_correct') return null
  return LOCAL_HINTS[result.detail] ?? null
}

/**
 * LLM tugmasi ko'rsatilsinmi? (sof funksiya — testda qoplanadi)
 * - bir xil detail 2+ marta ketma-ket, yoki
 * - lokal hint yo'q (unknown/noma'lum).
 */
export function shouldOfferLlmHint(args: {
  detail: string
  consecutiveCount: number
  hasLocalHint: boolean
}): boolean {
  if (args.consecutiveCount >= 2) return true
  return !args.hasLocalHint
}
