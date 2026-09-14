import { describe, it, expect } from 'vitest'
import {
  compileExpression,
  parseExpression,
  normalizeExpression,
  normalizeWithMap,
  mapNormalizedPosition,
  tokenize,
  ExprError,
} from '../../../../src/features/graph/lib/math'

function evalAt(expr: string, scope: Record<string, number> = {}): number {
  const { fn } = compileExpression(expr)
  return fn(scope)
}

describe('grafik: normalizeExpression', () => {
  it('Unicode belgilarni ASCII ga aylantiradi', () => {
    expect(normalizeExpression('2π')).toBe('2pi ')
    expect(normalizeExpression('x²')).toBe('x^2')
    expect(normalizeExpression('√x')).toBe('sqrt x')
    expect(normalizeExpression('2×3−1')).toBe('2*3-1')
    expect(normalizeExpression('Sin(X)')).toBe('sin(x)')
    expect(normalizeExpression('θ')).toBe('theta')
  })
})

describe('grafik: parser va compiler', () => {
  it('ustunlik: -x^2 = -(x²)', () => {
    expect(evalAt('-x^2', { x: 3 })).toBe(-9)
  })

  it("o'ng assotsiativ daraja: 2^3^2 = 2^(3^2)", () => {
    expect(evalAt('2^3^2')).toBe(512)
  })

  it('yopiq ko‘paytirish: 2x^2 = 2·(x²)', () => {
    expect(evalAt('2x^2', { x: 3 })).toBe(18)
  })

  it('yopiq ko‘paytirish: (x+1)(x-1), (x+1)2, x(x+1)', () => {
    expect(evalAt('(x+1)(x-1)', { x: 3 })).toBe(8)
    expect(evalAt('(x+1)2', { x: 2 })).toBe(6)
    expect(evalAt('x(x+1)', { x: 2 })).toBe(6)
  })

  it('yopiq ko‘paytirish: 3sin(pi/2) va 2pi', () => {
    expect(evalAt('3sin(pi/2)')).toBeCloseTo(3, 10)
    expect(evalAt('2pi')).toBeCloseTo(2 * Math.PI, 10)
    expect(evalAt('2π')).toBeCloseTo(2 * Math.PI, 10)
  })

  it('qavssiz funksiya: sin x, √x, ln e', () => {
    expect(evalAt('sin x', { x: Math.PI / 2 })).toBeCloseTo(1, 10)
    expect(evalAt('√x', { x: 9 })).toBe(3)
    expect(evalAt('ln e')).toBe(1)
  })

  it('funksiyalar: log/log2/cbrt/abs/floor/mod/pow/min/max', () => {
    expect(evalAt('log(100)')).toBe(2)
    expect(evalAt('log2(8)')).toBe(3)
    expect(evalAt('cbrt(27)')).toBe(3)
    expect(evalAt('abs(-4)')).toBe(4)
    expect(evalAt('floor(2.9)')).toBe(2)
    expect(evalAt('mod(7, 3)')).toBe(1)
    expect(evalAt('pow(2, 10)')).toBe(1024)
    expect(evalAt('min(3, 1, 2)')).toBe(1)
    expect(evalAt('max(3, 1, 2)')).toBe(3)
  })

  it('erkin o‘zgaruvchilar tartibi va konstantalar ajratilishi', () => {
    expect(parseExpression('v0 + a*t').vars).toEqual(['v0', 'a', 't'])
    expect(parseExpression('sin(x) + cos(x)').vars).toEqual(['x'])
    expect(parseExpression('pi*x + e').vars).toEqual(['x'])
    expect(parseExpression('sqrt(x)').vars).toEqual(['x'])
  })

  it('murakkab ifoda to‘g‘ri hisoblanadi', () => {
    expect(evalAt('(a*t^2)/2 + v0*t', { a: 2, t: 4, v0: 3 })).toBe(28)
  })
})

describe('grafik: xatolar', () => {
  it('bo‘sh ifoda', () => {
    expect(() => parseExpression('   ')).toThrowError(ExprError)
    try { parseExpression('') } catch (e) {
      expect((e as ExprError).code).toBe('empty')
    }
  })

  it('tugallanmagan ifoda', () => {
    try { parseExpression('2+') } catch (e) {
      expect((e as ExprError).code).toBe('unexpected_end')
    }
  })

  it('kutilmagan token', () => {
    try { parseExpression('2+*3') } catch (e) {
      expect((e as ExprError).code).toBe('unexpected_token')
    }
    try { parseExpression('2 @ 3') } catch (e) {
      expect((e as ExprError).code).toBe('unexpected_token')
    }
  })

  it('argumentlar soni noto‘g‘ri', () => {
    try { parseExpression('sin()') } catch (e) {
      expect((e as ExprError).code).toBe('arity')
    }
    try { parseExpression('min(1)') } catch (e) {
      expect((e as ExprError).code).toBe('arity')
    }
  })

  it('juda chuqur qavslar — too_complex', () => {
    const expr = '('.repeat(90) + 'x' + ')'.repeat(90)
    try { parseExpression(expr) } catch (e) {
      expect((e as ExprError).code).toBe('too_complex')
    }
  })

  it('juda uzun ifoda — too_long', () => {
    try { tokenize('1+'.repeat(150) + '1') } catch (e) {
      expect((e as ExprError).code).toBe('too_long')
    }
  })
})

describe('grafik: pozitsiya xaritasi (normalize)', () => {
  it('normalizeWithMap matn va xaritani beradi', () => {
    const { text, positions } = normalizeWithMap('x² + @')
    expect(text).toBe('x^2 + @')
    expect(positions).toHaveLength(text.length)
    // '@' ASL matnda 5-indeksda
    const atPos = text.indexOf('@')
    expect(positions[atPos]).toBe(5)
  })

  it('√ va π kabi ko‘p belgili almashtirishlarda pozitsiya saqlanadi', () => {
    const { text } = normalizeWithMap('2√x')
    expect(text).toBe('2sqrt x')
    expect(mapNormalizedPosition('2√x', 6)).toBe(2)
  })

  it('mapNormalizedPosition chegaradan oshsa — input uzunligi', () => {
    expect(mapNormalizedPosition('x', 999)).toBe(1)
  })

  it('`**` → `^` (pozitsiya birinchi yulduzdan)', () => {
    const { text, positions } = normalizeWithMap('x**2')
    expect(text).toBe('x^2')
    expect(positions[1]).toBe(1)
  })

  it('parser xatosi pozitsiyasini ASL matnga qaytarish mumkin', () => {
    const input = 'x² + *'
    try {
      parseExpression(input)
      throw new Error('should throw')
    } catch (e) {
      const err = e as ExprError
      expect(err.code).toBe('unexpected_token')
      const originalPos = mapNormalizedPosition(input, err.pos)
      expect(input.slice(originalPos, originalPos + 1)).toBe('*')
    }
  })
})
