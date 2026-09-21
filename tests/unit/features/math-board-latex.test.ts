/**
 * Math Board — LaTeX→ASCII konvertor golden testlari (Faza 3).
 *
 * MathLive yozuvi → engine grammatikasi. Har bir toifa (kasr/ildiz/daraja/
 * logarifm) qamralgan; round-trip: ascii engine'da parse bo'lishi shart.
 */
import { describe, it, expect } from 'vitest'
import { latexToAscii } from '../../../src/features/math-board/lib/latex-to-ascii'
import { parseStep } from '../../../src/shared/math-engine'

const CASES: [string, string][] = [
  ['\\frac{1}{2}', '(1)/(2)'],
  ['\\frac{1}{2}+\\frac{1}{4}', '(1)/(2)+(1)/(4)'],
  ['\\frac{\\frac{1}{2}}{3}', '((1)/(2))/(3)'],
  ['\\sqrt{9}', 'sqrt(9)'],
  ['\\sqrt[3]{8}', '(8)^(1/(3))'],
  ['2^{10}', '2^(10)'],
  ['x^2', 'x^2'],
  ['\\log_2\\left(32\\right)', 'log(2,32)'],
  ['\\log_{10}(100)', 'log(10,100)'],
  // P2: qavssiz argument to'liq o'qiladi
  ['\\log_{2}32', 'log(2,32)'],
  ['\\log_2x+1', 'log(2,x)+1'],
  // P2: MathLive function buyruqlari
  ['\\sin(x)', 'sin(x)'],
  ['\\sin x+1', 'sin(x)+1'],
  ['\\cos(2x)', 'cos(2x)'],
  ['\\ln e+1', 'ln(e)+1'],
  ['\\tan(x)^2', 'tan(x)^2'],
  ['\\ln{e^2}', 'ln(e^2)'],
  ['\\log{100}', 'log(100)'],
  ['\\log(100)', 'log(100)'],
  // P2-F: qavssiz argument bog'lanadi (sin(2)*x emas, sin(2x))
  ['\\sin 2x', 'sin(2x)'],
  ['\\cos 3y+1', 'cos(3y)+1'],
  ['\\ln(e)', 'ln(e)'],
  ['\\lg(1000)', 'lg(1000)'],
  ['2\\cdot x', '2*x'],
  ['\\pi', 'pi'],
  ['\\left(x+1\\right)', '(x+1)'],
]

describe('latexToAscii golden', () => {
  for (const [latex, expected] of CASES) {
    it(`${latex} → ${expected}`, () => {
      expect(latexToAscii(latex)).toBe(expected)
    })
  }

  it("hamma natija engine'da parse bo'ladi (round-trip)", () => {
    for (const [latex] of CASES) {
      const ascii = latexToAscii(latex)
      expect(() => parseStep(ascii), `${latex} → ${ascii}`).not.toThrow()
    }
  })

  it("bo'sh kiritish bo'sh qaytaradi", () => {
    expect(latexToAscii('')).toBe('')
  })
})
