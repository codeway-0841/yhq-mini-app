/**
 * Namuna olish (sampling) — SOF funksiya, canvas/DOM bilmaydi.
 *
 * Har piksel ustunidan bitta nuqta olinadi; keskin o'zgarishlarda interval
 * rekursiv ikkilantiriladi (steep funksiyalar silliq ko'rinadi); natija
 * UZLUKLI segmentlarga bo'linadi (tan/1/x asimptotalari orqali chiziq
 * O'TKAZILMAYDI).
 */
import type { GraphViewport } from '../../../../../shared/contracts/graph'
import { screenToWorldX, screenToWorldY, xToScreen, yToScreen } from './viewport'
import type { CompiledExpression, Scope } from '../math/compile'
import type { Relation } from '../math/graph-expr'

export interface SamplePoint {
  /** ekran (CSS px) koordinatalari */
  x: number
  y: number
}

export interface CurveSegment {
  points: SamplePoint[]
}

export interface SampleResult {
  segments: CurveSegment[]
}

/** Interval ichida shu pikseldan katta sakrash bo'lsa — ikkilantirish */
const REFINE_THRESHOLD_PX = 16
const MAX_REFINE_DEPTH = 4
/** Asimptota: sakrash shu balandlikdan katta bo'lsa — chiziq uziladi */
const GAP_FACTOR = 4
const MAX_ABS_Y = 1e9

interface Sample {
  x: number
  y: number
  ok: boolean
  sx: number
  sy: number
}

export interface SampleOptions {
  width: number
  height: number
  viewport: GraphViewport
  xVar: string
  scope: Record<string, number>
}

export function sampleCurve(fn: CompiledExpression, opts: SampleOptions): SampleResult {
  const { width, height, viewport, xVar, scope } = opts

  const mutableScope: Scope = { ...scope, [xVar]: 0 }

  const at = (sx: number): Sample => {
    const x = screenToWorldX(viewport, sx, width)
    mutableScope[xVar] = x
    const y = fn(mutableScope)
    const ok = Number.isFinite(y) && Math.abs(y) < MAX_ABS_Y
    return {
      x,
      y,
      ok,
      sx,
      sy: ok ? yToScreen(viewport, y, height) : NaN,
    }
  }

  const segments: CurveSegment[] = []
  let current: SamplePoint[] = []

  const flush = (): void => {
    if (current.length >= 2) segments.push({ points: current })
    current = []
  }

  const push = (s: Sample): void => {
    current.push({ x: s.sx, y: s.sy })
  }

  const connect = (a: Sample, b: Sample, depth: number): void => {
    if (!a.ok || !b.ok) { flush(); return }
    const dy = Math.abs(b.sy - a.sy)
    if (depth < MAX_REFINE_DEPTH && dy > REFINE_THRESHOLD_PX) {
      const mid = at((a.sx + b.sx) / 2)
      connect(a, mid, depth + 1)
      connect(mid, b, depth + 1)
      return
    }
    if (dy > GAP_FACTOR * height) { flush(); return }
    push(b)
  }

  const last = Math.max(1, Math.floor(width))
  let prev: Sample | null = null
  for (let sx = 0; sx <= last; sx++) {
    const s = at(sx)
    if (!s.ok) { flush(); prev = null; continue }
    if (!prev || current.length === 0) {
      push(s)
    } else {
      connect(prev, s, 0)
    }
    prev = s
  }
  flush()

  return { segments }
}

/** Parametrik (x(t), y(t)) — ekran segmentlari */
export function sampleParametric(
  xFn: CompiledExpression,
  yFn: CompiledExpression,
  scope: Record<string, number>,
  varName: string,
  min: number,
  max: number,
  width: number,
  height: number,
  viewport: GraphViewport,
  steps = 600,
): CurveSegment[] {
  const scratch: Scope = { ...scope }
  const segments: CurveSegment[] = []
  let current: SamplePoint[] = []

  for (let i = 0; i <= steps; i++) {
    const t = min + ((max - min) * i) / steps
    scratch[varName] = t
    const x = xFn(scratch)
    const y = yFn(scratch)
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
      if (current.length > 1) segments.push({ points: current })
      current = []
      continue
    }
    current.push({ x: xToScreen(viewport, x, width), y: yToScreen(viewport, y, height) })
  }
  if (current.length > 1) segments.push({ points: current })
  return segments
}

/** Polyar r(θ) — θ ∈ [0, 2π] */
export function samplePolar(
  rFn: CompiledExpression,
  scope: Record<string, number>,
  varName: string,
  width: number,
  height: number,
  viewport: GraphViewport,
  steps = 720,
): CurveSegment[] {
  const xFn: CompiledExpression = (sc) => rFn(sc) * Math.cos(sc[varName] ?? 0)
  const yFn: CompiledExpression = (sc) => rFn(sc) * Math.sin(sc[varName] ?? 0)
  return sampleParametric(xFn, yFn, scope, varName, 0, Math.PI * 2, width, height, viewport, steps)
}

export interface ImplicitCell {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Implicit F(x,y) rel 0 — marching squares konturi + tengsizlik sohasi
 * (katakchalar). Grid ekran o'lchamiga moslashadi.
 */
export function sampleImplicit(
  fn: CompiledExpression,
  scope: Record<string, number>,
  width: number,
  height: number,
  viewport: GraphViewport,
  relation: Relation,
  grid = 96,
): { segments: CurveSegment[]; cells: ImplicitCell[] } {
  const xMin = screenToWorldX(viewport, 0, width)
  const xMax = screenToWorldX(viewport, width, width)
  const yMin = screenToWorldY(viewport, height, height)
  const yMax = screenToWorldY(viewport, 0, height)

  const nx = Math.max(24, Math.floor(grid))
  const ny = Math.max(24, Math.round(grid * (height / Math.max(1, width))))
  const dx = (xMax - xMin) / nx
  const dy = (yMax - yMin) / ny

  const values = new Float64Array((nx + 1) * (ny + 1))
  const scratch: Scope = { ...scope }
  for (let j = 0; j <= ny; j++) {
    scratch['y'] = yMin + j * dy
    for (let i = 0; i <= nx; i++) {
      scratch['x'] = xMin + i * dx
      values[j * (nx + 1) + i] = fn(scratch)
    }
  }

  const at = (i: number, j: number): number => values[j * (nx + 1) + i]
  const sx = (x: number): number => xToScreen(viewport, x, width)
  const sy = (y: number): number => yToScreen(viewport, y, height)

  const lerp = (va: number, vb: number, a: number, b: number): number => {
    if (va === vb) return (a + b) / 2
    return a + ((b - a) * va) / (va - vb)
  }

  const segments: CurveSegment[] = []
  const cells: ImplicitCell[] = []
  const satisfies = (v: number): boolean => {
    switch (relation) {
      case '=': return false
      case '<': return v < 0
      case '>': return v > 0
      case '<=': return v <= 0
      case '>=': return v >= 0
    }
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v0 = at(i, j)
      const v1 = at(i + 1, j)
      const v2 = at(i + 1, j + 1)
      const v3 = at(i, j + 1)
      if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue

      if (relation !== '=') {
        const avg = (v0 + v1 + v2 + v3) / 4
        if (satisfies(avg)) {
          const x0 = xMin + i * dx
          const y0 = yMin + j * dy
          const x1 = x0 + dx
          const y1 = y0 + dy
          const left = sx(x0)
          const right = sx(x1)
          const top = sy(y1)
          const bottom = sy(y0)
          cells.push({ x: left, y: top, w: right - left, h: bottom - top })
        }
      }

      const points: { x: number; y: number }[] = []
      if (v0 === 0 || v0 * v1 < 0) points.push({ x: xMin + lerp(v0, v1, i, i + 1) * dx, y: yMin + j * dy })
      if (v1 === 0 || v1 * v2 < 0) points.push({ x: xMin + (i + 1) * dx, y: yMin + lerp(v1, v2, j, j + 1) * dy })
      if (v2 === 0 || v2 * v3 < 0) points.push({ x: xMin + lerp(v3, v2, i, i + 1) * dx, y: yMin + (j + 1) * dy })
      if (v3 === 0 || v3 * v0 < 0) points.push({ x: xMin + i * dx, y: yMin + lerp(v3, v0, j, j + 1) * dy })

      if (points.length === 2) {
        segments.push({ points: [{ x: sx(points[0].x), y: sy(points[0].y) }, { x: sx(points[1].x), y: sy(points[1].y) }] })
      } else if (points.length === 4) {
        segments.push({ points: [{ x: sx(points[0].x), y: sy(points[0].y) }, { x: sx(points[1].x), y: sy(points[1].y) }] })
        segments.push({ points: [{ x: sx(points[2].x), y: sy(points[2].y) }, { x: sx(points[3].x), y: sy(points[3].y) }] })
      }
    }
  }

  return { segments, cells }
}
