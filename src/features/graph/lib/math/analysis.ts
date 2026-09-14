/**
 * Grafik tahlili — ildizlar, ekstremumlar va egri chiziqlar kesishmalari.
 *
 * Numerik usullar: ishora o'zgarishi + biseksiya (ildiz), markaziy ayirma
 * + ternary qidiruv (ekstremum), farq funksiyasi ildizlari (kesishma).
 * To'liq ko'rinadigan X-diapazonda ishlaydi; natijalar nuqta belgilari uchun.
 */
import type { CompiledExpression, Scope } from './compile'

export type MarkerKind = 'root' | 'extrema' | 'cross'

export interface MarkerPoint {
  kind: MarkerKind
  x: number
  y: number
}

export interface ExtremaPoint {
  x: number
  y: number
  kind: 'min' | 'max'
}

const DEFAULT_SAMPLES = 240
const BISECT_ITER = 80

function scopedEval(fn: CompiledExpression, xVar: string, scratch: Scope, x: number): number {
  scratch[xVar] = x
  return fn(scratch)
}

function bisect(
  fn: CompiledExpression,
  xVar: string,
  scratch: Scope,
  a: number,
  b: number,
  fa: number,
): number {
  let lo = a
  let hi = b
  let flo = fa
  for (let i = 0; i < BISECT_ITER; i++) {
    const mid = (lo + hi) / 2
    const fmid = scopedEval(fn, xVar, scratch, mid)
    if (!Number.isFinite(fmid)) return mid
    if (flo * fmid <= 0) {
      hi = mid
    } else {
      lo = mid
      flo = fmid
    }
  }
  return (lo + hi) / 2
}

/** |f| minimumni uch nuqtali ternary qidiruv bilan topadi */
function ternaryMinAbs(
  fn: CompiledExpression,
  xVar: string,
  scratch: Scope,
  a: number,
  b: number,
): { x: number; abs: number } {
  let lo = a
  let hi = b
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    const f1 = Math.abs(scopedEval(fn, xVar, scratch, m1))
    const f2 = Math.abs(scopedEval(fn, xVar, scratch, m2))
    if (f1 <= f2) hi = m2
    else lo = m1
  }
  const x = (lo + hi) / 2
  return { x, abs: Math.abs(scopedEval(fn, xVar, scratch, x)) }
}

/** f(x) = 0 ildizlari (ishora o'zgarishi + tegib o'tish) */
export function findRoots(
  fn: CompiledExpression,
  scope: Scope,
  xVar: string,
  xMin: number,
  xMax: number,
  samples = DEFAULT_SAMPLES,
): number[] {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return []
  const n = Math.max(4, Math.floor(samples))
  const step = (xMax - xMin) / n
  const scratch: Scope = { ...scope }
  const ys: number[] = []
  for (let i = 0; i <= n; i++) ys.push(scopedEval(fn, xVar, scratch, xMin + i * step))

  let scale = 1
  for (const y of ys) if (Number.isFinite(y)) scale = Math.max(scale, Math.abs(y))
  const tol = 1e-7 * scale

  const found: number[] = []
  const push = (x: number): void => {
    if (found.length > 0 && Math.abs(found[found.length - 1] - x) < step * 0.5) return
    found.push(x)
  }

  for (let i = 0; i < n; i++) {
    const y1 = ys[i]
    const y2 = ys[i + 1]
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) continue
    if (Math.abs(y1) <= tol) { push(xMin + i * step); continue }
    if (y1 * y2 < 0) {
      push(bisect(fn, xVar, scratch, xMin + i * step, xMin + (i + 1) * step, y1))
      continue
    }
    // Tegib o'tish (x² kabi): lokal |f| minimumi deyarli nol bo'lsa — ildiz
    if (i > 0 && Math.abs(y1) < Math.abs(ys[i - 1]) && Math.abs(y1) < Math.abs(y2)) {
      const { x, abs } = ternaryMinAbs(fn, xVar, scratch, xMin + (i - 1) * step, xMin + (i + 1) * step)
      if (abs <= tol * 100) push(x)
    }
  }
  return found.slice(0, 24)
}

/** Lokal ekstremumlar (hosila ishorasi o'zgarishi + ternary aniqlashtirish) */
export function findExtrema(
  fn: CompiledExpression,
  scope: Scope,
  xVar: string,
  xMin: number,
  xMax: number,
  samples = DEFAULT_SAMPLES,
): ExtremaPoint[] {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return []
  const n = Math.max(4, Math.floor(samples))
  const step = (xMax - xMin) / n
  const scratch: Scope = { ...scope }
  const ys: number[] = []
  for (let i = 0; i <= n; i++) ys.push(scopedEval(fn, xVar, scratch, xMin + i * step))

  const out: ExtremaPoint[] = []
  for (let i = 1; i < n; i++) {
    const before = ys[i] - ys[i - 1]
    const after = ys[i + 1] - ys[i]
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue
    if (before > 0 && after <= 0) out.push({ x: xMin + i * step, y: ys[i], kind: 'max' })
    else if (before < 0 && after >= 0) out.push({ x: xMin + i * step, y: ys[i], kind: 'min' })
  }
  // Ternary bilan aniqlashtirish + dublikatlarni olib tashlash
  const refined: ExtremaPoint[] = []
  for (const e of out) {
    const sign = e.kind === 'max' ? -1 : 1
    let lo = e.x - step
    let hi = e.x + step
    for (let i = 0; i < 60; i++) {
      const m1 = lo + (hi - lo) / 3
      const m2 = hi - (hi - lo) / 3
      const f1 = sign * scopedEval(fn, xVar, scratch, m1)
      const f2 = sign * scopedEval(fn, xVar, scratch, m2)
      if (f1 <= f2) hi = m2
      else lo = m1
    }
    const x = (lo + hi) / 2
    if (refined.length > 0 && Math.abs(refined[refined.length - 1].x - x) < step * 0.5) continue
    refined.push({ x, y: scopedEval(fn, xVar, scratch, x), kind: e.kind })
  }
  return refined.slice(0, 24)
}

/** Ikki egri kesishmalari (farq funksiyasining ildizlari) */
export function findIntersections(
  a: CompiledExpression,
  b: CompiledExpression,
  scope: Scope,
  xVar: string,
  xMin: number,
  xMax: number,
  samples = DEFAULT_SAMPLES,
): number[] {
  const diff: CompiledExpression = (s) => a(s) - b(s)
  const scratch: Scope = { ...scope }
  const xs = findRoots(diff, scope, xVar, xMin, xMax, samples)
  const out: number[] = []
  for (const x of xs) {
    scratch[xVar] = x
    const y = a(scratch)
    if (Number.isFinite(y)) out.push(x)
  }
  return out
}

export interface CurveEntry {
  id: string
  fn: CompiledExpression
}

/** Barcha ko'rinadigan egrilar uchun markerlar to'plami */
export function analyzeCurves(
  entries: CurveEntry[],
  scope: Scope,
  xVar: string,
  xMin: number,
  xMax: number,
): MarkerPoint[] {
  const markers: MarkerPoint[] = []
  const scratch: Scope = { ...scope }

  for (const e of entries) {
    for (const x of findRoots(e.fn, scope, xVar, xMin, xMax)) {
      scratch[xVar] = x
      const y = e.fn(scratch)
      if (Number.isFinite(y)) markers.push({ kind: 'root', x, y })
    }
    for (const ext of findExtrema(e.fn, scope, xVar, xMin, xMax)) {
      if (Number.isFinite(ext.y)) markers.push({ kind: 'extrema', x: ext.x, y: ext.y })
    }
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      for (const x of findIntersections(entries[i].fn, entries[j].fn, scope, xVar, xMin, xMax)) {
        scratch[xVar] = x
        const y = entries[i].fn(scratch)
        if (Number.isFinite(y)) markers.push({ kind: 'cross', x, y })
      }
    }
  }

  return markers.slice(0, 40)
}
