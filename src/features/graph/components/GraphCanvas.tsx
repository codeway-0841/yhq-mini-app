/**
 * GraphCanvas — Canvas 2D renderer + gesture qatlami.
 *
 * Math core'ni BILMAYDI: tayyor `fn` (closure) + scope oladi va ichida
 * `sampleCurve` orqali chizadi. Gesture paytida viewport lokal ref'da
 * yuritiladi (60Hz'da store/persist yozilmasligi uchun) — barmoq
 * ko'tarilganda bir marta `onViewportCommit` chaqiriladi.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { GraphViewport } from '../../../../shared/contracts/graph'
import type { CompiledExpression, MarkerPoint } from '../lib/math'
import { MARKER_COLORS, REGRESSION_COLOR } from '../curve-colors'
import { sampleCurve, sampleImplicit, sampleParametric, samplePolar } from '../lib/plot/sample'
import {
  niceTicks,
  panViewport,
  screenToWorldX,
  screenToWorldY,
  xToScreen,
  yToScreen,
  zoomViewport,
} from '../lib/plot/viewport'
import { formatWorldValue } from '../lib/plot/viewport'

export type SeriesKind = 'y' | 'polar' | 'parametric' | 'implicit'

export interface GraphSeries {
  id: string
  color: string
  visible: boolean
  fn: CompiledExpression
  /** Hosila chizig'i — shtrixli */
  dashed?: boolean
  /** Yo'q bo'lsa — 'y' (oddiy funksiya) */
  kind?: SeriesKind
  /** Parametrik: y(t) */
  fn2?: CompiledExpression
  /** Polyar/parametrik uchun parametr nomi va oralig'i */
  param?: { name: string; min: number; max: number }
  /** Implicit/tengsizlik alomati */
  relation?: '=' | '<' | '>' | '<=' | '>='
}

/** Urinma chizig'i (tahlil paneli) — qiymatlar oldindan hisoblangan */
export interface TangentOverlay {
  x0: number
  y0: number
  slope: number
  color: string
}

/** Integral yuzasi + Riemann to'rtburchaklari */
export interface IntegralOverlay {
  fn: CompiledExpression
  scope: Record<string, number>
  xVar: string
  a: number
  b: number
  n: number
  color: string
}

export interface MovingPoint {
  x: number
  y: number
  color: string
}

/** Sekant chizig'i (limit h → 0) — qiymatlar oldindan hisoblangan */
export interface SecantOverlay {
  x0: number
  x1: number
  y0: number
  y1: number
  slope: number
  color: string
}

export interface RegressionLine {
  slope: number
  intercept: number
  vertical: boolean
}

interface Props {
  series: GraphSeries[]
  scope: Record<string, number>
  xVar: string
  viewport: GraphViewport
  onViewportCommit: (vp: GraphViewport) => void
  ariaLabel: string
  tangent?: TangentOverlay | null
  integral?: IntegralOverlay | null
  markers?: MarkerPoint[]
  movingPoint?: MovingPoint | null
  onSize?: (size: { w: number; h: number }) => void
  /** Lab: o'lchov nuqtalari + regression chizig'i */
  points?: { x: number; y: number }[]
  regression?: RegressionLine | null
  /** Nuqta yig'ish rejimi — tap world koordinataga aylanadi */
  pointPick?: boolean
  onPointPick?: (p: { x: number; y: number }) => void
  /** Sekant (h → 0) */
  secant?: SecantOverlay | null
  /** Tashqi canvas ref (AI uchun rasm olish) */
  canvasRef?: { current: HTMLCanvasElement | null }
}

interface Trace {
  sx: number
  sy: number
  wx: number
  wy: number
  color: string
}

type Gesture =
  | { type: 'pan'; startVp: GraphViewport; startX: number; startY: number; moved: boolean; startSx: number; startSy: number }
  | { type: 'pinch'; startVp: GraphViewport; startDist: number; centerX: number; centerY: number; moved: boolean }

const MAX_DPR = 2
const TAP_SLOP_PX = 6
const HIT_RADIUS_PX = 28
const WHEEL_COMMIT_MS = 400

export default function GraphCanvas({
  series, scope, xVar, viewport, onViewportCommit, ariaLabel,
  tangent = null, integral = null, markers = [], movingPoint = null, onSize,
  points = [], regression = null, pointPick = false, onPointPick,
  secant = null, canvasRef: externalCanvasRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const vpRef = useRef<GraphViewport>(viewport)
  const [sizeTick, setSizeTick] = useState(0)

  const dataRef = useRef({
    series, scope, xVar, tangent, integral, markers, movingPoint,
    points, regression, pointPick, onPointPick, secant,
  })
  dataRef.current = {
    series, scope, xVar, tangent, integral, markers, movingPoint,
    points, regression, pointPick, onPointPick, secant,
  }
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const traceRef = useRef<Trace | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tashqi viewport (reset/preset/deep-link) o'zgarsa — lokal nusxani sinxronlash
  const lastExternalVp = useRef(viewport)
  if (lastExternalVp.current !== viewport) {
    lastExternalVp.current = viewport
    if (!gesture.current) vpRef.current = viewport
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = sizeRef.current
    if (w <= 0 || h <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const cs = getComputedStyle(document.body)
    const cssVar = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback
    const gridColor = cssVar('--p-line', 'rgba(148,163,184,0.18)')
    const axisColor = cssVar('--p-muted', '#94a3b8')
    const labelColor = cssVar('--p-subtle', '#94a3b8')
    const cardColor = cssVar('--p-card', '#17181c')
    const fgColor = cssVar('--p-fg', '#f5f5f4')

    const vp = vpRef.current
    const xTicks = niceTicks(screenToWorldX(vp, 0, w), screenToWorldX(vp, w, w), Math.max(4, Math.round(w / 70)))
    const yTicks = niceTicks(screenToWorldY(vp, h, h), screenToWorldY(vp, 0, h), Math.max(4, Math.round(h / 70)))

    ctx.lineWidth = 1
    ctx.strokeStyle = gridColor
    ctx.beginPath()
    for (const v of xTicks.values) {
      const sx = Math.round(xToScreen(vp, v, w)) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, h)
    }
    for (const v of yTicks.values) {
      const sy = Math.round(yToScreen(vp, v, h)) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(w, sy)
    }
    ctx.stroke()

    const axisX = xToScreen(vp, 0, w)
    const axisY = yToScreen(vp, 0, h)

    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (axisY >= 0 && axisY <= h) { ctx.moveTo(0, axisY); ctx.lineTo(w, axisY) }
    if (axisX >= 0 && axisX <= w) { ctx.moveTo(axisX, 0); ctx.lineTo(axisX, h) }
    ctx.stroke()

    // O'q yorliqlari — o'qlar ekrandan chiqib ketsa ham chetga yopishib turadi
    ctx.fillStyle = labelColor
    ctx.font = '10px ui-monospace, monospace'
    const labelLineY = Math.min(Math.max(axisY, 12), h - 4)
    const labelLineX = Math.min(Math.max(axisX, 18), w - 4)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const v of xTicks.values) {
      if (v === 0) continue
      ctx.fillText(v.toFixed(xTicks.decimals), xToScreen(vp, v, w), labelLineY + 3)
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const v of yTicks.values) {
      if (v === 0) continue
      ctx.fillText(v.toFixed(yTicks.decimals), labelLineX - 3, yToScreen(vp, v, h))
    }

    const {
      series: currentSeries, scope: currentScope, xVar: currentXVar,
      tangent: currentTangent, integral: currentIntegral,
      markers: currentMarkers, movingPoint: currentMovingPoint,
      points: currentPoints, regression: currentRegression, secant: currentSecant,
    } = dataRef.current

    // ── Integral yuzasi + Riemann to'rtburchaklari (egrilar OSTIDA) ──────────
    if (currentIntegral) {
      const lo = Math.min(currentIntegral.a, currentIntegral.b)
      const hi = Math.max(currentIntegral.a, currentIntegral.b)
      const zeroY = yToScreen(vp, 0, h)
      const scratch = { ...currentIntegral.scope }

      const segments: { x: number; y: number }[][] = []
      let current: { x: number; y: number }[] = []
      const steps = 160
      for (let i = 0; i <= steps; i++) {
        const wx = lo + ((hi - lo) * i) / steps
        scratch[currentIntegral.xVar] = wx
        const wy = currentIntegral.fn(scratch)
        if (!Number.isFinite(wy) || Math.abs(wy) > 1e9) {
          if (current.length > 1) segments.push(current)
          current = []
          continue
        }
        current.push({ x: xToScreen(vp, wx, w), y: yToScreen(vp, wy, h) })
      }
      if (current.length > 1) segments.push(current)

      ctx.save()
      ctx.fillStyle = currentIntegral.color
      ctx.globalAlpha = 0.13
      ctx.beginPath()
      for (const seg of segments) {
        ctx.moveTo(seg[0].x, seg[0].y)
        for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y)
        ctx.lineTo(seg[seg.length - 1].x, zeroY)
        ctx.lineTo(seg[0].x, zeroY)
        ctx.closePath()
      }
      ctx.fill()

      const rectCount = Math.min(80, Math.max(1, Math.round(currentIntegral.n)))
      const rectWidth = (hi - lo) / rectCount
      for (let i = 0; i < rectCount; i++) {
        const left = lo + i * rectWidth
        scratch[currentIntegral.xVar] = left + rectWidth / 2
        const wy = currentIntegral.fn(scratch)
        if (!Number.isFinite(wy) || Math.abs(wy) > 1e9) continue
        const sx = xToScreen(vp, left, w)
        const sw = Math.max(1, rectWidth / vp.unitsPerPx)
        const sy = yToScreen(vp, wy, h)
        const top = Math.min(sy, zeroY)
        const height = Math.max(1, Math.abs(zeroY - sy))
        ctx.globalAlpha = 0.10
        ctx.fillRect(sx, top, sw, height)
        ctx.globalAlpha = 0.45
        ctx.strokeRect(sx + 0.5, top + 0.5, sw, height)
      }
      ctx.restore()
    }

    // Implicit sohalar (tengsizlik) — egrilar OSTIDA
    const implicitSegments = new Map<string, ReturnType<typeof sampleImplicit>['segments']>()
    for (const s of currentSeries) {
      if (!s.visible || (s.kind ?? 'y') !== 'implicit') continue
      const result = sampleImplicit(s.fn, currentScope, w, h, vp, s.relation ?? '=')
      implicitSegments.set(s.id, result.segments)
      if (result.cells.length > 0) {
        ctx.save()
        ctx.globalAlpha = 0.16
        ctx.fillStyle = s.color
        for (const c of result.cells) ctx.fillRect(c.x, c.y, c.w + 1, c.h + 1)
        ctx.restore()
      }
    }

    for (const s of currentSeries) {
      if (!s.visible) continue
      const kind = s.kind ?? 'y'
      let segments: { points: { x: number; y: number }[] }[]
      if (kind === 'y') {
        segments = sampleCurve(s.fn, {
          width: w,
          height: h,
          viewport: vp,
          xVar: currentXVar,
          scope: currentScope,
        }).segments
      } else if (kind === 'implicit') {
        segments = implicitSegments.get(s.id) ?? []
      } else if (kind === 'parametric' && s.fn2 && s.param) {
        segments = sampleParametric(s.fn, s.fn2, currentScope, s.param.name, s.param.min, s.param.max, w, h, vp)
      } else if (kind === 'polar' && s.param) {
        segments = samplePolar(s.fn, currentScope, s.param.name, w, h, vp)
      } else {
        segments = []
      }
      if (segments.length === 0) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = 2.25
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.setLineDash(s.dashed ? [7, 5] : [])
      ctx.beginPath()
      for (const seg of segments) {
        seg.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Lab: regression chizig'i, qoldiqlar va o'lchov nuqtalari ─────────────
    if (currentRegression) {
      ctx.save()
      ctx.strokeStyle = REGRESSION_COLOR
      ctx.lineWidth = 1.75
      if (currentRegression.vertical) {
        const sx = xToScreen(vp, currentRegression.intercept, w)
        if (sx >= -4 && sx <= w + 4) {
          ctx.beginPath()
          ctx.moveTo(sx, 0)
          ctx.lineTo(sx, h)
          ctx.stroke()
        }
      } else {
        const worldLeft = screenToWorldX(vp, 0, w)
        const worldRight = screenToWorldX(vp, w, w)
        const yLeft = Math.max(-1e6, Math.min(1e6, currentRegression.slope * worldLeft + currentRegression.intercept))
        const yRight = Math.max(-1e6, Math.min(1e6, currentRegression.slope * worldRight + currentRegression.intercept))
        ctx.beginPath()
        ctx.moveTo(0, yToScreen(vp, yLeft, h))
        ctx.lineTo(w, yToScreen(vp, yRight, h))
        ctx.stroke()
      }
      ctx.setLineDash([3, 3])
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1
      for (const pt of currentPoints) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue
        const predicted = currentRegression.vertical
          ? NaN
          : currentRegression.slope * pt.x + currentRegression.intercept
        if (!Number.isFinite(predicted)) continue
        const sx = xToScreen(vp, pt.x, w)
        ctx.beginPath()
        ctx.moveTo(sx, yToScreen(vp, pt.y, h))
        ctx.lineTo(sx, yToScreen(vp, predicted, h))
        ctx.stroke()
      }
      ctx.restore()

      for (const pt of currentPoints) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue
        const sx = xToScreen(vp, pt.x, w)
        const sy = yToScreen(vp, pt.y, h)
        if (sx < -14 || sx > w + 14 || sy < -14 || sy > h + 14) continue
        ctx.beginPath()
        ctx.arc(sx, sy, 4, 0, Math.PI * 2)
        ctx.fillStyle = REGRESSION_COLOR
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = cardColor
        ctx.stroke()
      }
    }

    // ── Tahlil markerlari (ildiz/ekstremum/kesishma) ─────────────────────────
    for (const m of currentMarkers) {
      const sx = xToScreen(vp, m.x, w)
      const sy = yToScreen(vp, m.y, h)
      if (sx < -12 || sx > w + 12 || sy < -12 || sy > h + 12) continue
      ctx.beginPath()
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = MARKER_COLORS[m.kind]
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = cardColor
      ctx.stroke()
    }

    // ── Harakatlanuvchi nuqta (animatsiya) ───────────────────────────────────
    if (currentMovingPoint) {
      const sx = xToScreen(vp, currentMovingPoint.x, w)
      const sy = yToScreen(vp, currentMovingPoint.y, h)
      if (sx >= -12 && sx <= w + 12 && sy >= -12 && sy <= h + 12) {
        ctx.beginPath()
        ctx.arc(sx, sy, 5, 0, Math.PI * 2)
        ctx.fillStyle = currentMovingPoint.color
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = cardColor
        ctx.stroke()
      }
    }

    // ── Urinma chizig'i (egrilar USTIDA) ─────────────────────────────────────
    if (currentTangent && Number.isFinite(currentTangent.slope) && Number.isFinite(currentTangent.y0)) {
      const worldLeft = screenToWorldX(vp, 0, w)
      const worldRight = screenToWorldX(vp, w, w)
      const yLeft = Math.max(-1e6, Math.min(1e6, currentTangent.y0 + currentTangent.slope * (worldLeft - currentTangent.x0)))
      const yRight = Math.max(-1e6, Math.min(1e6, currentTangent.y0 + currentTangent.slope * (worldRight - currentTangent.x0)))
      ctx.save()
      ctx.strokeStyle = currentTangent.color
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(0, yToScreen(vp, yLeft, h))
      ctx.lineTo(w, yToScreen(vp, yRight, h))
      ctx.stroke()
      ctx.restore()

      const px = xToScreen(vp, currentTangent.x0, w)
      const py = yToScreen(vp, currentTangent.y0, h)
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fillStyle = currentTangent.color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = cardColor
      ctx.stroke()
    }

    // ── Sekant (h → 0 limiti) ────────────────────────────────────────────────
    if (currentSecant) {
      const sc = currentSecant
      ctx.save()
      ctx.strokeStyle = sc.color
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      if (Number.isFinite(sc.slope)) {
        const worldLeft = screenToWorldX(vp, 0, w)
        const worldRight = screenToWorldX(vp, w, w)
        const yLeft = Math.max(-1e6, Math.min(1e6, sc.y0 + sc.slope * (worldLeft - sc.x0)))
        const yRight = Math.max(-1e6, Math.min(1e6, sc.y0 + sc.slope * (worldRight - sc.x0)))
        ctx.beginPath()
        ctx.moveTo(0, yToScreen(vp, yLeft, h))
        ctx.lineTo(w, yToScreen(vp, yRight, h))
        ctx.stroke()
      } else {
        const sx = xToScreen(vp, sc.x0, w)
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, h)
        ctx.stroke()
      }
      ctx.restore()

      for (const pair of [[sc.x0, sc.y0], [sc.x1, sc.y1]] as const) {
        const [pxw, pyw] = pair
        if (!Number.isFinite(pxw) || !Number.isFinite(pyw)) continue
        ctx.beginPath()
        ctx.arc(xToScreen(vp, pxw, w), yToScreen(vp, pyw, h), 4, 0, Math.PI * 2)
        ctx.fillStyle = sc.color
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = cardColor
        ctx.stroke()
      }
    }

    const trace = traceRef.current
    if (trace) {
      ctx.beginPath()
      ctx.arc(trace.sx, trace.sy, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = trace.color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = cardColor
      ctx.stroke()

      const label = `(${formatWorldValue(trace.wx, vp.unitsPerPx)}, ${formatWorldValue(trace.wy, vp.unitsPerPx)})`
      ctx.font = '11px ui-monospace, monospace'
      const padX = 6
      const textW = ctx.measureText(label).width
      const boxW = textW + padX * 2
      const boxH = 20
      let bx = trace.sx + 10
      let by = trace.sy - boxH - 8
      if (bx + boxW > w - 4) bx = trace.sx - boxW - 10
      if (by < 4) by = trace.sy + 10
      ctx.fillStyle = cardColor
      ctx.globalAlpha = 0.96
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, boxW, boxH, 6)
        ctx.fill()
      } else {
        ctx.fillRect(bx, by, boxW, boxH)
      }
      ctx.globalAlpha = 1
      ctx.strokeStyle = trace.color
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = fgColor
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + padX, by + boxH / 2 + 0.5)
    }
  }, [])

  // Props o'zgarganda qayta chizish
  useEffect(() => {
    draw()
  }, [draw, series, scope, xVar, viewport, sizeTick, tangent, integral, markers, movingPoint, points, regression, secant])

  // Ifoda/slayder/viewport o'zgarsa — eski trace nuqtasi endi noto'g'ri
  useEffect(() => {
    traceRef.current = null
    draw()
  }, [draw, series, scope, xVar, viewport])

  // Tema/aksent almashinuvida ranglarni yangilash
  useEffect(() => {
    const observer = new MutationObserver(() => { draw() })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    return () => observer.disconnect()
  }, [draw])

  // Resize
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      sizeRef.current = { w: rect.width, h: rect.height }
      onSizeRef.current?.({ w: rect.width, h: rect.height })
      setSizeTick((n) => n + 1)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Wheel zoom (passive:false — preventDefault uchun)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const { w, h } = sizeRef.current
      traceRef.current = null
      const scale = Math.exp(-e.deltaY * 0.0015)
      vpRef.current = zoomViewport(vpRef.current, e.clientX - rect.left, e.clientY - rect.top, scale, w, h)
      draw()
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        onViewportCommit(vpRef.current)
      }, WHEEL_COMMIT_MS)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
    }
  }, [draw, onViewportCommit])

  const hitTest = useCallback((sx: number, sy: number): Trace | null => {
    const { w, h } = sizeRef.current
    const vp = vpRef.current
    const { series: currentSeries, scope: currentScope, xVar: currentXVar } = dataRef.current
    const wx = screenToWorldX(vp, sx, w)
    let best: Trace | null = null
    let bestDist = HIT_RADIUS_PX
    for (const s of currentSeries) {
      if (!s.visible) continue
      const pointScope = { ...currentScope, [currentXVar]: wx }
      const y = s.fn(pointScope)
      if (!Number.isFinite(y)) continue
      const py = yToScreen(vp, y, h)
      const dist = Math.abs(py - sy)
      if (dist < bestDist) {
        bestDist = dist
        best = { sx, sy: py, wx, wy: y, color: s.color }
      }
    }
    return best
  }, [])

  const localPoint = (e: ReactPointerEvent): { x: number; y: number } => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const canvas = e.currentTarget
    try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const p = localPoint(e)
    pointers.current.set(e.pointerId, p)

    if (pointers.current.size === 1) {
      gesture.current = {
        type: 'pan',
        startVp: vpRef.current,
        startX: p.x,
        startY: p.y,
        moved: false,
        startSx: p.x,
        startSy: p.y,
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        type: 'pinch',
        startVp: vpRef.current,
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        centerX: (a.x + b.x) / 2,
        centerY: (a.y + b.y) / 2,
        moved: true,
      }
      traceRef.current = null
      draw()
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!pointers.current.has(e.pointerId)) return
    const p = localPoint(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    const { w, h } = sizeRef.current
    if (!g) return

    if (g.type === 'pan' && pointers.current.size === 1) {
      const dx = p.x - g.startX
      const dy = p.y - g.startY
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) g.moved = true
      vpRef.current = panViewport(g.startVp, dx, dy)
      traceRef.current = null
      draw()
    } else if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      vpRef.current = zoomViewport(g.startVp, g.centerX, g.centerY, dist / g.startDist, w, h)
      draw()
    }
  }

  const finishPointer = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) return
    const g = gesture.current
    gesture.current = null
    if (!g) return

    if (g.type === 'pan' && !g.moved) {
      const { pointPick: pickMode, onPointPick: pickHandler } = dataRef.current
      if (pickMode && pickHandler) {
        const { w, h } = sizeRef.current
        const wx = screenToWorldX(vpRef.current, g.startSx, w)
        const wy = screenToWorldY(vpRef.current, g.startSy, h)
        pickHandler({ x: Number(wx.toFixed(4)), y: Number(wy.toFixed(4)) })
        return
      }
      const trace = hitTest(g.startSx, g.startSy)
      traceRef.current = trace
      draw()
      return
    }
    onViewportCommit(vpRef.current)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={(el) => {
          canvasRef.current = el
          if (externalCanvasRef) externalCanvasRef.current = el
        }}
        role="img"
        aria-label={ariaLabel}
        data-testid="graph-canvas"
        className="block h-full w-full select-none"
        style={{ touchAction: 'none', cursor: pointPick ? 'crosshair' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
