import { describe, it, expect } from 'vitest'
import {
  parseGraphExpression,
  axisVarsOf,
  graphExpressionToLatex,
} from '../../../../src/features/graph/lib/math'

describe('grafik: ifoda rejimini aniqlash', () => {
  it('oddiy funksiya → y', () => {
    const p = parseGraphExpression('sin(x)')
    expect(p.kind).toBe('y')
    if (p.kind === 'y') expect(p.fn({ x: Math.PI / 2 })).toBeCloseTo(1, 8)
    expect(p.vars).toEqual(['x'])
  })

  it('y = ... (LHS tashlanadi)', () => {
    const p = parseGraphExpression('y = v0 + a*t')
    expect(p.kind).toBe('y')
    expect(p.vars).toEqual(['v0', 'a', 't'])
  })

  it('f(x) = ... ham y sifatida', () => {
    expect(parseGraphExpression('f(x) = x^2').kind).toBe('y')
  })

  it('r = ... → polyar', () => {
    const p = parseGraphExpression('r = 2*sin(3*theta)')
    expect(p.kind).toBe('polar')
    if (p.kind === 'polar') {
      expect(p.angleVar).toBe('theta')
      expect(p.fn({ theta: Math.PI / 6 })).toBeCloseTo(2 * Math.sin(Math.PI / 2), 8)
    }
  })

  it('x=cos(t); y=sin(t) → parametrik', () => {
    const p = parseGraphExpression('x=cos(t); y=sin(t)')
    expect(p.kind).toBe('parametric')
    if (p.kind === 'parametric') {
      expect(p.paramVar).toBe('t')
      expect(p.xFn({ t: 0 })).toBeCloseTo(1, 8)
      expect(p.yFn({ t: Math.PI / 2 })).toBeCloseTo(1, 8)
    }
  })

  it('x^2 + y^2 = 1 → implicit kontur', () => {
    const p = parseGraphExpression('x^2 + y^2 = 1')
    expect(p.kind).toBe('implicit')
    if (p.kind === 'implicit') {
      expect(p.relation).toBe('=')
      expect(p.fn({ x: 1, y: 0 })).toBeCloseTo(0, 8)
      expect(p.fn({ x: 0, y: 0 })).toBeCloseTo(-1, 8)
    }
  })

  it('x^2 + y^2 < 1 → tengsizlik', () => {
    const p = parseGraphExpression('x^2 + y^2 < 1')
    expect(p.kind).toBe('implicit')
    if (p.kind === 'implicit') expect(p.relation).toBe('<')
  })

  it('parametrlar saqlanadi (implicit)', () => {
    const p = parseGraphExpression('a*x^2 + y^2 = 1')
    expect(p.vars).toEqual(['a', 'x', 'y'])
  })

  it('xatolar', () => {
    expect(() => parseGraphExpression('')).toThrow()
    expect(() => parseGraphExpression('2 +')).toThrow()
    expect(() => parseGraphExpression('x=1; z=2')).toThrow()
  })
})

describe('grafik: axisVarsOf', () => {
  it('implicit → x va y', () => {
    expect(axisVarsOf(parseGraphExpression('x^2+y^2=1'))).toEqual(['x', 'y'])
  })

  it('polyar → burchak o‘zgaruvchisi', () => {
    expect(axisVarsOf(parseGraphExpression('r=theta'))).toEqual(['theta'])
  })

  it('y → bo‘sh (X o‘qi foydalanuvchi tanlaydi)', () => {
    expect(axisVarsOf(parseGraphExpression('sin(x)'))).toEqual([])
  })
})

describe('grafik: graphExpressionToLatex', () => {
  it('tenglik va tengsizlik', () => {
    expect(graphExpressionToLatex('y = sin(x)')).toBe('y = \\sin\\left(x\\right)')
    expect(graphExpressionToLatex('x^2+y^2 <= 1')).toContain('\\le')
  })

  it('parametrik ikki qism', () => {
    const tex = graphExpressionToLatex('x=cos(t); y=sin(t)')
    expect(tex).toContain(',\\quad')
    expect(tex).toContain('\\cos')
  })

  it('xato bo‘lsa null', () => {
    expect(graphExpressionToLatex('2 +')).toBeNull()
  })
})
