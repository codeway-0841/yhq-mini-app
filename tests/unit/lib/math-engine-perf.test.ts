/**
 * Math Board — engine p95 benchmark (Faza 7 polish).
 *
 * Byudjet (v2): lokal check p95 <50ms (debounce 180ms bilan total <300ms).
 * Namuna: spike kategoriyalaridan reprezentativ qadamlar (algebra/kasr/
 * ildiz/daraja/logarifm). Har bir check <100ms (CI flake zaxirasi bilan),
 * p95 <50ms — spetsifikatsiya byudjeti.
 */
import { describe, it, expect } from 'vitest'
import { checkStep, type Problem } from '../../../src/shared/math-engine'

const PROB: Problem = { id: 'perf', promptLatex: 'x', assumptions: [], goal: 'solve' }

const PAIRS: [string, string][] = [
  ['x+1', '1+x'],
  ['2+2', '4'],
  ['log(2,32)', '5'],
  ['log(2,32)', 'log(2,32)=5'],
  ['x=1', 'x+1=2'],
  ['x=1', 'x^2=1'],
  ['(1)/(2)+(1)/(4)', '(3)/(4)'],
  ['sqrt(49)', '7'],
  ['2^10', '1024'],
  ['x^2-1', '(x-1)*(x+1)'],
  ['log(2,8)+log(2,4)', '5'],
  ['(x+1)/(x-1)=2', '(x+1)=2*(x-1)'],
  ['sqrt(x^2+1)', 'sqrt(1+x^2)'],
  ['2^(x+1)', '2*2^x'],
  ['log(3,81)=4', '4=log(3,81)'],
  ['0.5*x+0.5*x', 'x'],
  ['((1)/(2))/((3)/(4))', '(2)/(3)'],
  ['cbrt(27)+sqrt(16)', '7'],
  ['x^3+2*x', 'x*(x^2+2)'],
  ['ln(exp(2))', '2'],
]

describe('math-engine p95 (total <300ms byudjet)', () => {
  it('har bir check <100ms, p95 <50ms', () => {
    const dts: number[] = []
    for (const [prev, cand] of PAIRS) {
      const t0 = performance.now()
      const r = checkStep({ problem: PROB, previousAcceptedStep: prev, candidateStep: cand })
      const dt = performance.now() - t0
      dts.push(dt)
      expect(dt, `${prev} → ${cand}`).toBeLessThan(100)
      expect(r.status).not.toBe('unknown')
    }
    dts.sort((a, b) => a - b)
    const p95 = dts[Math.min(dts.length - 1, Math.floor(0.95 * dts.length))]
    expect(p95).toBeLessThan(50)
  })
})
