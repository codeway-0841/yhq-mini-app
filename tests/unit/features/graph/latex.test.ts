import { describe, it, expect } from 'vitest'
import { expressionToLatex } from '../../../../src/features/graph/lib/math'

describe('grafik: LaTeX serializatori', () => {
  it('daraja va ko‘paytirish', () => {
    expect(expressionToLatex('x^2')).toBe('{x}^{2}')
    expect(expressionToLatex('2*x')).toBe('2 \\cdot x')
  })

  it('kasr', () => {
    expect(expressionToLatex('(x + 1)/(x - 1)')).toBe('\\frac{x + 1}{x - 1}')
  })

  it('ildiz va modul', () => {
    expect(expressionToLatex('sqrt(x)')).toBe('\\sqrt{x}')
    expect(expressionToLatex('abs(x)')).toBe('\\left|x\\right|')
  })

  it('trigonometriya va eksponenta', () => {
    expect(expressionToLatex('sin(x)')).toBe('\\sin\\left(x\\right)')
    expect(expressionToLatex('exp(x)')).toBe('e^{x}')
    expect(expressionToLatex('ln(x)')).toBe('\\ln\\left(x\\right)')
  })

  it('konstantalar va grek o‘zgaruvchilar', () => {
    expect(expressionToLatex('pi')).toBe('\\pi')
    expect(expressionToLatex('2*pi*x')).toBe('2 \\cdot \\pi \\cdot x')
    expect(expressionToLatex('theta')).toBe('\\theta')
    expect(expressionToLatex('omega*t')).toBe('\\omega \\cdot t')
  })

  it('indeksli o‘zgaruvchilar: v0 → v_{0}', () => {
    expect(expressionToLatex('v0*t')).toBe('v_{0} \\cdot t')
  })

  it('unary minus va qavslar', () => {
    expect(expressionToLatex('-x^2')).toBe('-{x}^{2}')
    expect(expressionToLatex('-(x + 1)')).toBe('-\\left(x + 1\\right)')
  })

  it('xato bo‘lsa null', () => {
    expect(expressionToLatex('2 +')).toBeNull()
    expect(expressionToLatex('')).toBeNull()
  })
})
