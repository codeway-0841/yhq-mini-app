/**
 * Shared math engine — public barrel (Faza 2).
 *
 * math-board VA graph ikkalasi ham FAQAT shu barrel orqali import qiladi.
 *
 * TODO (extraction): graph feature'dagi `lib/math/{parse,compile,normalize,
 * builtins}` shu engine'ga ko'chiriladi. Hozir graph'ga TEGILMAYDI (regressiya
 * riski) — engine mustaqil nusxa. Conformance test
 * (`tests/unit/lib/math-engine.test.ts`) ikkalasi bir xil yo'l tutishini
 * qo'riqlaydi; ko'chirish shu test yashil holatda alohida commit bo'ladi.
 */

export type {
  BinaryOp,
  MathNode,
  StepNode,
  Problem,
  CheckStatus,
  CheckDetail,
  CheckResult,
  CheckStepArgs,
} from './ast'
export { ENGINE_LIMITS, CHECK_DETAILS, collectVars, stepVars, nodeDepth } from './ast'
export { parseStep, normalizeInput, EngineParseError } from './parser'
export type { EngineParseErrorCode } from './parser'
export { normalize, exactEqual, canonicalKey, evaluate, isTotal, constValue, validConstBase, powTotalByRule } from './normalize'
export type { Scope } from './normalize'
export { checkDomain, exclusions, sameExclusions } from './domain'
export type { DomainIssue } from './domain'
export { checkStep } from './check-step'
export { polyExpand, polyEqual, polyScaleFactor, rationalEqual, rationalForm, mulPoly } from './poly'
export type { Poly } from './poly'
