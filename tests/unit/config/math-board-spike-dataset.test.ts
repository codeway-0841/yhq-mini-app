/**
 * Math Board dataset integrity: 5 kategoriya qamrovi (algebra, fraction, root, power, logarithm),
 * id unikal, HAMMA promptAscii engine'da parse bo'ladi (ground truth yaroqli).
 */
import { describe, it, expect } from 'vitest'
import { parseStep } from '../../../src/shared/math-engine'
import { BOARD_PROBLEMS } from '../../../src/features/math-board/lib/problems'

describe('math-board dataset integrity', () => {
  it('5 kategoriya qamrovi mavjud', () => {
    const categories = new Set(BOARD_PROBLEMS.map((it) => it.category))
    expect(categories).toEqual(new Set(['algebra', 'fraction', 'root', 'power', 'logarithm']))
  })

  it('id unikal, maydonlar to‘liq', () => {
    const ids = new Set(BOARD_PROBLEMS.map((i) => i.problem.id))
    expect(ids.size).toBe(BOARD_PROBLEMS.length)
    for (const it of BOARD_PROBLEMS) {
      expect(it.promptAscii.trim().length).toBeGreaterThan(0)
      expect(it.displayLatex.trim().length).toBeGreaterThan(0)
      expect(it.finalAnswer.trim().length).toBeGreaterThan(0)
    }
  })

  it('hamma ascii ground truth engine parse qiladi', () => {
    const bad: string[] = []
    for (const it of BOARD_PROBLEMS) {
      try {
        parseStep(it.promptAscii)
      } catch {
        bad.push(`${it.problem.id}: ${it.promptAscii}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
