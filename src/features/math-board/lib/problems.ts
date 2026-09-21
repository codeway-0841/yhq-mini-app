/**
 * Math Board — starter masalalar katalogi (Faza 3).
 *
 * Engine ASCII prompt (`promptAscii`) + chiroyli KaTeX ko'rinish
 * (`displayLatex`, MathLive yozuvi) + `finalAnswer` (yakuniy javob detekti).
 * Kategoriya balansi spike dataset'ga mos: algebra/kasr/ildiz/daraja/logarifm.
 */

import type { Problem } from '../../../shared/math-engine'
import type { RecognitionCategory } from '../recognition/types'

export interface BoardProblem {
  problem: Problem
  /** Engine'ga uzatiladigan ASCII prompt (ground truth) */
  promptAscii: string
  /** Ekranda ko'rinadigan LaTeX (KaTeX render) */
  displayLatex: string
  /** Yakuniy javob (ASCII, masalan '5') */
  finalAnswer: string
  category: RecognitionCategory
  /** Yechiladigan o'zgaruvchi (P0-B strict solved) */
  targetVariable: string
}

function p(
  id: string,
  promptAscii: string,
  displayLatex: string,
  finalAnswer: string,
  category: RecognitionCategory,
  targetVariable = 'x',
): BoardProblem {
  return {
    problem: { id, promptLatex: displayLatex, assumptions: [], goal: 'solve' },
    promptAscii,
    displayLatex,
    finalAnswer,
    category,
    targetVariable,
  }
}

export const BOARD_PROBLEMS: BoardProblem[] = [
  p('log-1', 'log(2,32)', '\\log_2(32)', '5', 'logarithm'),
  p('log-2', 'log(3,81)', '\\log_3(81)', '4', 'logarithm'),
  p('log-3', 'log(5,125)', '\\log_5(125)', '3', 'logarithm'),
  p('log-4', 'lg(1000)', '\\lg(1000)', '3', 'logarithm'),
  p('log-5', 'ln(exp(2))', '\\ln(e^2)', '2', 'logarithm'),
  p('pow-1', '2^10', '2^{10}', '1024', 'power'),
  p('frac-1', '(1)/(2)+(1)/(4)', '\\frac{1}{2}+\\frac{1}{4}', '(3)/(4)', 'fraction'),
  p('root-1', 'sqrt(49)', '\\sqrt{49}', '7', 'root'),
  // P2: algebra starter haqiqiy tenglama+yechim (ifoda-goal hozircha yo'q):
  // 2x+3=11 → 2x=8 (ratio 1) → x=4 (ratio 1/2) → solved.
  p('alg-1', '2*x+3=11', '2x+3=11', '4', 'algebra'),
  // Murakkab tenglamalar (har biri engine'da to'liq oqim verifikatsiyadan o'tgan):
  p('eq-1', '3*(x+2)-5=16', '3(x+2)-5=16', '5', 'algebra'),
  p('eq-2', '(x+3)/2-(x-1)/3=2', '\\frac{x+3}{2}-\\frac{x-1}{3}=2', '1', 'algebra'),
  p('eq-3', '4*x-7=2*x+5', '4x-7=2x+5', '6', 'algebra'),
  p('eq-4', '(5*x-3)/4=3', '\\frac{5x-3}{4}=3', '3', 'fraction'),
  p('eq-5', '10-2*(x+1)=4', '10-2(x+1)=4', '2', 'algebra'),
  p('eq-6', '7*(2*x-1)=35', '7(2x-1)=35', '3', 'algebra'),
  p('eq-7', '0.5*x+1.5=4', '0.5x+1.5=4', '5', 'algebra'),
  // Murakkab ifoda-hisoblash (qiymat-e'lon oqimi):
  p('log-6', 'log(2,8)+log(2,4)', '\\log_2(8)+\\log_2(4)', '5', 'logarithm'),
  p('log-7', 'log(2,sqrt(256))', '\\log_2(\\sqrt{256})', '4', 'logarithm'),
  p('root-2', 'sqrt(16)+cbrt(27)', '\\sqrt{16}+\\sqrt[3]{27}', '7', 'root'),
]

export function boardProblemById(id: string): BoardProblem {
  return BOARD_PROBLEMS.find((b) => b.problem.id === id) ?? BOARD_PROBLEMS[0]
}
