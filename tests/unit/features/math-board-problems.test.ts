/**
 * Math Board — katalog oqim testlari (P0-E table-driven).
 *
 * Har bir masala: prompt → oraliq qadamlar → final, HAMMASI `correct`
 * (P0-A: canAccept faqat isbotlangan correct) va oxirgi qadam solved.
 * Yangi masala = jadvalga 1 qator. Jadvaldan tashqarida individual
 * oqim testi yozish TAQIQLANADI (desync).
 */
import { describe, it, expect } from 'vitest'
import { checkStep } from '../../../src/shared/math-engine'
import { renderKaTeXToString } from '../../../src/shared/components/MathText'
import { isSolvedStep } from '../../../src/features/math-board/lib/solve'
import { BOARD_PROBLEMS, boardProblemById } from '../../../src/features/math-board/lib/problems'

/** [problemId, accepted steps (oxirgisi solved)] */
const FLOWS: [string, string[]][] = [
  ['log-1', ['log(2,32)=5']],
  ['log-2', ['log(3,81)=4']],
  ['log-3', ['log(5,125)=3']],
  ['log-4', ['lg(1000)=3']],
  ['log-5', ['ln(exp(2))=2']],
  ['log-6', ['log(2,8)+log(2,4)=5']],
  ['log-7', ['log(2,sqrt(256))=4']],
  ['pow-1', ['2^10=1024']],
  ['frac-1', ['(1)/(2)+(1)/(4)=(3)/(4)']],
  ['root-1', ['sqrt(49)=7']],
  ['root-2', ['sqrt(16)+cbrt(27)=7']],
  ['alg-1', ['2*x=8', 'x=4']],
  ['eq-1', ['3*x+6-5=16', '3*x+1=16', '3*x=15', 'x=5']],
  ['eq-2', ['3*(x+3)-2*(x-1)=12', '3*x+9-2*x+2=12', 'x+11=12', 'x=1']],
  ['eq-3', ['4*x-2*x=5+7', '2*x=12', 'x=6']],
  ['eq-4', ['5*x-3=12', '5*x=15', 'x=3']],
  ['eq-5', ['10-2*x-2=4', '8-2*x=4', '-2*x=-4', 'x=2']],
  ['eq-6', ['14*x-7=35', '14*x=42', 'x=3']],
  ['eq-7', ['0.5*x=2.5', 'x=5']],
]

function runFlow(id: string, steps: string[]): void {
  const P = boardProblemById(id)
  let prev = P.promptAscii
  for (const s of steps) {
    const r = checkStep({ problem: P.problem, previousAcceptedStep: prev, candidateStep: s })
    expect(r.status, `${id}: ${prev} → ${s} = ${r.status}/${r.detail}`).toBe('correct')
    prev = s
  }
  expect(isSolvedStep(steps[steps.length - 1], P.finalAnswer, P.targetVariable), `${id} solved`).toBe(true)
}

describe('board problem flows (table-driven)', () => {
  it('jadval katalog bilan sinxron (19 id, har biri 1 marta)', () => {
    const catalogIds = BOARD_PROBLEMS.map((b) => b.problem.id).sort()
    const tableIds = FLOWS.map(([id]) => id).sort()
    expect(tableIds).toEqual(catalogIds)
  })

  for (const [id, steps] of FLOWS) {
    it(`${id}: prompt → steps → solved`, () => {
      runFlow(id, steps)
    })
  }

  it('display latex KaTeX’da render bo‘ladi (chip/ground-truth)', () => {
    const bad: string[] = []
    for (const b of BOARD_PROBLEMS) {
      if (!renderKaTeXToString(b.displayLatex, false)) bad.push(`${b.problem.id}: ${b.displayLatex}`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
