/**
 * Shared math engine — qadam tekshiruvchi (Faza 2 + review P1).
 *
 * API: `checkStep({ problem, previousAcceptedStep, candidateStep, seed?, first? })`
 *
 * Tartib:
 *  1. Parse → syntax_error (empty/too_long/too_complex → unknown)
 *  2. Domain → domain_error
 *  3. Exact normalize → correct
 *  4. Tenglama bo'lsa solution-set saqlanishi (nisbat-konstanta testi)
 *  5. Deterministik sampling (fallback) → probably_correct / uncertain
 *  6. Relative + absolute tolerance, time/AST-depth limit → unknown
 *
 * Invariantlar (P1):
 *  - Sampling `correct` BERMaydi — faqat `probably_correct` (domain toza bo'lsa).
 *  - Qiymat mos, lekin aniqlanmagan nuqtalar farqi bo'lsa → `uncertain`
 *    (burchak nuqtalar 0/1/-1 har doim sample'da). `uncertain` progression
 *    bazasi bo'lmaydi — UI Qabul'ni o'chiradi.
 *  - Birinchi qadam (`first`): yopiq-rost ochilish FAQAT semantik bog'liqlikda
 *    (qiymat-e'lon yoki log↔exp transform) — aks holda `unrelated_true`.
 */

import {
  ENGINE_LIMITS,
  stepVars,
  type CheckResult,
  type CheckStepArgs,
  type MathNode,
  type StepNode,
} from './ast'
import { EngineParseError, parseStep } from './parser'
import { evaluate, exactEqual } from './normalize'
import { checkDomain, sameExclusions } from './domain'
import { polyEqual, polyExpand, polyScaleFactor, rationalEqual, rationalForm, mulPoly } from './poly'

/** Deterministik PRNG (mulberry32) — seeded sampling takrorlanuvchan */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POOL = [-3, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3, 5, 0.25]

/**
 * Deterministik sample'lar (P0-A): burchak nuqtalar (0/1/-1 — domain farqlari
 * aynan shu yerda ko'rinadi) HAR DOIM + seeded MUSTAQIL shuffle.
 *
 * Eski stride (`i*3 % 12`, davr=4) dedupe bilan 5 scope qoldirib
 * `insufficient_samples` berardi. Endi har o'zgaruvchi o'z aralashtirilgan
 * pool'idan oladi (korrelyatsiyasiz), kombinatsiyalar unikal, hammasi
 * deterministik (bitta mulberry32 oqimi).
 */
function sampleValues(vars: string[], count: number, seed: number): Record<string, number>[] {
  const vs = vars.length > 0 ? vars : ['__x']
  const rand = mulberry32(seed)
  const shuffle = (): number[] => {
    const arr = [...POOL]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }
  let pools = vs.map(() => shuffle())
  const seen = new Set<string>()
  const scopes: Record<string, number>[] = []
  const push = (scope: Record<string, number>): void => {
    const key = vs.map((v) => scope[v]).join(',')
    if (seen.has(key)) return
    seen.add(key)
    scopes.push(scope)
  }
  for (const corner of [0, 1, -1]) {
    const scope: Record<string, number> = {}
    for (const v of vs) scope[v] = corner
    push(scope)
  }
  let i = 0
  while (scopes.length < count && i < count * 8) {
    if (i > 0 && i % POOL.length === 0) pools = vs.map(() => shuffle())
    const scope: Record<string, number> = {}
    vs.forEach((v, vi) => {
      scope[v] = pools[vi][i % POOL.length]
    })
    push(scope)
    i++
  }
  return scopes
}

function close(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const diff = Math.abs(a - b)
  if (diff <= ENGINE_LIMITS.absTol) return true
  return diff <= ENGINE_LIMITS.relTol * Math.max(Math.abs(a), Math.abs(b))
}

function diffOf(eq: { left: MathNode; right: MathNode }, scope: Record<string, number>): number | null {
  const l = evaluate(eq.left, scope)
  const r = evaluate(eq.right, scope)
  if (!Number.isFinite(l) || !Number.isFinite(r)) return null
  return l - r
}

/**
 * Nisbat-konstanta testi: d2 = k*d1 (k≠0 konstanta) yoki ikkalasi aynan nol.
 * `x=1 → x²=1` kabi begona ildiz kiritishni ushlaydi (nisbat x+1 — konstanta emas).
 * `domainMismatch`: bir tomon aniqlanmagan, ikkinchisi aniqlangan nuqta bor
 * (masalan maxraj qisqartirilganda) — P1-3: `uncertain` uchun signal.
 */
function followsByRatio(
  prev: { left: MathNode; right: MathNode },
  cand: { left: MathNode; right: MathNode },
  vars: string[],
  seed: number,
  deadline: number,
): { follows: boolean; validSamples: number; nontrivialSamples: number; decided: boolean; domainMismatch: boolean } {
  const scopes = sampleValues(vars, ENGINE_LIMITS.sampleCount, seed)
  let ratio: number | null = null
  let valid = 0
  let nontrivial = 0
  let domainMismatch = false
  for (const s of scopes) {
    if (performance.now() > deadline) break
    const d1 = diffOf(prev, s)
    const d2 = diffOf(cand, s)
    if (d1 === null || d2 === null) {
      if ((d1 === null) !== (d2 === null)) domainMismatch = true
      continue
    }
    valid++
    // P0-A nontrivial: ikkalasi nol bo'lgan kelishuv dalil emas (sparse ildizlar)
    if (Math.max(Math.abs(d1), Math.abs(d2)) > 1e-6) nontrivial++
    const z1 = Math.abs(d1) <= ENGINE_LIMITS.absTol
    const z2 = Math.abs(d2) <= ENGINE_LIMITS.absTol
    if (z1 && z2) continue
    // Ajratuvchi nuqta topildi — dalil bor, namuna sonidan qat'i nazar hal qilindi
    if (z1 !== z2) return { follows: false, validSamples: valid, nontrivialSamples: nontrivial, decided: true, domainMismatch }
    const k = d2 / d1
    if (!Number.isFinite(k) || Math.abs(k) < 1e-12) return { follows: false, validSamples: valid, nontrivialSamples: nontrivial, decided: true, domainMismatch }
    if (ratio === null) ratio = k
    else if (!close(k, ratio)) return { follows: false, validSamples: valid, nontrivialSamples: nontrivial, decided: true, domainMismatch }
  }
  if (valid < ENGINE_LIMITS.minValidSamples) return { follows: false, validSamples: valid, nontrivialSamples: nontrivial, decided: false, domainMismatch }
  return { follows: true, validSamples: valid, nontrivialSamples: nontrivial, decided: true, domainMismatch }
}

function exprEquivalent(a: MathNode, b: MathNode, vars: string[], seed: number, deadline: number): { eq: boolean; valid: number; nontrivial: number; decided: boolean; domainMismatch: boolean } {
  const scopes = sampleValues(vars.length > 0 ? vars : ['__x'], ENGINE_LIMITS.sampleCount, seed)
  let valid = 0
  let nontrivial = 0
  let domainMismatch = false
  for (const s of scopes) {
    if (performance.now() > deadline) break
    const va = evaluate(a, s)
    const vb = evaluate(b, s)
    const na = !Number.isFinite(va)
    const nb = !Number.isFinite(vb)
    if (na || nb) {
      if (na !== nb) domainMismatch = true
      continue
    }
    valid++
    if (Math.max(Math.abs(va), Math.abs(vb)) > 1e-6) nontrivial++
    // Qarshi-misol topildi — hal qilindi (namuna soni muhim emas)
    if (!close(va, vb)) return { eq: false, valid, nontrivial, decided: true, domainMismatch }
  }
  if (valid < ENGINE_LIMITS.minValidSamples) return { eq: false, valid, nontrivial, decided: false, domainMismatch }
  return { eq: true, valid, nontrivial, decided: true, domainMismatch }
}

function isClosed(step: StepNode): boolean {
  return stepVars(step).length === 0
}

function closedTruth(eq: { left: MathNode; right: MathNode }): boolean | null {
  const l = evaluate(eq.left, {})
  const r = evaluate(eq.right, {})
  if (!Number.isFinite(l) || !Number.isFinite(r)) return null
  return close(l, r)
}

/** log(b,v) / log2 / log10|lg / ln shaklini ajratadi (P1-4 first-step) */
function matchLogForm(n: MathNode): { base: MathNode; arg: MathNode } | null {
  if (n.type !== 'call') return null
  if (n.name === 'log' && n.args.length === 2) return { base: n.args[0], arg: n.args[1] }
  if (n.name === 'log2' && n.args.length === 1) return { base: { type: 'num', value: 2 }, arg: n.args[0] }
  if ((n.name === 'log10' || n.name === 'lg') && n.args.length === 1) {
    return { base: { type: 'num', value: 10 }, arg: n.args[0] }
  }
  if (n.name === 'ln' && n.args.length === 1) {
    return { base: { type: 'const', name: 'e', value: Math.E }, arg: n.args[0] }
  }
  return null
}

/** b^w / pow(b,w) shaklini ajratadi (P1-4 first-step, teskari yo'nalish) */
function matchPowForm(n: MathNode): { base: MathNode; exp: MathNode } | null {
  if (n.type === 'binary' && n.op === '^') return { base: n.left, exp: n.right }
  if (n.type === 'call' && n.name === 'pow' && n.args.length === 2) {
    return { base: n.args[0], exp: n.args[1] }
  }
  return null
}

/**
 * Prompt ↔ kandidat orasidagi semantik bog' (P1-4): `2+2=4` kabi bog'lanmagan
 * rost tenglama `unrelated_true` bo'ladi, faqat ikki shakl ruxsat:
 *  - prompt log(b,v): kandidat tomonlaridan biri ≡ v, ikkinchisi b^(...) ;
 *  - prompt b^w (yopiq sonli): kandidat log(b',v') bilan b'≡b, v'==P sonli.
 */
function logExpLink(prompt: MathNode, left: MathNode, right: MathNode): boolean {
  const log = matchLogForm(prompt)
  if (log) {
    const pairs: [MathNode, MathNode][] = [[left, right], [right, left]]
    return pairs.some(([a, b]) => {
      if (!exactEqual(a, log.arg)) return false
      const pw = matchPowForm(b)
      return pw !== null && exactEqual(pw.base, log.base)
    })
  }
  const pw = matchPowForm(prompt)
  if (pw) {
    const pv = evaluate(prompt, {})
    if (!Number.isFinite(pv)) return false
    const checkSide = (s: MathNode): boolean => {
      const lg = matchLogForm(s)
      if (!lg || !exactEqual(lg.base, pw.base)) return false
      const vv = evaluate(lg.arg, {})
      return Number.isFinite(vv) && close(vv, pv)
    }
    return checkSide(left) || checkSide(right)
  }
  return false
}

export function checkStep(args: CheckStepArgs): CheckResult {
  const deadline = performance.now() + ENGINE_LIMITS.timeBudgetMs
  const seed = args.seed ?? 0xC0FFEE

  let prev: StepNode
  let cand: StepNode
  try {
    prev = parseStep(args.previousAcceptedStep)
    cand = parseStep(args.candidateStep)
  } catch (e) {
    if (e instanceof EngineParseError) {
      if (e.code === 'empty') return { status: 'syntax_error', detail: 'empty' }
      if (e.code === 'too_long') return { status: 'unknown', detail: 'too_long' }
      if (e.code === 'too_complex') return { status: 'unknown', detail: 'too_complex' }
      return { status: 'syntax_error', detail: 'syntax' }
    }
    return { status: 'unknown', detail: 'parse_exception' }
  }

  // Domain — kandidat uchun (avvalgi qabul qilingani toza deb olinadi)
  const domainIssues = checkDomain(cand, args.problem.assumptions)
  if (domainIssues.length > 0) {
    return { status: 'domain_error', detail: domainIssues[0].code }
  }

  // Birinchi qadam (previous == prompt): yopiq-rost ochilish FAQAT semantik
  // bog'liqlikda (P1-4). `2+2=4`, `1=1` kabi bog'lanmagan rost → unrelated_true.
  if (args.first && prev.kind === 'expr' && cand.kind === 'equation' && isClosed(cand)) {
    if (closedTruth(cand) === true) {
      if (exactEqual(cand.left, prev.node) || exactEqual(cand.right, prev.node)) {
        return { status: 'correct', detail: 'value_assert_exact' }
      }
      if (logExpLink(prev.node, cand.left, cand.right)) {
        return { status: 'probably_correct', detail: 'opening_true' }
      }
      return { status: 'invalid_transition', detail: 'unrelated_true' }
    }
    // Yolg'on/aniqlanmaydigan yopiq — umumiy oqim hal qiladi (wrong/unknown)
  }

  // Tur mosligi: ifoda↔tenglama — bitta istisno bilan invalid_transition
  if (prev.kind !== cand.kind) {
    // Istisno: prev ifoda E, cand `E = const` (qiymat e'lon qilish: log2(32) → log2(32)=5)
    if (prev.kind === 'expr' && cand.kind === 'equation') {
      const vars = stepVars(cand)
      if (vars.length === 0) {
        const t = closedTruth(cand)
        if (t === false) return { status: 'wrong', detail: 'closed_false' }
        if (t === true) {
          // P0-A: avval exact isbot (normalize + polinomial/rasional)
          if (exactEqual(prev.node, cand.left) || rationalEqual(prev.node, cand.left)) {
            if (!sameExclusions([prev.node], [cand.left])) {
              return { status: 'uncertain', detail: 'domain_mismatch' }
            }
            return { status: 'correct', detail: 'value_assert_exact' }
          }
          const { eq, nontrivial, domainMismatch } = exprEquivalent(prev.node, cand.left, stepVars({ kind: 'expr', node: prev.node }), seed, deadline)
          if (eq) {
            // P1-A/P0-A: cheklov farqi yoki faqat trivial kelishuv → uncertain
            if (domainMismatch || !sameExclusions([prev.node], [cand.left])) {
              return { status: 'uncertain', detail: 'domain_mismatch' }
            }
            if (nontrivial < ENGINE_LIMITS.minNontrivialSamples) {
              return { status: 'uncertain', detail: 'trivial_agreement' }
            }
            return { status: 'probably_correct', detail: 'value_assert_numeric' }
          }
          return { status: 'invalid_transition', detail: 'kind_mismatch' }
        }
        return { status: 'unknown', detail: 'unevaluable' }
      }
      return { status: 'invalid_transition', detail: 'kind_mismatch' }
    }
    return { status: 'invalid_transition', detail: 'kind_mismatch' }
  }

  if (prev.kind === 'expr' && cand.kind === 'expr') {
    if (exactEqual(prev.node, cand.node)) return { status: 'correct', detail: 'identical_exact' }
    // P0-A: polinomial/rasional exact isbot (sampling'dan oldin)
    if (rationalEqual(prev.node, cand.node)) {
      if (!sameExclusions([prev.node], [cand.node])) {
        return { status: 'uncertain', detail: 'domain_mismatch' }
      }
      return { status: 'correct', detail: 'poly_exact' }
    }
    const vars = [...new Set([...stepVars(prev), ...stepVars(cand)])]
    const { eq, decided, nontrivial, domainMismatch } = exprEquivalent(prev.node, cand.node, vars, seed, deadline)
    if (performance.now() > deadline) return { status: 'unknown', detail: 'time' }
    if (eq) {
      // P1-A/P0-A: fixed sample'lar ixtiyoriy teshikni (x=4) topolmaydi — cheklov
      // to'plami farq qilsa domain tengligi isbotlanmagan → uncertain.
      // Faqat trivial (nol-nol) kelishuv ham dalil emas → uncertain.
      if (domainMismatch || !sameExclusions([prev.node], [cand.node])) {
        return { status: 'uncertain', detail: 'domain_mismatch' }
      }
      if (nontrivial < ENGINE_LIMITS.minNontrivialSamples) {
        return { status: 'uncertain', detail: 'trivial_agreement' }
      }
      return { status: 'probably_correct', detail: 'equivalent_numeric' }
    }
    if (decided) return { status: 'invalid_transition', detail: 'not_equivalent' }
    return { status: 'unknown', detail: 'insufficient_samples' }
  }

  if (prev.kind === 'equation' && cand.kind === 'equation') {
    // Exact: ikkala tomon juftligi normalize'da mos
    if (exactEqual(prev.left, cand.left) && exactEqual(prev.right, cand.right)) {
      return { status: 'correct', detail: 'identical_exact' }
    }
    if (exactEqual(prev.left, cand.right) && exactEqual(prev.right, cand.left)) {
      return { status: 'correct', detail: 'sides_swapped_exact' }
    }
    // P0-A: differensiallar polinom/rasional shaklda bir xil yoki
    // konstanta-karra → bir xil ildizlar (d2 ≡ k*d1, k≠0).
    // Rasional: cross-multiply (A/B ≡ C/D ⟺ A*D ≡ B*C).
    if (!isClosed(prev) || !isClosed(cand)) {
      const rd1 = rationalForm({ type: 'binary', op: '-', left: prev.left, right: prev.right })
      const rd2 = rationalForm({ type: 'binary', op: '-', left: cand.left, right: cand.right })
      if (rd1 && rd2) {
        if (!sameExclusions([prev.left, prev.right], [cand.left, cand.right])) {
          return { status: 'uncertain', detail: 'domain_mismatch' }
        }
        if (polyEqual(mulPoly(rd1.num, rd2.den), mulPoly(rd2.num, rd1.den))) {
          return { status: 'correct', detail: 'poly_identical' }
        }
        const k = polyScaleFactor(mulPoly(rd1.num, rd2.den), mulPoly(rd2.num, rd1.den))
        if (k !== null) return { status: 'correct', detail: 'poly_scaled' }
      } else {
        const d1 = polyExpand({ type: 'binary', op: '-', left: prev.left, right: prev.right })
        const d2 = polyExpand({ type: 'binary', op: '-', left: cand.left, right: cand.right })
        if (d1 && d2) {
          if (!sameExclusions([prev.left, prev.right], [cand.left, cand.right])) {
            return { status: 'uncertain', detail: 'domain_mismatch' }
          }
          if (polyEqual(d1, d2)) return { status: 'correct', detail: 'poly_identical' }
          const k = polyScaleFactor(d1, d2)
          if (k !== null) return { status: 'correct', detail: 'poly_scaled' }
        }
      }
    }
    // Yopiq (o'zgaruvchisiz) tenglamalar
    if (isClosed(prev) && isClosed(cand)) {
      const t = closedTruth(cand)
      if (t === false) return { status: 'wrong', detail: 'closed_false' }
      if (t === true) return { status: 'invalid_transition', detail: 'true_but_unrelated' }
      return { status: 'unknown', detail: 'unevaluable' }
    }
    // Solution-set saqlanishi — nisbat testi
    const vars = [...new Set([...stepVars(prev), ...stepVars(cand)])]
    const { follows, decided, nontrivialSamples, domainMismatch } = followsByRatio(prev, cand, vars, seed, deadline)
    if (performance.now() > deadline) return { status: 'unknown', detail: 'time' }
    if (follows) {
      // P1-A: maxraj qisqartirish (x≠1 sharti tushib qoladi) → uncertain.
      if (domainMismatch || !sameExclusions([prev.left, prev.right], [cand.left, cand.right])) {
        return { status: 'uncertain', detail: 'domain_mismatch' }
      }
      if (nontrivialSamples < ENGINE_LIMITS.minNontrivialSamples) {
        return { status: 'uncertain', detail: 'trivial_agreement' }
      }
      return { status: 'probably_correct', detail: 'solution_set_preserved' }
    }
    if (decided) {
      // Begona ildiz maxsus klassi: prev ochiq, cand yolg'on ildiz qo'shgan
      return { status: 'invalid_transition', detail: 'extraneous_or_not_equivalent' }
    }
    return { status: 'unknown', detail: 'insufficient_samples' }
  }

  return { status: 'unknown', detail: 'unreachable' }
}
