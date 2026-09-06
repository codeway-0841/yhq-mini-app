import { describe, expect, it } from 'vitest'
import {
  evaluateExpression,
  formatCalculatorNumber,
} from '../../../src/features/test/components/calculator-eval'

describe('calculator-eval', () => {
  it('evaluates basic arithmetic correctly', () => {
    expect(evaluateExpression('2 + 3')).toBe(5)
    expect(evaluateExpression('10 - 4')).toBe(6)
    expect(evaluateExpression('3 × 4')).toBe(12)
    expect(evaluateExpression('15 ÷ 3')).toBe(5)
  })

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14)
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20)
    expect(evaluateExpression('10 - 2 * 3 + 4 / 2')).toBe(6)
  })

  it('evaluates power operations', () => {
    expect(evaluateExpression('2 ^ 3')).toBe(8)
    expect(evaluateExpression('3 ^ 2 + 4 ^ 2')).toBe(25)
  })

  it('handles negative numbers', () => {
    expect(evaluateExpression('-5 + 10')).toBe(5)
    expect(evaluateExpression('10 + -3')).toBe(7)
  })

  it('handles floating point calculations and formats cleanly', () => {
    const result = evaluateExpression('0.1 + 0.2')
    expect(formatCalculatorNumber(result)).toBe('0.3')
    expect(formatCalculatorNumber(10 / 3)).toBe('3.33333333333')
  })

  it('throws on division by zero', () => {
    expect(() => evaluateExpression('10 / 0')).toThrow('Division by zero')
  })
})
