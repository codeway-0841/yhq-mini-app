/**
 * Grafik quruvchi — asosiy sahifa.
 *
 * Oqim: ifoda matni → `compileExpression` (sof math core) → GraphCanvas
 * sampling/chizish. Server bilan aloqa FAQAT saqlash/ulashish (payload),
 * matematika serverga yuborilmaydi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, Copy, RotateCcw, Wand2 } from 'lucide-react'
import GraphCanvas, { type GraphSeries } from './components/GraphCanvas'
import ExpressionList from './components/ExpressionList'
import TokenPad from './components/TokenPad'
import VariableSliders from './components/VariableSliders'
import PresetSheet from './components/PresetSheet'
import SavedGraphsSheet from './components/SavedGraphsSheet'
import { useGraphStore } from './useGraphStore'
import { curveColor } from './curve-colors'
import { compileExpression, ExprError } from './lib/math'
import type { GraphPreset } from '../../content/graph-presets'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT, t, type Lang } from '../../shared/i18n'
import { track } from '../../shared/lib/analytics'
import { useToast } from '../../shared/components/ToastContainer'
import { api } from '../../shared/api'
import { GRAPH_MAX_EXPRESSIONS } from '../../../shared/contracts/graph'

function exprErrorMessage(err: unknown, lang: Lang): string {
  if (err instanceof ExprError) {
    switch (err.code) {
      case 'empty': return t(lang, 'graphErrEmpty')
      case 'too_long': return t(lang, 'graphErrTooLong')
      case 'too_complex': return t(lang, 'graphErrTooComplex')
      case 'unexpected_end': return t(lang, 'graphErrUnexpectedEnd')
      case 'unexpected_token': return t(lang, 'graphErrToken').replace('{token}', err.detail ?? '')
      case 'bad_function': return t(lang, 'graphErrFunction').replace('{name}', err.detail ?? '')
      case 'arity': return t(lang, 'graphErrArity').replace('{name}', err.detail ?? '')
    }
  }
  return t(lang, 'graphErrSyntax')
}

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
  const savedId = useGraphStore((s) => s.savedId)
  const savedTitle = useGraphStore((s) => s.savedTitle)
  const addExpression = useGraphStore((s) => s.addExpression)
  const updateExpression = useGraphStore((s) => s.updateExpression)
  const removeExpression = useGraphStore((s) => s.removeExpression)
  const cycleColor = useGraphStore((s) => s.cycleColor)
  const setXVar = useGraphStore((s) => s.setXVar)
  const setVar = useGraphStore((s) => s.setVar)
  const ensureVars = useGraphStore((s) => s.ensureVars)
  const setViewport = useGraphStore((s) => s.setViewport)
  const resetViewport = useGraphStore((s) => s.resetViewport)
  const applyPreset = useGraphStore((s) => s.applyPreset)
  const loadWorkspace = useGraphStore((s) => s.loadWorkspace)
  const markSaved = useGraphStore((s) => s.markSaved)
  const markUnsaved = useGraphStore((s) => s.markUnsaved)
  const toPayload = useGraphStore((s) => s.toPayload)

  const [presetsOpen, setPresetsOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sharedTitle, setSharedTitle] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const inputEls = useRef(new Map<string, HTMLInputElement>())
  const bootRef = useRef(false)

  const compiled = useMemo(() => {
    const errors: Record<string, string | null> = {}
    const entries = expressions.map((e) => {
      if (!e.expr.trim()) {
        errors[e.id] = t(language, 'graphErrEmpty')
        return { ...e, fn: undefined, vars: [] as string[] }
      }
      try {
        const { fn, vars: v } = compileExpression(e.expr)
        errors[e.id] = null
        return { ...e, fn, vars: v }
      } catch (err) {
        errors[e.id] = exprErrorMessage(err, language)
        return { ...e, fn: undefined, vars: [] as string[] }
      }
    })
    return { entries, errors }
  }, [expressions, language])

  const freeVars = useMemo(() => {
    const found: string[] = []
    const seen = new Set<string>()
    for (const e of compiled.entries) {
      for (const v of e.vars) {
        if (!seen.has(v)) { seen.add(v); found.push(v) }
      }
    }
    return found
  }, [compiled])

  const xVar = freeVars.includes(storeXVar)
    ? storeXVar
    : freeVars.includes('t') ? 't' : freeVars[0] ?? 'x'
  const sliderNames = freeVars.filter((v) => v !== xVar)

  useEffect(() => {
    if (freeVars.length > 0) ensureVars(freeVars)
  }, [freeVars, ensureVars])

  const series: GraphSeries[] = useMemo(
    () => compiled.entries
      .filter((e): e is typeof e & { fn: NonNullable<typeof e.fn> } => Boolean(e.fn))
      .map((e) => ({ id: e.id, color: curveColor(e.colorIdx), visible: e.visible, fn: e.fn })),
    [compiled],
  )

  const readOnly = sharedTitle !== null

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

  const handleApplyPreset = useCallback((preset: GraphPreset) => {
    applyPreset(preset)
    setPresetsOpen(false)
    setSharedTitle(null)
    track('graph_preset_apply', { preset: preset.id })
  }, [applyPreset])

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

  return (
    <div className="font-display bg-pcanvas pb-6">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] px-5 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => goBack(navigate)}
          aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold leading-tight text-pfg">
            {sharedTitle ?? tt('graphTitle')}
          </h1>
          <p className="text-[11px] text-psubtle">{tt('graphSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={resetViewport}
          aria-label={tt('graphResetView')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <RotateCcw size={18} strokeWidth={1.75} />
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
      </header>

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
              scope={vars}
              xVar={xVar}
              viewport={viewport}
              onViewportCommit={setViewport}
              ariaLabel={`${tt('graphTitle')}: ${expressions.map((e) => e.expr).join(', ')}`}
            />
            {series.length === 0 && (
              <p className="pointer-events-none absolute inset-0 grid place-items-center text-[12.5px] text-psubtle">
                {tt('graphAddHint')}
              </p>
            )}
          </div>
        </div>

        {freeVars.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <span className="flex-shrink-0 pr-1 text-[11px] font-semibold text-psubtle">{tt('graphXAxis')}</span>
            {freeVars.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setXVar(v)}
                className={`h-8 flex-shrink-0 rounded-xl px-3 font-mono text-[12px] font-semibold transition-colors ${
                  v === xVar ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted hover:text-pfg'
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
            onFocusInput={setActiveId}
            onChange={(id, expr) => updateExpression(id, { expr })}
            onToggleVisible={(id) => {
              const e = expressions.find((x) => x.id === id)
              if (e) updateExpression(id, { visible: !e.visible })
            }}
            onCycleColor={cycleColor}
            onRemove={removeExpression}
            onAdd={() => addExpression('')}
            canAdd={expressions.length < GRAPH_MAX_EXPRESSIONS}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && (
          <div className="mt-3">
            <TokenPad language={language} onInsert={handleInsert} />
          </div>
        )}

        <div className="mt-3">
          <VariableSliders
            language={language}
            names={sliderNames}
            values={vars}
            ranges={ranges}
            onChange={setVar}
          />
        </div>

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
          track('graph_open', { source: 'saved' })
        }}
        onDeleted={(id) => {
          if (id === savedId) markUnsaved()
        }}
      />
    </div>
  )
}
