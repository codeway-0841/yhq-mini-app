/**
 * Math Board — yakuniy javob detekti (Faza 3, P0-B strict).
 *
 * Ochiq tenglama FAQAT izolyatsiyalangan ko'rinishda solved:
 *   `x = finalAnswer` yoki `finalAnswer = x`
 * (x = problem target variable). Bir tomonida final uchragani YETARLI EMAS:
 * `(5*x-3)/4=3` (promptning o'zi!) solved bo'lmasligi shart.
 */

import { ENGINE_LIMITS, evaluate, exactEqual, parseStep, stepVars } from '../../../shared/math-engine'

export function isSolvedStep(acceptedAscii: string, finalAnswerAscii: string, targetVariable = 'x'): boolean {
  let step: ReturnType<typeof parseStep>
  let fin: ReturnType<typeof parseStep>
  try {
    step = parseStep(acceptedAscii)
    fin = parseStep(finalAnswerAscii)
  } catch {
    return false
  }
  if (step.kind !== 'equation' || fin.kind !== 'expr') return false
  // Yopiq tenglama (o'zgaruvchisiz): rost + bir tomoni finalga teng
  // (`log(2,32)=5`, `5=5` — qiymat-e'lon oqimi).
  if (stepVars(step).length === 0) {
    // Yolg'on yopiq (`log(2,32)=4` chap tomoni 5 ga folds bo'ladi).
    if (closedTruth(acceptedAscii) !== true) return false
    return exactEqual(step.left, fin.node) || exactEqual(step.right, fin.node)
  }
  // P0-B: OCHIQ tenglama FAQAT izolyatsiyalangan ko'rinishda solved:
  // `x = final` yoki `final = x`. Bir tomonida final uchragani YETARLI EMAS
  // (`(5*x-3)/4=3` promptning o'zi solved bo'lmasligi shart).
  return (step.left.type === 'var' && step.left.name === targetVariable && exactEqual(step.right, fin.node))
    || (step.right.type === 'var' && step.right.name === targetVariable && exactEqual(step.left, fin.node))
}

/**
 * Yopiq (o'zgaruvchisiz) tenglama rostmi? `2^5=32` → true, `2+2=5` → false,
 * ochiq/ Baholanmaydigan → null.
 */
export function closedTruth(ascii: string): boolean | null {
  let step: ReturnType<typeof parseStep>
  try {
    step = parseStep(ascii)
  } catch {
    return null
  }
  if (step.kind !== 'equation' || stepVars(step).length > 0) return null
  const l = evaluate(step.left, {})
  const r = evaluate(step.right, {})
  if (!Number.isFinite(l) || !Number.isFinite(r)) return null
  const diff = Math.abs(l - r)
  if (diff <= ENGINE_LIMITS.absTol) return true
  return diff <= ENGINE_LIMITS.relTol * Math.max(Math.abs(l), Math.abs(r)) ? true : false
}
