/**
 * Numerik calculus — hosila (5-nuqtali stencil) va integral (adaptiv Simpson).
 *
 * Bu funksiyalar faqat KO'RSATISH uchun: aniqlik foizning ulushlarida, lekin
 * har qanday kompilyatsiya qilingan ifoda bilan ishlaydi (simvolik differensial
 * yo'q). Asimptota/uzilishda NaN qaytaradi — chizma qatlami uzilish sifatida
 * qabul qiladi.
 */
import type { CompiledExpression, Scope } from './compile'

function scopedEval(
  fn: CompiledExpression,
  xVar: string,
  scratch: Scope,
  x: number,
): number {
  scratch[xVar] = x
  return fn(scratch)
}

/**
 * 5-nuqtali markaziy stencil:
 * f'(x) ≈ (f(x−2h) − 8f(x−h) + 8f(x+h) − f(x+2h)) / (12h)
 * Xato O(h⁴) — grafik masshtabida ko'rinmas.
 */
export function derivativeAt(fn: CompiledExpression, scope: Scope, xVar: string, x: number): number {
  if (!Number.isFinite(x)) return NaN
  const scratch: Scope = { ...scope }
  const h = Math.max(1e-6, Math.abs(x) * 1e-5)
  const at = (t: number): number => scopedEval(fn, xVar, scratch, t)
  return (at(x - 2 * h) - 8 * at(x - h) + 8 * at(x + h) - at(x + 2 * h)) / (12 * h)
}

/** Sekant qiyaligi: (f(x₀+h) − f(x₀)) / h — h → 0 da hosilaga intiladi */
export function secantSlope(
  fn: CompiledExpression,
  scope: Scope,
  xVar: string,
  x0: number,
  h: number,
): number {
  if (!Number.isFinite(x0) || !Number.isFinite(h) || h === 0) return NaN
  const scratch: Scope = { ...scope }
  const y0 = scopedEval(fn, xVar, scratch, x0)
  const y1 = scopedEval(fn, xVar, scratch, x0 + h)
  return (y1 - y0) / h
}

/** Sampling uchun: hosila funksiyasini closure sifatida (scratch qayta ishlatiladi) */
export function makeDerivative(fn: CompiledExpression, xVar: string): CompiledExpression {
  const scratch: Scope = {}
  return (scope) => {
    const x = scope[xVar]
    if (!Number.isFinite(x)) return NaN
    for (const key in scope) scratch[key] = scope[key]
    return derivativeAt(fn, scope, xVar, x)
  }
}

export interface RiemannResult {
  sum: number
  /** Har bir to'rtburchak markazi va balandligi (chizish uchun) */
  rects: { x: number; width: number; height: number }[]
}

/** O'rta nuqtali Riemann yig'indisi (ta'lim ko'rsatkichi) */
export function riemann(
  fn: CompiledExpression,
  scope: Scope,
  xVar: string,
  a: number,
  b: number,
  n: number,
): RiemannResult {
  if (!Number.isFinite(a) || !Number.isFinite(b) || n < 1) return { sum: NaN, rects: [] }
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const width = (hi - lo) / n
  const sign = a <= b ? 1 : -1
  const scratch: Scope = { ...scope }
  const rects: { x: number; width: number; height: number }[] = []
  let sum = 0
  for (let i = 0; i < n; i++) {
    const mid = lo + (i + 0.5) * width
    const height = scopedEval(fn, xVar, scratch, mid)
    rects.push({ x: lo + i * width, width, height })
    sum += height
  }
  return { sum: sign * sum * Math.abs(width), rects }
}

interface SimpsonState {
  fn: CompiledExpression
  xVar: string
  scratch: Scope
}

function simpson(
  s: SimpsonState,
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
  eps: number,
  depth: number,
): number {
  const m = (a + b) / 2
  const lm = (a + m) / 2
  const rm = (m + b) / 2
  const flm = scopedEval(s.fn, s.xVar, s.scratch, lm)
  const frm = scopedEval(s.fn, s.xVar, s.scratch, rm)
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb)
  const left = ((m - a) / 6) * (fa + 4 * flm + fm)
  const right = ((b - m) / 6) * (fm + 4 * frm + fb)
  if (depth <= 0 || !Number.isFinite(left + right) || Math.abs(left + right - whole) <= 15 * eps) {
    return left + right + (left + right - whole) / 15
  }
  return (
    simpson(s, a, m, fa, flm, fm, eps / 2, depth - 1) +
    simpson(s, m, b, fm, frm, fb, eps / 2, depth - 1)
  )
}

/**
 * Aniq integral ∫ₐᵇ f dx — adaptiv Simpson (rekursiya chuqurligi ≤ 24).
 * a > b bo'lsa manfiy belgi bilan qaytadi; uzilishda NaN.
 */
export function integrate(
  fn: CompiledExpression,
  scope: Scope,
  xVar: string,
  a: number,
  b: number,
): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
  if (a === b) return 0
  const sign = a < b ? 1 : -1
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const state: SimpsonState = { fn, xVar, scratch: { ...scope } }
  const fa = scopedEval(fn, xVar, state.scratch, lo)
  const fb = scopedEval(fn, xVar, state.scratch, hi)
  const fm = scopedEval(fn, xVar, state.scratch, (lo + hi) / 2)
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || !Number.isFinite(fm)) return NaN
  const eps = 1e-8 * Math.max(1, hi - lo)
  return sign * simpson(state, lo, hi, fa, fm, fb, eps, 24)
}
