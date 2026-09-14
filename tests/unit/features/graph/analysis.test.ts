import { describe, it, expect } from 'vitest'
import {
  compileExpression,
  findRoots,
  findExtrema,
  findIntersections,
  analyzeCurves,
} from '../../../../src/features/graph/lib/math'

const fnOf = (expr: string) => compileExpression(expr).fn

describe('grafik: ildizlar', () => {
  it('x^2 - 4 → [-2, 2]', () => {
    const roots = findRoots(fnOf('x^2 - 4'), {}, 'x', -5, 5)
    expect(roots).toHaveLength(2)
    expect(roots[0]).toBeCloseTo(-2, 6)
    expect(roots[1]).toBeCloseTo(2, 6)
  })

  it('sin(x) → 0, ±π (diapazonda)', () => {
    const roots = findRoots(fnOf('sin(x)'), {}, 'x', -4, 4)
    const rounded = roots.map((r) => Number(r.toFixed(3)))
    expect(rounded).toContain(0)
    expect(rounded.some((r) => Math.abs(r - Math.PI) < 0.01)).toBe(true)
    expect(rounded.some((r) => Math.abs(r + Math.PI) < 0.01)).toBe(true)
  })

  it('x^2 — tegib o‘tuvchi ildiz (0)', () => {
    const roots = findRoots(fnOf('x^2'), {}, 'x', -3, 3)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toBeCloseTo(0, 4)
  })

  it('ildizsiz funksiya', () => {
    expect(findRoots(fnOf('x^2 + 1'), {}, 'x', -5, 5)).toHaveLength(0)
  })

  it('parametrlar hisobga olinadi: x^2 - a', () => {
    const roots = findRoots(fnOf('x^2 - a'), { a: 9 }, 'x', -5, 5)
    expect(roots.map((r) => Number(r.toFixed(2)))).toEqual([-3, 3])
  })
})

describe('grafik: ekstremumlar', () => {
  it('x^3 - 3x → max -1, min 1', () => {
    const ext = findExtrema(fnOf('x^3 - 3*x'), {}, 'x', -4, 4)
    const max = ext.find((e) => e.kind === 'max')
    const min = ext.find((e) => e.kind === 'min')
    expect(max?.x).toBeCloseTo(-1, 4)
    expect(min?.x).toBeCloseTo(1, 4)
  })

  it('parabola x^2 → min 0', () => {
    const ext = findExtrema(fnOf('x^2'), {}, 'x', -5, 5)
    expect(ext).toHaveLength(1)
    expect(ext[0].kind).toBe('min')
    expect(ext[0].x).toBeCloseTo(0, 4)
  })

  it('sin(x) → ±1 ekstremumlari', () => {
    const ext = findExtrema(fnOf('sin(x)'), {}, 'x', -2, 2)
    const max = ext.find((e) => e.kind === 'max')
    expect(max?.x).toBeCloseTo(Math.PI / 2, 3)
  })
})

describe('grafik: kesishmalar', () => {
  it('sin(x) va cos(x) → π/4, -3π/4 (diapazon)', () => {
    const xs = findIntersections(fnOf('sin(x)'), fnOf('cos(x)'), {}, 'x', -3, 3)
    const hasPi4 = xs.some((x) => Math.abs(x - Math.PI / 4) < 0.01)
    expect(hasPi4).toBe(true)
  })

  it('parallel chiziqlar kesishmaydi', () => {
    const xs = findIntersections(fnOf('x + 1'), fnOf('x + 2'), {}, 'x', -5, 5)
    expect(xs).toHaveLength(0)
  })
})

describe('grafik: analyzeCurves', () => {
  it('markerlar turi bo‘yicha to‘planadi', () => {
    const markers = analyzeCurves(
      [
        { id: 'a', fn: fnOf('x^2 - 1') },
        { id: 'b', fn: fnOf('x') },
      ],
      {},
      'x',
      -3,
      3,
    )
    expect(markers.some((m) => m.kind === 'root')).toBe(true)
    expect(markers.some((m) => m.kind === 'extrema')).toBe(true)
    expect(markers.some((m) => m.kind === 'cross')).toBe(true)
  })
})
