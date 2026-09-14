/**
 * Namuna olish (sampling) — SOF funksiya, canvas/DOM bilmaydi.
 *
 * Har piksel ustunidan bitta nuqta olinadi; keskin o'zgarishlarda interval
 * rekursiv ikkilantiriladi (steep funksiyalar silliq ko'rinadi); natija
 * UZLUKLI segmentlarga bo'linadi (tan/1/x asimptotalari orqali chiziq
 * O'TKAZILMAYDI).
 */
import type { GraphViewport } from '../../../../../shared/contracts/graph'
import { screenToWorldX, yToScreen } from './viewport'
import type { CompiledExpression, Scope } from '../math/compile'

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
