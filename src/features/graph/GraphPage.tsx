/**
 * Grafik quruvchi — asosiy sahifa.
 *
 * Oqim: ifoda matni → `compileExpression` (sof math core) → GraphCanvas
 * sampling/chizish. Tahlil (hosila/urinma/integral/markerlar) clientda;
 * animatsiya rAF orqali (persist'ga yozmaslik uchun lokal holat, to'xtaganda
 * bir marta commit). Server — FAQAT saqlash/ulashish + AI chat SSE.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bookmark, Camera, Copy, FlaskConical, MessageSquareQuote,
  Redo2, RotateCcw, Table2, Undo2, Wand2,
} from 'lucide-react'
import GraphCanvas, { type GraphSeries, type TangentOverlay, type IntegralOverlay } from './components/GraphCanvas'
import ExpressionList, { type ExprIssue } from './components/ExpressionList'
import TokenPad from './components/TokenPad'
import VariableSliders from './components/VariableSliders'
import PresetSheet from './components/PresetSheet'
import SavedGraphsSheet from './components/SavedGraphsSheet'
import AnalysisCard, { type AnalysisOption } from './components/AnalysisCard'
import TableSheet from './components/TableSheet'
import LabSheet from './components/LabSheet'
import GraphAiSheet from './components/GraphAiSheet'
import { useGraphStore, defaultRange } from './useGraphStore'
import { curveColor } from './curve-colors'
import {
  parseGraphExpression,
  axisVarsOf,
  ExprError,
  mapNormalizedPosition,
  derivativeAt,
  secantSlope,
  makeDerivative,
  integrate,
  riemann,
  analyzeCurves,
  linearRegression,
  type MarkerPoint,
} from './lib/math'
import { buildGraphChatContext } from './lib/chat-context'
import type { GraphPreset } from '../../content/graph-presets'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT, t, type Lang } from '../../shared/i18n'
import { track } from '../../shared/lib/analytics'
import { useToast } from '../../shared/components/ToastContainer'
import { haptics } from '../../platform/haptics'
import { SocraticChatSheet } from '../ai-tutor'
import { api } from '../../shared/api'
import { GRAPH_MAX_EXPRESSIONS } from '../../../shared/contracts/graph'

function exprIssue(err: unknown, text: string, lang: Lang): ExprIssue {
  if (err instanceof ExprError) {
    let message: string
    switch (err.code) {
      case 'empty': message = t(lang, 'graphErrEmpty'); break
      case 'too_long': message = t(lang, 'graphErrTooLong'); break
      case 'too_complex': message = t(lang, 'graphErrTooComplex'); break
      case 'unexpected_end': message = t(lang, 'graphErrUnexpectedEnd'); break
      case 'unexpected_token': message = t(lang, 'graphErrToken').replace('{token}', err.detail ?? ''); break
      case 'bad_function': message = t(lang, 'graphErrFunction').replace('{name}', err.detail ?? ''); break
      case 'arity': message = t(lang, 'graphErrArity').replace('{name}', err.detail ?? ''); break
      default: message = t(lang, 'graphErrSyntax'); break
    }
    return { message, pos: mapNormalizedPosition(text, err.pos) }
  }
  return { message: t(lang, 'graphErrSyntax'), pos: null }
}

type Anim =
  | { kind: 'var'; name: string; value: number; dir: 1 | -1 }
  | { kind: 'point'; x: number; dir: 1 | -1 }
  | { kind: 'secant'; h: number; start: number }

export default function GraphPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const { success, error: toastError } = useToast()

  const expressions = useGraphStore((s) => s.expressions)
  const storeXVar = useGraphStore((s) => s.xVar)
  const vars = useGraphStore((s) => s.vars)
  const ranges = useGraphStore((s) => s.ranges)
  const viewport = useGraphStore((s) => s.viewport)
  const analysis = useGraphStore((s) => s.analysis)
  const points = useGraphStore((s) => s.points)
  const recent = useGraphStore((s) => s.recent)
  const savedId = useGraphStore((s) => s.savedId)
  const savedTitle = useGraphStore((s) => s.savedTitle)
  const history = useGraphStore((s) => s.history)
  const future = useGraphStore((s) => s.future)
  const addExpression = useGraphStore((s) => s.addExpression)
  const updateExpression = useGraphStore((s) => s.updateExpression)
  const removeExpression = useGraphStore((s) => s.removeExpression)
  const cycleColor = useGraphStore((s) => s.cycleColor)
  const setXVar = useGraphStore((s) => s.setXVar)
  const setVar = useGraphStore((s) => s.setVar)
  const ensureVars = useGraphStore((s) => s.ensureVars)
  const setViewport = useGraphStore((s) => s.setViewport)
  const resetViewport = useGraphStore((s) => s.resetViewport)
  const setAnalysis = useGraphStore((s) => s.setAnalysis)
  const addPoint = useGraphStore((s) => s.addPoint)
  const updatePoint = useGraphStore((s) => s.updatePoint)
  const removePoint = useGraphStore((s) => s.removePoint)
  const clearPoints = useGraphStore((s) => s.clearPoints)
  const applyPreset = useGraphStore((s) => s.applyPreset)
  const loadWorkspace = useGraphStore((s) => s.loadWorkspace)
  const markSaved = useGraphStore((s) => s.markSaved)
  const markUnsaved = useGraphStore((s) => s.markUnsaved)
  const pushRecent = useGraphStore((s) => s.pushRecent)
  const snapshot = useGraphStore((s) => s.snapshot)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const toPayload = useGraphStore((s) => s.toPayload)

  const [presetsOpen, setPresetsOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [sharedTitle, setSharedTitle] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [anim, setAnim] = useState<Anim | null>(null)

  const inputEls = useRef(new Map<string, HTMLInputElement>())
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const bootRef = useRef(false)
  const editingRef = useRef<string | null>(null)
  const animRef = useRef<Anim | null>(null)
  animRef.current = anim

  const rangesRef = useRef(ranges)
  rangesRef.current = ranges
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const canvasSizeRef = useRef(canvasSize)
  canvasSizeRef.current = canvasSize

  const compiled = useMemo(() => {
    const errors: Record<string, ExprIssue | null> = {}
    const entries = expressions.map((e) => {
      if (!e.expr.trim()) {
        errors[e.id] = { message: t(language, 'graphErrEmpty'), pos: null }
        return { ...e, parsed: undefined }
      }
      try {
        const parsed = parseGraphExpression(e.expr)
        errors[e.id] = null
        return { ...e, parsed }
      } catch (err) {
        errors[e.id] = exprIssue(err, e.expr, language)
        return { ...e, parsed: undefined }
      }
    })
    return { entries, errors }
  }, [expressions, language])

  /** Barcha erkin o'zgaruvchilar (barcha rejimlar bo'yicha) */
  const allVars = useMemo(() => {
    const found: string[] = []
    for (const e of compiled.entries) {
      for (const v of e.parsed?.vars ?? []) {
        if (!found.includes(v)) found.push(v)
      }
    }
    return found
  }, [compiled])

  /** `y = f(x)` rejimidagi o'zgaruvchilar — X o'qi shu ro'yxatdan tanlanadi */
  const explicitVars = useMemo(() => {
    const found: string[] = []
    for (const e of compiled.entries) {
      if (e.parsed?.kind !== 'y') continue
      for (const v of e.parsed.vars) {
        if (!found.includes(v)) found.push(v)
      }
    }
    return found
  }, [compiled])

  const xVar = explicitVars.includes(storeXVar)
    ? storeXVar
    : explicitVars.includes('t') ? 't' : explicitVars[0] ?? 'x'

  /** Slayderlar: o'qlar (x/y/θ/t) va X o'qidan boshqa barcha o'zgaruvchilar */
  const sliderNames = useMemo(() => {
    const axisVars = new Set<string>()
    for (const e of compiled.entries) {
      if (!e.parsed) continue
      for (const v of axisVarsOf(e.parsed)) axisVars.add(v)
    }
    return allVars.filter((v) => v !== xVar && !axisVars.has(v))
  }, [allVars, compiled, xVar])

  useEffect(() => {
    if (allVars.length > 0) ensureVars(allVars)
  }, [allVars, ensureVars])

  /** Tahlil/jadval faqat `y=f(x)` uchun (hosila/ildiz/integral tushunchalari) */
  const validEntries = useMemo(
    () => compiled.entries.filter(
      (e): e is typeof e & { parsed: Extract<NonNullable<typeof e.parsed>, { kind: 'y' }> } =>
        e.parsed?.kind === 'y' && e.visible,
    ),
    [compiled],
  )

  const hasParsed = useMemo(() => compiled.entries.some((e) => e.parsed && e.visible), [compiled])

  const analysisEntry = useMemo(
    () => validEntries.find((e) => e.id === analysisId) ?? validEntries[0] ?? null,
    [validEntries, analysisId],
  )

  const analysisOptions: AnalysisOption[] = useMemo(
    () => validEntries.map((e) => ({ id: e.id, label: e.expr.trim(), colorIdx: e.colorIdx })),
    [validEntries],
  )

  // Animatsiya paytida store'ga yozmaslik uchun effektiv qiymatlar
  const effVars = useMemo(
    () => (anim?.kind === 'var' ? { ...vars, [anim.name]: anim.value } : vars),
    [anim, vars],
  )
  const effX0 = anim?.kind === 'point' ? anim.x : analysis.x0

  const analysisValues = useMemo(() => {
    if (!analysisEntry) return null
    const fn = analysisEntry.parsed.fn
    const fValue = fn({ ...effVars, [xVar]: effX0 })
    const slopeValue = analysis.tangent ? derivativeAt(fn, effVars, xVar, effX0) : NaN
    const secantValue = analysis.secant ? secantSlope(fn, effVars, xVar, effX0, analysis.h) : NaN
    const area = analysis.integral ? integrate(fn, effVars, xVar, analysis.a, analysis.b) : NaN
    const riemannSum = analysis.integral
      ? riemann(fn, effVars, xVar, analysis.a, analysis.b, analysis.rects).sum
      : NaN
    return { fValue, slopeValue, secantValue, area, riemannSum }
  }, [
    analysisEntry, effVars, xVar, effX0,
    analysis.tangent, analysis.secant, analysis.h,
    analysis.integral, analysis.a, analysis.b, analysis.rects,
  ])

  const series: GraphSeries[] = useMemo(() => {
    const list: GraphSeries[] = []
    for (const e of compiled.entries) {
      if (!e.parsed || !e.visible) continue
      const color = curveColor(e.colorIdx)
      const p = e.parsed
      switch (p.kind) {
        case 'y':
          list.push({ id: e.id, color, visible: true, kind: 'y', fn: p.fn })
          break
        case 'polar':
          list.push({
            id: e.id, color, visible: true, kind: 'polar', fn: p.fn,
            param: { name: p.angleVar, min: 0, max: Math.PI * 2 },
          })
          break
        case 'parametric':
          list.push({
            id: e.id, color, visible: true, kind: 'parametric', fn: p.xFn, fn2: p.yFn,
            param: { name: p.paramVar, min: 0, max: Math.PI * 2 },
          })
          break
        case 'implicit':
          list.push({ id: e.id, color, visible: true, kind: 'implicit', fn: p.fn, relation: p.relation })
          break
      }
    }
    if (analysis.derivative && analysisEntry) {
      list.push({
        id: `${analysisEntry.id}-d`,
        color: curveColor(analysisEntry.colorIdx),
        visible: true,
        dashed: true,
        kind: 'y',
        fn: makeDerivative(analysisEntry.parsed.fn, xVar),
      })
    }
    return list
  }, [compiled, analysis.derivative, analysisEntry, xVar])

  const tangentOverlay: TangentOverlay | null = useMemo(() => {
    if (!analysis.tangent || !analysisEntry || !analysisValues) return null
    if (!Number.isFinite(analysisValues.fValue) || !Number.isFinite(analysisValues.slopeValue)) return null
    return {
      x0: effX0,
      y0: analysisValues.fValue,
      slope: analysisValues.slopeValue,
      color: curveColor(analysisEntry.colorIdx),
    }
  }, [analysis.tangent, analysisEntry, analysisValues, effX0])

  const integralOverlay: IntegralOverlay | null = useMemo(() => {
    if (!analysis.integral || !analysisEntry) return null
    return {
      fn: analysisEntry.parsed.fn,
      scope: effVars,
      xVar,
      a: analysis.a,
      b: analysis.b,
      n: analysis.rects,
      color: curveColor(analysisEntry.colorIdx),
    }
  }, [analysis.integral, analysisEntry, effVars, xVar, analysis.a, analysis.b, analysis.rects])

  const secantOverlay = useMemo(() => {
    if (!analysis.secant || !analysisEntry || !analysisValues) return null
    const fn = analysisEntry.parsed.fn
    const x1 = effX0 + analysis.h
    const y0 = analysisValues.fValue
    const y1 = fn({ ...effVars, [xVar]: x1 })
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) return null
    return {
      x0: effX0,
      x1,
      y0,
      y1,
      slope: analysisValues.secantValue,
      color: curveColor(analysisEntry.colorIdx),
    }
  }, [analysis.secant, analysisEntry, analysisValues, effX0, analysis.h, effVars, xVar])

  const regression = useMemo(() => linearRegression(points), [points])

  const markerPoints: MarkerPoint[] = useMemo(() => {
    if (!analysis.markers || validEntries.length === 0) return []
    const w = canvasSize.w || 400
    const half = (w * viewport.unitsPerPx) / 2
    return analyzeCurves(
      validEntries.map((e) => ({ id: e.id, fn: e.parsed.fn })),
      effVars,
      xVar,
      viewport.cx - half,
      viewport.cx + half,
    )
  }, [analysis.markers, validEntries, effVars, xVar, canvasSize.w, viewport.cx, viewport.unitsPerPx])

  const markerCounts = useMemo(() => ({
    root: markerPoints.filter((m) => m.kind === 'root').length,
    extrema: markerPoints.filter((m) => m.kind === 'extrema').length,
    cross: markerPoints.filter((m) => m.kind === 'cross').length,
  }), [markerPoints])

  const movingPoint = useMemo(() => {
    if (anim?.kind !== 'point' || !analysisEntry) return null
    const value = analysisEntry.parsed.fn({ ...effVars, [xVar]: anim.x })
    if (!Number.isFinite(value)) return null
    return { x: anim.x, y: value, color: curveColor(analysisEntry.colorIdx) }
  }, [anim, analysisEntry, effVars, xVar])

  // ── Animatsiya halqasi (rAF) ───────────────────────────────────────────────
  const animating = anim !== null
  useEffect(() => {
    if (!animating) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min(0.08, Math.max(0.001, (now - last) / 1000))
      last = now
      setAnim((a) => {
        if (!a) return a
        if (a.kind === 'var') {
          const range = rangesRef.current[a.name] ?? defaultRange(a.name)
          const speed = Math.max(1e-9, range.max - range.min) / 6
          let value = a.value + a.dir * speed * dt
          let dir = a.dir
          if (value >= range.max) { value = range.max; dir = -1 }
          else if (value <= range.min) { value = range.min; dir = 1 }
          return { ...a, value, dir }
        }
        if (a.kind === 'secant') {
          let hh = Math.max(0.001, a.h * Math.exp(-dt * 2.5))
          if (hh <= 0.0012) hh = a.start
          return { ...a, h: hh }
        }
        const half = ((canvasSizeRef.current.w || 400) * viewportRef.current.unitsPerPx) / 2
        const lo = viewportRef.current.cx - half
        const hi = viewportRef.current.cx + half
        const speed = Math.max(1e-9, hi - lo) / 6
        let x = a.x + a.dir * speed * dt
        let dir = a.dir
        if (x >= hi) { x = hi; dir = -1 }
        else if (x <= lo) { x = lo; dir = 1 }
        return { ...a, x, dir }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animating])

  const stopAnim = useCallback((): void => {
    const a = animRef.current
    if (a) {
      if (a.kind === 'var') setVar(a.name, Number(a.value.toFixed(3)))
      else if (a.kind === 'point') setAnalysis({ x0: Number(a.x.toFixed(3)) })
      else setAnalysis({ h: Number(a.h.toFixed(3)) })
    }
    setAnim(null)
  }, [setVar, setAnalysis])

  const toggleVarAnim = useCallback((name: string): void => {
    const current = animRef.current
    if (current?.kind === 'var' && current.name === name) { stopAnim(); return }
    if (current) stopAnim()
    const value = useGraphStore.getState().vars[name] ?? 1
    const range = rangesRef.current[name] ?? defaultRange(name)
    setAnim({ kind: 'var', name, value: Math.min(range.max, Math.max(range.min, value)), dir: 1 })
  }, [stopAnim])

  const togglePointAnim = useCallback((): void => {
    const current = animRef.current
    if (current?.kind === 'point') { stopAnim(); return }
    if (current) stopAnim()
    setAnim({ kind: 'point', x: analysis.x0, dir: 1 })
  }, [stopAnim, analysis.x0])

  const toggleSecantAnim = useCallback((): void => {
    const current = animRef.current
    if (current?.kind === 'secant') { stopAnim(); return }
    if (current) stopAnim()
    const h0 = Math.max(0.05, Math.min(3, analysis.h))
    setAnim({ kind: 'secant', h: h0, start: h0 })
  }, [stopAnim, analysis.h])

  const handlePointPick = useCallback((p: { x: number; y: number }): void => {
    snapshot()
    addPoint(p)
    haptics.impact('light')
  }, [snapshot, addPoint])

  const readOnly = sharedTitle !== null

  const chatContext = useMemo(
    () => buildGraphChatContext({
      expressions,
      xVar,
      vars: effVars,
      language,
      analysis: {
        derivative: analysis.derivative,
        tangent: analysis.tangent,
        x0: effX0,
        integral: analysis.integral,
        a: analysis.a,
        b: analysis.b,
        rects: analysis.rects,
      },
    }),
    [expressions, xVar, effVars, language, analysis, effX0],
  )

  // Deep-link: ?e=<ifoda>&x=<o'zgaruvchi> yoki ?g=<share kod>
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    const g = searchParams.get('g')
    if (g) {
      api.getSharedGraph(g)
        .then((res) => {
          loadWorkspace(res.graph.payload, null)
          setSharedTitle(res.graph.title)
          track('graph_open', { source: 'share' })
        })
        .catch(() => toastError(t(language, 'graphOpenError')))
      return
    }
    const e = searchParams.get('e')
    if (e) {
      const text = e.slice(0, 200)
      const first = expressions[0]
      if (first) updateExpression(first.id, { expr: text })
      else addExpression(text)
      const x = searchParams.get('x')
      if (x) setXVar(x.slice(0, 16))
      track('graph_open', { source: 'deep_link' })
    } else {
      track('graph_open')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const registerInput = useCallback((id: string, el: HTMLInputElement | null) => {
    if (el) inputEls.current.set(id, el)
    else inputEls.current.delete(id)
  }, [])

  const handleFocusInput = useCallback((id: string) => {
    setActiveId(id)
    if (editingRef.current !== id) {
      snapshot()
      editingRef.current = id
    }
  }, [snapshot])

  const handleBlurInput = useCallback((id: string) => {
    editingRef.current = null
    const e = useGraphStore.getState().expressions.find((x) => x.id === id)
    if (e) pushRecent(e.expr)
  }, [pushRecent])

  const handleInsert = useCallback((token: string) => {
    const id = activeId ?? expressions[expressions.length - 1]?.id
    if (!id) return
    const current = useGraphStore.getState().expressions.find((e) => e.id === id)
    if (!current) return
    const el = inputEls.current.get(id)
    const start = el?.selectionStart ?? current.expr.length
    const end = el?.selectionEnd ?? start
    const next = `${current.expr.slice(0, start)}${token}${current.expr.slice(end)}`.slice(0, 200)
    updateExpression(id, { expr: next })
    requestAnimationFrame(() => {
      const node = inputEls.current.get(id)
      if (node) {
        const pos = Math.min(start + token.length, next.length)
        node.focus()
        node.setSelectionRange(pos, pos)
      }
    })
  }, [activeId, expressions, updateExpression])

  const applyRecent = useCallback((text: string) => {
    const id = activeId ?? expressions[expressions.length - 1]?.id
    if (!id) return
    snapshot()
    updateExpression(id, { expr: text })
  }, [activeId, expressions, snapshot, updateExpression])

  const handleApplyPreset = useCallback((preset: GraphPreset) => {
    snapshot()
    applyPreset(preset)
    setPresetsOpen(false)
    setSharedTitle(null)
    setAnalysisId(null)
    track('graph_preset_apply', { preset: preset.id })
  }, [snapshot, applyPreset])

  const handleCopyShared = useCallback(async () => {
    if (copying) return
    setCopying(true)
    try {
      const res = await api.createGraph({ title: sharedTitle ?? tt('graphTitle'), payload: toPayload() })
      markSaved(res.graph.id, res.graph.title)
      setSharedTitle(null)
      success(tt('graphSaved'))
      track('graph_save', { source: 'copy_shared' })
    } catch {
      toastError(tt('graphSaveOffline'))
    } finally {
      setCopying(false)
    }
  }, [copying, sharedTitle, toPayload, markSaved, success, toastError, tt])

  const handleCanvasSize = useCallback((size: { w: number; h: number }) => {
    setCanvasSize((prev) => (prev.w === size.w && prev.h === size.h ? prev : size))
  }, [])

  const tableColumns = useMemo(
    () => validEntries.map((e, i) => ({
      id: e.id,
      label: `f${i + 1}`,
      color: curveColor(e.colorIdx),
      fn: e.parsed.fn,
    })),
    [validEntries],
  )

  const domainHalf = ((canvasSize.w || 400) * viewport.unitsPerPx) / 2

  return (
    <div className="font-display bg-pcanvas pb-6">
      <PageHeader
        title={sharedTitle ?? tt('graphTitle')}
        subtitle={tt('graphSubtitle')}
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="mb-3"
        actions={
          <>
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              aria-label={tt('graphUndo')}
              className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <Undo2 size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              aria-label={tt('graphRedo')}
              className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <Redo2 size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setPresetsOpen(true)}
              aria-label={tt('graphPresets')}
              className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <Wand2 size={18} strokeWidth={1.75} />
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setSavedOpen(true)}
                aria-label={tt('graphSavedGraphs')}
                className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                <Bookmark size={18} strokeWidth={1.75} />
              </button>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="mx-5 mb-3 flex items-center gap-3 rounded-2xl bg-psurface p-3">
          <p className="min-w-0 flex-1 text-[12.5px] text-pmuted">{tt('graphReadOnly')}</p>
          <button
            type="button"
            onClick={handleCopyShared}
            disabled={copying}
            className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl bg-pprimary px-3 text-[12.5px] font-semibold text-ponprimary disabled:opacity-50"
          >
            <Copy size={14} strokeWidth={1.75} />
            {tt('graphCopyToMy')}
          </button>
        </div>
      )}

      <div className="px-5">
        <div className="overflow-hidden rounded-2xl bg-pcard shadow-xs">
          <div className="relative h-[46vh] max-h-[520px] min-h-[300px]">
            <GraphCanvas
              series={series}
              scope={effVars}
              xVar={xVar}
              viewport={viewport}
              onViewportCommit={setViewport}
              tangent={tangentOverlay}
              integral={integralOverlay}
              markers={markerPoints}
              movingPoint={movingPoint}
              points={points}
              regression={regression}
              pointPick={pickMode}
              onPointPick={handlePointPick}
              secant={secantOverlay}
              canvasRef={canvasElRef}
              onSize={handleCanvasSize}
              ariaLabel={`${tt('graphTitle')}: ${expressions.map((e) => e.expr).join(', ')}`}
            />
            <button
              type="button"
              onClick={resetViewport}
              aria-label={tt('graphResetView')}
              className="absolute right-2 top-2 grid size-9 place-items-center rounded-xl bg-pcard text-pmuted shadow-xs transition-colors hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <RotateCcw size={16} strokeWidth={1.75} />
            </button>
            {series.length === 0 && (
              <p className="pointer-events-none absolute inset-0 grid place-items-center text-[12.5px] text-psubtle">
                {tt('graphAddHint')}
              </p>
            )}
          </div>
        </div>

        {(hasParsed || points.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {hasParsed && (
              <button
                type="button"
                onClick={() => { setChatOpen(true); track('graph_ai_chat') }}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-psurface text-[13px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                <MessageSquareQuote size={16} strokeWidth={1.75} />
                {tt('graphAiDiscuss')}
              </button>
            )}
            {validEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setTableOpen(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-psurface text-[13px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                <Table2 size={16} strokeWidth={1.75} />
                {tt('graphTable')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLabOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-psurface text-[13px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
            >
              <FlaskConical size={16} strokeWidth={1.75} />
              {tt('graphLab')}
              {points.length > 0 && (
                <span className="rounded-lg bg-psurface px-1.5 font-mono text-[11px] text-psubtle">{points.length}</span>
              )}
            </button>
            {hasParsed && (
              <button
                type="button"
                onClick={() => { setAiOpen(true); track('graph_ai_vision') }}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-psurface text-[13px] font-semibold text-pmuted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
              >
                <Camera size={16} strokeWidth={1.75} />
                {tt('graphAiVision')}
              </button>
            )}
          </div>
        )}

        {explicitVars.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <span className="flex-shrink-0 pr-1 text-[11px] font-semibold text-psubtle">{tt('graphXAxis')}</span>
            {explicitVars.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { snapshot(); setXVar(v) }}
                className={`h-8 flex-shrink-0 rounded-xl px-3 font-mono text-[12px] font-semibold transition-colors ${
                  v === xVar ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted hover:text-fg'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-pcard p-3 shadow-xs">
          <ExpressionList
            language={language}
            expressions={expressions}
            errors={compiled.errors}
            registerInput={registerInput}
            onFocusInput={handleFocusInput}
            onBlurInput={handleBlurInput}
            onChange={(id, expr) => updateExpression(id, { expr })}
            onToggleVisible={(id) => {
              const e = expressions.find((x) => x.id === id)
              if (e) { snapshot(); updateExpression(id, { visible: !e.visible }) }
            }}
            onCycleColor={(id) => { snapshot(); cycleColor(id) }}
            onRemove={(id) => { snapshot(); removeExpression(id) }}
            onAdd={() => { snapshot(); addExpression('') }}
            canAdd={expressions.length < GRAPH_MAX_EXPRESSIONS}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && (
          <div className="mt-3">
            <TokenPad language={language} onInsert={handleInsert} />
            <p className="mt-1.5 text-[10.5px] text-psubtle">{tt('graphModesHint')}</p>
          </div>
        )}

        {!readOnly && recent.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <span className="flex-shrink-0 pr-1 text-[11px] text-psubtle">{tt('graphRecent')}</span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => applyRecent(r)}
                className="h-8 max-w-[160px] flex-shrink-0 truncate rounded-xl bg-psurface px-2.5 font-mono text-[12px] text-pmuted transition-colors hover:text-fg"
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          <VariableSliders
            language={language}
            names={sliderNames}
            values={vars}
            ranges={ranges}
            onChange={(name, value) => {
              if (animRef.current?.kind === 'var' && animRef.current.name === name) stopAnim()
              setVar(name, value)
            }}
            animatingName={anim?.kind === 'var' ? anim.name : null}
            animValue={anim?.kind === 'var' ? anim.value : null}
            onToggleAnimate={toggleVarAnim}
          />
        </div>

        {analysisEntry && analysisValues && (
          <div className="mt-3">
            <AnalysisCard
              language={language}
              options={analysisOptions}
              selectedId={analysisEntry.id}
              onSelect={setAnalysisId}
              derivativeOn={analysis.derivative}
              onDerivative={(v) => setAnalysis({ derivative: v })}
              tangentOn={analysis.tangent}
              onTangent={(v) => setAnalysis({ tangent: v })}
              x0={effX0}
              onX0={(v) => setAnalysis({ x0: v })}
              fValue={analysisValues.fValue}
              slopeValue={analysisValues.slopeValue}
              integralOn={analysis.integral}
              onIntegral={(v) => setAnalysis({ integral: v })}
              a={analysis.a}
              b={analysis.b}
              onA={(v) => setAnalysis({ a: v })}
              onB={(v) => setAnalysis({ b: v })}
              rects={analysis.rects}
              onRects={(v) => setAnalysis({ rects: Math.round(v) })}
              area={analysisValues.area}
              riemannSum={analysisValues.riemannSum}
              secantOn={analysis.secant}
              onSecant={(v) => setAnalysis({ secant: v })}
              h={analysis.h}
              onH={(v) => setAnalysis({ h: v })}
              secantSlope={analysisValues.secantValue}
              secantPlaying={anim?.kind === 'secant'}
              onToggleSecantPlay={toggleSecantAnim}
              pointPlaying={anim?.kind === 'point'}
              onTogglePoint={togglePointAnim}
              markersOn={analysis.markers}
              onMarkers={(v) => setAnalysis({ markers: v })}
              rootCount={markerCounts.root}
              extremaCount={markerCounts.extrema}
              crossCount={markerCounts.cross}
            />
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-psubtle">{tt('graphTraceHint')}</p>
      </div>

      <PresetSheet
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        language={language}
        onApply={handleApplyPreset}
      />
      <SavedGraphsSheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        language={language}
        savedId={savedId}
        savedTitle={savedTitle}
        getPayload={toPayload}
        onSaved={markSaved}
        onLoaded={(payload, id, title) => {
          loadWorkspace(payload, { id, title })
          setSharedTitle(null)
          setAnalysisId(null)
          track('graph_open', { source: 'saved' })
        }}
        onDeleted={(id) => {
          if (id === savedId) markUnsaved()
        }}
      />
      <TableSheet
        open={tableOpen}
        onClose={() => setTableOpen(false)}
        language={language}
        columns={tableColumns}
        xVar={xVar}
        scope={effVars}
        xMin={viewport.cx - domainHalf}
        xMax={viewport.cx + domainHalf}
      />
      <LabSheet
        open={labOpen}
        onClose={() => setLabOpen(false)}
        language={language}
        points={points}
        onChangePoint={(i, patch) => { snapshot(); updatePoint(i, patch) }}
        onAdd={() => { snapshot(); addPoint({ x: 0, y: 0 }) }}
        onRemove={(i) => { snapshot(); removePoint(i) }}
        onClear={() => { snapshot(); clearPoints() }}
        pickMode={pickMode}
        onPickMode={setPickMode}
      />
      <GraphAiSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        language={language}
        canvasRef={canvasElRef}
        context={chatContext.questionText}
        onPremium={() => navigate('/premium')}
      />
      <SocraticChatSheet
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={chatContext}
        initialPrompt={tt('graphAiPrompt')}
      />
    </div>
  )
}
