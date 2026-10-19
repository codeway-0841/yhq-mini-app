import { describe, expect, it } from 'vitest'
import { darslikCheckHash } from '../../../server/modules/darslik/check-cache'
import { block01Checks } from '../../../server/modules/darslik/curated/block-01'
import type { DarslikCheck } from '../../../shared/darslik-mastery'

const base = block01Checks['1:0']

describe('darslikCheckHash — kesh invalidation fingerprint', () => {
  it('bir xil mazmun uchun barqaror SHA-256 beradi', () => {
    expect(darslikCheckHash(base)).toBe(darslikCheckHash(base))
    expect(darslikCheckHash(base)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('obyekt kalitlari tartibiga bog‘liq emas (kanonik JSON)', () => {
    const questions = base.questions.map((question) => {
      const entries = Object.entries(question).reverse()
      return Object.fromEntries(entries)
    })
    const candidate = { questions, format: base.format } as unknown as DarslikCheck
    // format/questions tartibi boshqacha, lekin mazmun bir xil.
    expect(darslikCheckHash(candidate)).toBe(darslikCheckHash(base))
  })

  it('javob kaliti o‘zgarsa hash o‘zgaradi — eski kesh yangilanadi', () => {
    const changed: DarslikCheck = {
      format: 'lesson',
      questions: base.questions.map((question) =>
        question.kind === 'mcq' || question.kind === 'listening'
          ? { ...question, correctIndex: (question.correctIndex + 1) % 4 }
          : question),
    }
    expect(darslikCheckHash(changed)).not.toBe(darslikCheckHash(base))
  })

  it('word_bank javob tartibi mazmunning qismi — hash farq qiladi', () => {
    const wordBank = base.questions.find(question => question.kind === 'word_bank')
    expect(wordBank?.kind).toBe('word_bank')
    if (wordBank?.kind !== 'word_bank') return
    const changed: DarslikCheck = {
      format: 'lesson',
      questions: base.questions.map(question => question.id === wordBank.id
        ? { ...wordBank, answer: [...wordBank.answer].reverse() }
        : question),
    }
    expect(darslikCheckHash(changed)).not.toBe(darslikCheckHash(base))
  })
})
