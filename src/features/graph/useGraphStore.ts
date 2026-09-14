/**
 * Grafik quruvchi — workspace store (persist: 'yhq-graph').
 *
 * Server'ga yuboriladigan payload — `expressions/xVar/vars/viewport/analysis`
 * (shared/contracts/graph.ts). `ranges` — slayder oraliqlari (UI holati,
 * serverga saqlanmaydi). `history/future` — undo/redo (persist QILINMAYDI).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GraphAnalysis,
  GraphExpression,
  GraphPayload,
  GraphViewport,
} from '../../../shared/contracts/graph'
import { GRAPH_MAX_EXPRESSIONS } from '../../../shared/contracts/graph'
import { DEFAULT_VIEWPORT } from './lib/plot/viewport'
import type { GraphPreset } from '../../content/graph-presets'

export interface GraphRange {
  min: number
  max: number
  step: number
}

type StoredExpression = GraphExpression & { id: string }

export type { StoredExpression }

export interface PersistedGraphState {
  expressions: StoredExpression[]
  xVar: string
  vars: Record<string, number>
  ranges: Record<string, GraphRange>
  viewport: GraphViewport
  analysis: GraphAnalysis
  recent: string[]
  savedId: string | null
  savedTitle: string | null
}

export interface GraphSnapshot {
  expressions: StoredExpression[]
  xVar: string
  vars: Record<string, number>
  analysis: GraphAnalysis
}

const CURVE_COLOR_COUNT = 6
const HISTORY_MAX = 30
const RECENT_MAX = 8

const makeId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const DEFAULT_ANALYSIS: GraphAnalysis = {
  derivative: false,
  tangent: false,
  x0: 1,
  integral: false,
  a: 0,
  b: 1,
  rects: 10,
  markers: false,
}

export function defaultRange(name: string): GraphRange {
  switch (name) {
    case 't':  return { min: 0, max: 10, step: 0.1 }
    case 'v0': return { min: -20, max: 20, step: 1 }
    case 'g':  return { min: 0, max: 20, step: 0.01 }
    default:   return { min: -10, max: 10, step: 0.1 }
  }
}

function defaultExpressions(): StoredExpression[] {
  return [{ expr: 'sin(x)', colorIdx: 0, visible: true, id: makeId() }]
}

interface GraphState {
  expressions: StoredExpression[]
  xVar: string
  vars: Record<string, number>
  ranges: Record<string, GraphRange>
  viewport: GraphViewport
  analysis: GraphAnalysis
  recent: string[]
  savedId: string | null
  savedTitle: string | null
  history: GraphSnapshot[]
  future: GraphSnapshot[]

  addExpression: (text?: string) => void
  updateExpression: (id: string, patch: { expr?: string; visible?: boolean }) => void
  removeExpression: (id: string) => void
  cycleColor: (id: string) => void
  setXVar: (name: string) => void
  setVar: (name: string, value: number) => void
  ensureVars: (names: string[]) => void
  setViewport: (vp: GraphViewport) => void
  resetViewport: () => void
  setAnalysis: (patch: Partial<GraphAnalysis>) => void
  pushRecent: (expr: string) => void
  applyPreset: (preset: GraphPreset) => void
  loadWorkspace: (payload: GraphPayload, meta: { id: string; title: string } | null) => void
  markSaved: (id: string, title: string) => void
  markUnsaved: () => void
  snapshot: () => void
  undo: () => void
  redo: () => void
  reset: () => void
  toPayload: () => GraphPayload
}

const initial = {
  expressions: defaultExpressions(),
  xVar: 'x',
  vars: {} as Record<string, number>,
  ranges: {} as Record<string, GraphRange>,
  viewport: DEFAULT_VIEWPORT,
  analysis: { ...DEFAULT_ANALYSIS },
  recent: [] as string[],
  savedId: null as string | null,
  savedTitle: null as string | null,
  history: [] as GraphSnapshot[],
  future: [] as GraphSnapshot[],
}

function snapshotOf(s: Pick<GraphState, 'expressions' | 'xVar' | 'vars' | 'analysis'>): GraphSnapshot {
  return {
    expressions: s.expressions,
    xVar: s.xVar,
    vars: { ...s.vars },
    analysis: { ...s.analysis },
  }
}

export const useGraphStore = create<GraphState>()(
  persist<GraphState, [], [], PersistedGraphState>(
    (set, get) => ({
      ...initial,

      addExpression: (text = '') => {
        const { expressions } = get()
        if (expressions.length >= GRAPH_MAX_EXPRESSIONS) return
        set({
          expressions: [
            ...expressions,
            { id: makeId(), expr: text, colorIdx: expressions.length % CURVE_COLOR_COUNT, visible: true },
          ],
        })
      },

      updateExpression: (id, patch) =>
        set((s) => ({
          expressions: s.expressions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeExpression: (id) =>
        set((s) => ({
          expressions: s.expressions.filter((e) => e.id !== id),
        })),

      cycleColor: (id) =>
        set((s) => ({
          expressions: s.expressions.map((e) =>
            e.id === id ? { ...e, colorIdx: (e.colorIdx + 1) % CURVE_COLOR_COUNT } : e,
          ),
        })),

      setXVar: (name) => set({ xVar: name }),

      setVar: (name, value) =>
        set((s) => ({ vars: { ...s.vars, [name]: value } })),

      ensureVars: (names) => {
        const { vars, ranges } = get()
        const missingVars: Record<string, number> = {}
        const missingRanges: Record<string, GraphRange> = {}
        for (const n of names) {
          if (vars[n] === undefined) missingVars[n] = 1
          if (ranges[n] === undefined) missingRanges[n] = defaultRange(n)
        }
        if (Object.keys(missingVars).length === 0 && Object.keys(missingRanges).length === 0) return
        set((s) => ({
          vars: { ...s.vars, ...missingVars },
          ranges: { ...s.ranges, ...missingRanges },
        }))
      },

      setViewport: (vp) => set({ viewport: { ...vp } }),
      resetViewport: () => set({ viewport: DEFAULT_VIEWPORT }),

      setAnalysis: (patch) =>
        set((s) => ({ analysis: { ...s.analysis, ...patch } })),

      pushRecent: (expr) => {
        const text = expr.trim()
        if (!text) return
        set((s) => ({
          recent: [text, ...s.recent.filter((r) => r !== text)].slice(0, RECENT_MAX),
        }))
      },

      applyPreset: (preset) => {
        const vars: Record<string, number> = {}
        const ranges: Record<string, GraphRange> = {}
        for (const [name, cfg] of Object.entries(preset.vars)) {
          vars[name] = cfg.value
          ranges[name] = { min: cfg.min, max: cfg.max, step: cfg.step }
        }
        set({
          expressions: [{ id: makeId(), expr: preset.expr, colorIdx: 0, visible: true }],
          xVar: preset.xVar,
          vars,
          ranges,
          viewport: DEFAULT_VIEWPORT,
          analysis: { ...DEFAULT_ANALYSIS },
          savedId: null,
          savedTitle: null,
        })
      },

      loadWorkspace: (payload, meta) => {
        const ranges: Record<string, GraphRange> = {}
        for (const name of Object.keys(payload.vars)) {
          if (name === payload.xVar) continue
          ranges[name] = get().ranges[name] ?? defaultRange(name)
        }
        set({
          expressions: payload.expressions.map((e) => ({ ...e, id: makeId() })),
          xVar: payload.xVar,
          vars: { ...payload.vars },
          ranges,
          viewport: { ...payload.viewport },
          analysis: payload.analysis ? { ...payload.analysis } : { ...DEFAULT_ANALYSIS },
          savedId: meta?.id ?? null,
          savedTitle: meta?.title ?? null,
          history: [],
          future: [],
        })
      },

      markSaved: (id, title) => set({ savedId: id, savedTitle: title }),
      markUnsaved: () => set({ savedId: null, savedTitle: null }),

      snapshot: () => {
        const s = get()
        const snap = snapshotOf(s)
        const last = s.history[s.history.length - 1]
        if (last && JSON.stringify(last) === JSON.stringify(snap)) return
        set({ history: [...s.history.slice(-(HISTORY_MAX - 1)), snap], future: [] })
      },

      undo: () => {
        const { history, future } = get()
        if (history.length === 0) return
        const prev = history[history.length - 1]
        const current = snapshotOf(get())
        set({
          expressions: prev.expressions,
          xVar: prev.xVar,
          vars: prev.vars,
          analysis: prev.analysis,
          history: history.slice(0, -1),
          future: [...future.slice(-(HISTORY_MAX - 1)), current],
        })
      },

      redo: () => {
        const { history, future } = get()
        if (future.length === 0) return
        const next = future[future.length - 1]
        const current = snapshotOf(get())
        set({
          expressions: next.expressions,
          xVar: next.xVar,
          vars: next.vars,
          analysis: next.analysis,
          history: [...history.slice(-(HISTORY_MAX - 1)), current],
          future: future.slice(0, -1),
        })
      },

      reset: () => set({ ...initial, expressions: defaultExpressions() }),

      toPayload: () => {
        const { expressions, xVar, vars, viewport, analysis } = get()
        return {
          expressions: expressions.map(({ expr, colorIdx, visible }) => ({ expr, colorIdx, visible })),
          xVar,
          vars: { ...vars },
          viewport: { ...viewport },
          analysis: { ...analysis },
        }
      },
    }),
    {
      name: 'yhq-graph',
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<PersistedGraphState>
        return {
          ...p,
          analysis: p.analysis ?? { ...DEFAULT_ANALYSIS },
          recent: p.recent ?? [],
        } as PersistedGraphState
      },
      partialize: (s): PersistedGraphState => ({
        expressions: s.expressions,
        xVar: s.xVar,
        vars: s.vars,
        ranges: s.ranges,
        viewport: s.viewport,
        analysis: s.analysis,
        recent: s.recent,
        savedId: s.savedId,
        savedTitle: s.savedTitle,
      }),
    },
  ),
)
