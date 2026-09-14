import { describe, it, expect } from 'vitest'
import {
  compileExpression,
  derivativeAt,
  makeDerivative,
  integrate,
  riemann,
} from '../../../../src/features/graph/lib/math'

const fnOf = (expr: string) => compileExpression(expr).fn

describe('grafik: hosila (5-nuqtali stencil)', () => {
  it("x^2 hosilasi x=3 da 6", () => {
    expect(derivativeAt(fnOf('x^2'), {}, 'x', 3)).toBeCloseTo(6, 4)
  })

  it('sin(x) hosilasi x=0 da 1, x=pi/2 da 0', () => {
    expect(derivativeAt(fnOf('sin(x)'), {}, 'x', 0)).toBeCloseTo(1, 4)
    expect(derivativeAt(fnOf('sin(x)'), {}, 'x', Math.PI / 2)).toBeCloseTo(0, 4)
  })

  it('parametrlar scope orqali: (a*x^2)′ = 2ax', () => {
    expect(derivativeAt(fnOf('a*x^2'), { a: 3 }, 'x', 2)).toBeCloseTo(12, 4)
  })

  it('uzilishda NaN qaytaradi', () => {
    expect(Number.isNaN(derivativeAt(fnOf('sqrt(x)'), {}, 'x', -1))).toBe(true)
  })

  it('makeDerivative sampling closure sifatida ishlaydi', () => {
    const d = makeDerivative(fnOf('x^3'), 'x')
    expect(d({ x: 2 })).toBeCloseTo(12, 4)
    expect(d({ x: 2, a: 5 })).toBeCloseTo(12, 4)
  })
})

describe('grafik: integral (adaptiv Simpson)', () => {
  it('∫₀³ x² dx = 9', () => {
    expect(integrate(fnOf('x^2'), {}, 'x', 0, 3)).toBeCloseTo(9, 6)
  })

  it('∫₀^π sin(x) dx = 2', () => {
    expect(integrate(fnOf('sin(x)'), {}, 'x', 0, Math.PI)).toBeCloseTo(2, 6)
  })

  it('teskari chegaralar manfiy belgi beradi', () => {
    expect(integrate(fnOf('x^2'), {}, 'x', 3, 0)).toBeCloseTo(-9, 6)
  })

  it('a = b da 0', () => {
    expect(integrate(fnOf('x^2'), {}, 'x', 2, 2)).toBe(0)
  })

  it("parametrli integral: ∫₀¹ a*x dx = a/2", () => {
    expect(integrate(fnOf('a*x'), { a: 4 }, 'x', 0, 1)).toBeCloseTo(2, 6)
  })

  it('uzilishda NaN', () => {
    expect(Number.isNaN(integrate(fnOf('sqrt(x)'), {}, 'x', -1, 1))).toBe(true)
  })
})

describe('grafik: Riemann yig‘indisi', () => {
  it('∫₀¹ x² ni 1000 to‘rtburchakda ~1/3', () => {
    const { sum } = riemann(fnOf('x^2'), {}, 'x', 0, 1, 1000)
    expect(sum).toBeCloseTo(1 / 3, 3)
  })

  it("to'rtburchaklar geometriyasi to'g'ri", () => {
    const { rects } = riemann(fnOf('x'), {}, 'x', 0, 4, 4)
    expect(rects).toHaveLength(4)
    expect(rects[0].width).toBeCloseTo(1, 10)
    expect(rects[1].x).toBeCloseTo(1, 10)
    expect(rects[1].height).toBeCloseTo(1.5, 10)
  })

  it('teskari chegarada manfiy', () => {
    const { sum } = riemann(fnOf('x'), {}, 'x', 1, 0, 100)
    expect(sum).toBeCloseTo(-0.5, 2)
  })
})
