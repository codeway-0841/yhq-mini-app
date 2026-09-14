import { describe, it, expect } from 'vitest'
import { GRAPH_PRESETS, presetsBySubject } from '../../../../src/content/graph-presets'
import { compileExpression } from '../../../../src/features/graph/lib/math'

describe('grafik: presetlar', () => {
  it('kamida 2 fan va 12 ta preset bor', () => {
    expect(presetsBySubject('matematika').length).toBeGreaterThanOrEqual(8)
    expect(presetsBySubject('fizika').length).toBeGreaterThanOrEqual(8)
  })

  it('har bir preset ifodasi kompilyatsiya bo‘ladi', () => {
    for (const p of GRAPH_PRESETS) {
      const { vars } = compileExpression(p.expr)
      if (Object.keys(p.vars).length > 0) {
        for (const name of Object.keys(p.vars)) {
          expect(vars, `preset ${p.id}: ${name} ifodada yo'q`).toContain(name)
        }
      }
      expect(vars, `preset ${p.id}: xVar '${p.xVar}' ifodada yo'q`).toContain(p.xVar)
    }
  })

  it('slayder oraliqlari to‘g‘ri (min < value < max, step > 0)', () => {
    for (const p of GRAPH_PRESETS) {
      for (const [name, cfg] of Object.entries(p.vars)) {
        expect(cfg.min, `${p.id}.${name}`).toBeLessThan(cfg.max)
        expect(cfg.value, `${p.id}.${name}`).toBeGreaterThanOrEqual(cfg.min)
        expect(cfg.value, `${p.id}.${name}`).toBeLessThanOrEqual(cfg.max)
        expect(cfg.step, `${p.id}.${name}`).toBeGreaterThan(0)
      }
    }
  })

  it('id lar unikal', () => {
    const ids = GRAPH_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
