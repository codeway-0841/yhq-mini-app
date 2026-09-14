/**
 * Grafik quruvchi — workspace store (persist: 'yhq-graph').
 *
 * Server'ga yuboriladigan payload — faqat `expressions/xVar/vars/viewport`
 * (shared/contracts/graph.ts). `ranges` UI holati: slayder oraliqlari
 * (preset'dan keladi, serverga saqlanmaydi).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GraphExpression, GraphPayload, GraphViewport } from '../../../shared/contracts/graph'
import { GRAPH_MAX_EXPRESSIONS } from '../../../shared/contracts/graph'
import { DEFAULT_VIEWPORT } from './lib/plot/viewport'
import type { GraphPreset } from '../../content/graph-presets'

export interface GraphRange {
  min: number
  max: number
  step: number
}

const CURVE_COLOR_COUNT = 6

const makeId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export function defaultRange(name: string): GraphRange {
  switch (name) {
    case 't':  return { min: 0, max: 10, step: 0.1 }
    case 'v0': return { min: -20, max: 20, step: 1 }
    case 'g':  return { min: 0, max: 20, step: 0.01 }
    default:   return { min: -10, max: 10, step: 0.1 }
  }
}

type StoredExpression = GraphExpression & { id: string }

export type { StoredExpression }

function defaultExpressions(): StoredExpression[] {
  return [{ expr: 'sin(x)', colorIdx: 0, visible: true, id: makeId() }]
}

interface GraphState {
  expressions: StoredExpression[]
  xVar: string
  vars: Record<string, number>
  ranges: Record<string, GraphRange>
  viewport: GraphViewport
  savedId: string | null
  savedTitle: string | null

  addExpression: (text?: string) => void
  updateExpression: (id: string, patch: { expr?: string; visible?: boolean }) => void
  removeExpression: (id: string) => void
  cycleColor: (id: string) => void
  setXVar: (name: string) => void
  setVar: (name: string, value: number) => void
  ensureVars: (names: string[]) => void
  setViewport: (vp: GraphViewport) => void
  resetViewport: () => void
  applyPreset: (preset: GraphPreset) => void
  loadWorkspace: (payload: GraphPayload, meta: { id: string; title: string } | null) => void
  markSaved: (id: string, title: string) => void
  markUnsaved: () => void
  reset: () => void
  toPayload: () => GraphPayload
}

const initial = {
  expressions: defaultExpressions(),
  xVar: 'x',
  vars: {} as Record<string, number>,
  ranges: {} as Record<string, GraphRange>,
  viewport: DEFAULT_VIEWPORT,
  savedId: null as string | null,
  savedTitle: null as string | null,
}

export const useGraphStore = create<GraphState>()(
  persist(
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
          savedId: meta?.id ?? null,
          savedTitle: meta?.title ?? null,
        })
      },

      markSaved: (id, title) => set({ savedId: id, savedTitle: title }),
      markUnsaved: () => set({ savedId: null, savedTitle: null }),

      reset: () => set({ ...initial, expressions: defaultExpressions() }),

      toPayload: () => {
        const { expressions, xVar, vars, viewport } = get()
        return {
          expressions: expressions.map(({ expr, colorIdx, visible }) => ({ expr, colorIdx, visible })),
          xVar,
          vars: { ...vars },
          viewport: { ...viewport },
        }
      },
    }),
    {
      name: 'yhq-graph',
      version: 1,
      partialize: (s) => ({
        expressions: s.expressions,
        xVar: s.xVar,
        vars: s.vars,
        ranges: s.ranges,
        viewport: s.viewport,
        savedId: s.savedId,
        savedTitle: s.savedTitle,
      }),
    },
  ),
)
