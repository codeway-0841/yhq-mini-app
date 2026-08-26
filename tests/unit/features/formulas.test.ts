import { describe, it, expect } from 'vitest'
import { FORMULA_SUBJECTS, formulaCount } from '../../../src/content/formulas'

describe('content/formulas — data integrity & localization', () => {
  it('barcha fanlar bo‘yicha mavzular va formulalar mavjud', () => {
    expect(FORMULA_SUBJECTS.length).toBe(5)
    for (const sub of FORMULA_SUBJECTS) {
      expect(sub.topics.length).toBeGreaterThan(0)
      expect(formulaCount(sub)).toBeGreaterThan(0)
    }
  })

  it('barcha formulalar unikal id va to‘liq UZ + RU nomlarga ega', () => {
    const allIds: string[] = []
    for (const sub of FORMULA_SUBJECTS) {
      for (const topic of sub.topics) {
        expect(topic.name.trim()).not.toBe('')
        expect(topic.nameRu.trim()).not.toBe('')

        for (const formula of topic.formulas) {
          allIds.push(formula.id)
          expect(formula.title.trim()).not.toBe('')
          expect(formula.titleRu.trim()).not.toBe('')
          expect(formula.formula.trim()).not.toBe('')

          if (formula.note) {
            expect(formula.note.trim()).not.toBe('')
          }
          if (formula.noteRu) {
            expect(formula.noteRu.trim()).not.toBe('')
          }
        }
      }
    }
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})
