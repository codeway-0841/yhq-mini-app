/**
 * Shared math engine — AST tiplari (Faza 2).
 *
 * Sof tiplar + kichik helperlar. Hech qanday feature/content import qilmaydi
 * (qoida 1a: shared pastki qatlam). Eval/parse alohida modullarda.
 */

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^'

export type MathNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'const'; name: string; value: number }
  | { type: 'unary'; op: '-' | '+'; arg: MathNode }
  | { type: 'binary'; op: BinaryOp; left: MathNode; right: MathNode }
  | { type: 'call'; name: string; args: MathNode[] }

export type StepNode =
  | { kind: 'expr'; node: MathNode }
  | { kind: 'equation'; left: MathNode; right: MathNode }

export interface Problem {
  id: string
  promptLatex: string
  assumptions: string[]
  goal: string
  domain?: string[]
}

export type CheckStatus =
  | 'correct'
  | 'probably_correct'
  | 'uncertain'
  | 'wrong'
  | 'invalid_transition'
  | 'domain_error'
  | 'syntax_error'
  | 'unknown'

/**
 * Barcha mashina-o'qiladigan detail kodlar — YAGONA RO'YXAT.
 *
 * `CheckResult.detail` shu union bilan tiplangan: yangi literal qo'shsangiz
 * SHU ro'yxatga ham qo'shing (aks holda tsc yiqiladi). Server zod enum
 * (`math-board.router` HintBodySchema) shu ro'yxatdan derive bo'ladi —
 * desync bo'lmaydi.
 */
export const CHECK_DETAILS = [
  'empty',
  'too_long',
  'too_complex',
  'parse_exception',
  'syntax',
  'closed_false',
  'true_but_unrelated',
  'unrelated_true',
  'identical_exact',
  'sides_swapped_exact',
  'value_assert_exact',
  'value_assert_numeric',
  'opening_true',
  'kind_mismatch',
  'equivalent_numeric',
  'not_equivalent',
  'poly_exact',
  'poly_identical',
  'poly_scaled',
  'trivial_agreement',
  'solution_set_preserved',
  'extraneous_or_not_equivalent',
  'domain_mismatch',
  'insufficient_samples',
  'unevaluable',
  'time',
  'unreachable',
  'exception',
  'division_by_zero',
  'zero_to_zero',
  'zero_to_negative',
  'log_domain',
  'log_base',
  'sqrt_negative',
  'trig_domain',
] as const

export type CheckDetail = (typeof CHECK_DETAILS)[number]

export interface CheckResult {
  status: CheckStatus
  /** Hint qatlami (Faza 5) uchun mashina-o'qiladigan sabab kodi */
  detail: CheckDetail
}

export interface CheckStepArgs {
  problem: Problem
  /** Oxirgi QABUL qilingan qadam (noto'g'ri qadam baza bo'lmaydi) */
  previousAcceptedStep: string
  candidateStep: string
  /** Deterministik sampling urug'i (default sabit — testlar takrorlanuvchan) */
  seed?: number
  /**
   * Birinchi qadam rejimi (previousAcceptedStep == problem prompt).
   * Yopiq-rost ochilish FAQAT semantik bog'liqlikda qabul qilinadi
   * (qiymat-e'lon yoki log↔exp transform) — aks holda `unrelated_true`.
   */
  first?: boolean
}

/** Limitlar — parser/check-step ikkalasi ham hurmat qiladi */
export const ENGINE_LIMITS = {
  maxInputLength: 200,
  maxNodes: 500,
  maxDepth: 80,
  sampleCount: 12,
  minValidSamples: 5,
  /** probably uchun nontrivial (noldan farqli) kelishuvlar soni (P0-A) */
  minNontrivialSamples: 3,
  absTol: 1e-9,
  relTol: 1e-9,
  /** Lokal check byudjeti — oshsa `unknown` (time) */
  timeBudgetMs: 40,
} as const

/** Erkin o'zgaruvchilar — paydo bo'lish tartibida, takrorsiz */
export function collectVars(node: MathNode): string[] {
  const seen: string[] = []
  const mark = (name: string): void => {
    if (!seen.includes(name)) seen.push(name)
  }
  const walk = (n: MathNode): void => {
    switch (n.type) {
      case 'num': return
      case 'const': return
      case 'var': mark(n.name); return
      case 'unary': walk(n.arg); return
      case 'binary': walk(n.left); walk(n.right); return
      case 'call': for (const a of n.args) walk(a); return
    }
  }
  walk(node)
  return seen
}

export function stepVars(step: StepNode): string[] {
  if (step.kind === 'expr') return collectVars(step.node)
  const out: string[] = []
  for (const v of [...collectVars(step.left), ...collectVars(step.right)]) {
    if (!out.includes(v)) out.push(v)
  }
  return out
}

/** AST chuqurligi (limit nazorati uchun) */
export function nodeDepth(node: MathNode): number {
  switch (node.type) {
    case 'num': case 'var': case 'const': return 1
    case 'unary': return 1 + nodeDepth(node.arg)
    case 'binary': return 1 + Math.max(nodeDepth(node.left), nodeDepth(node.right))
    case 'call': return 1 + node.args.reduce((m, a) => Math.max(m, nodeDepth(a)), 0)
  }
}
