import { describe, it, expect } from 'vitest'
import { buildGraphChatContext } from '../../../../src/features/graph/lib/chat-context'

describe('grafik: AI chat konteksti', () => {
  it('ko‘rinadigan ifodalar va parametrlarni kiritadi, yashirilganini EMAS', () => {
    const ctx = buildGraphChatContext({
      expressions: [
        { expr: 'a*sin(x)', visible: true },
        { expr: 'cos(x)', visible: false },
      ],
      xVar: 'x',
      vars: { a: 2, x: 1 },
      language: 'uz',
    })
    expect(ctx.questionText).toContain('a*sin(x)')
    expect(ctx.questionText).not.toContain('cos(x)')
    expect(ctx.questionText).toContain("X o'qi: x")
    expect(ctx.questionText).toContain('a = 2')
    // xVar parametrlar ro'yxatiga kirmaydi
    expect(ctx.questionText).not.toContain('x = 1')
    expect(ctx.subjectId).toBe('matematika')
  })

  it('ko‘p ifoda f1/f2 ko‘rinishida raqamlanadi', () => {
    const ctx = buildGraphChatContext({
      expressions: [
        { expr: 'sin(x)', visible: true },
        { expr: 'cos(x)', visible: true },
      ],
      xVar: 't',
      vars: {},
      language: 'uz',
    })
    expect(ctx.questionText).toContain('f1(t) = sin(x)')
    expect(ctx.questionText).toContain('f2(t) = cos(x)')
  })

  it('tahlil bayroqlari matnga qo‘shiladi', () => {
    const ctx = buildGraphChatContext({
      expressions: [{ expr: 'x^2', visible: true }],
      xVar: 'x',
      vars: {},
      language: 'uz',
      analysis: { derivative: true, tangent: true, x0: 2, integral: true, a: 0, b: 1, rects: 10 },
    })
    expect(ctx.questionText).toContain("Hosila f′ ko'rsatilgan")
    expect(ctx.questionText).toContain('Urinma x₀ = 2')
    expect(ctx.questionText).toContain("Integral [0; 1], to'rtburchaklar: 10")
  })

  it('rus tilida lokalizatsiya', () => {
    const ctx = buildGraphChatContext({
      expressions: [{ expr: 'sin(x)', visible: true }],
      xVar: 'x',
      vars: {},
      language: 'ru',
    })
    expect(ctx.questionText).toContain('Функция')
    expect(ctx.topicName).toBe('График функции')
  })

  it('questionText 2900 belgidan oshmaydi', () => {
    const ctx = buildGraphChatContext({
      expressions: [{ expr: 'x'.repeat(200), visible: true }],
      xVar: 'x',
      vars: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}`, i])),
      language: 'uz',
    })
    expect(ctx.questionText.length).toBeLessThanOrEqual(2900)
  })
})
