/**
 * AI Kunlik Test (shared/ai-daily-test.ts) — config integrity + SSOT himoyasi.
 *
 * Nega: task sonlari/coin miqdorlari UI + server + generator orasida desync
 * bo'lmasligi shart (masalan "X/44" va coin byudjeti shu konstantalardan).
 * Payload zod-sxema — generator chiqisining YAGONA validatsiya darvozasi.
 */
import { describe, it, expect } from 'vitest'
import {
  AI_TEST_SUBJECT_ID, AI_TEST_SLOTS, AI_TEST_PREMIUM_SLOT,
  AI_TEST_TASK_COUNTS, AI_TEST_TOTAL_TASKS, AI_TEST_GRADED_TASKS,
  AI_TEST_COIN_PER_CORRECT, AI_TEST_ESSAY_MAX_COINS, AI_TEST_MAX_COINS,
  AI_TEST_ESSAY_MIN_WORDS, AI_TEST_ESSAY_MAX_WORDS, AI_TEST_DAILY_GRADE_LIMIT,
  AI_TEST_LEDGER_REASON,
  AiTestPayloadSchema, AiTestAnswersSchema,
  normalizeShortAnswer, essayCoinsForScore, toPublicAiTest, aiTestTaskNumber,
  type AiTestPayload,
} from '../../../shared/ai-daily-test'
import { SUBJECT_BASES } from '../../../shared/subjects'

/** Valid 45-topshiriqli test payload (fixture) — grader testlari ham shundan */
export function buildValidPayload(): AiTestPayload {
  const tasks: AiTestPayload['tasks'] = []
  for (let i = 1; i <= AI_TEST_TASK_COUNTS.mcq; i++) {
    tasks.push({
      kind: 'mcq', id: `mcq-${i}`, topic: 'Орфография',
      prompt: `В каком варианте правильно? (${i})`,
      options: [
        { id: 'A1', text: `вариант 1-${i}` }, { id: 'A2', text: `вариант 2-${i}` },
        { id: 'A3', text: `вариант 3-${i}` }, { id: 'A4', text: `вариант 4-${i}` },
      ],
      correctOptionId: 'A2',
    })
  }
  for (let i = 1; i <= AI_TEST_TASK_COUNTS.matching; i++) {
    tasks.push({
      kind: 'matching', id: `match-${i}`, topic: 'Тропы',
      prompt: 'Установите соответствие',
      left: [
        { id: 'L1', text: `строка 1 (${i})` }, { id: 'L2', text: `строка 2 (${i})` },
        { id: 'L3', text: `строка 3 (${i})` },
      ],
      right: [
        { id: 'R1', text: 'Метафора' }, { id: 'R2', text: 'Метонимия' },
        { id: 'R3', text: 'Сравнение' }, { id: 'R4', text: 'Эпитет' },
      ],
      correct: { L1: 'R2', L2: 'R3', L3: 'R1' },
    })
  }
  for (let i = 1; i <= AI_TEST_TASK_COUNTS.short; i++) {
    tasks.push({
      kind: 'short', id: `short-${i}`, topic: 'Лексический анализ',
      contextId: i <= 5 ? 'ctx-1' : 'ctx-2',
      prompt: `Выпишите фразеологизм (${i})`,
      acceptedAnswers: [`бередит душу ${i}`, `вариант ${i}`],
    })
  }
  tasks.push({
    kind: 'essay', id: 'essay-1', topic: 'Равнодушие',
    prompt: 'Напишите эссе 150–200 слов о равнодушии.',
    minWords: AI_TEST_ESSAY_MIN_WORDS, maxWords: AI_TEST_ESSAY_MAX_WORDS,
  })
  return {
    version: 1,
    title: 'Вариант №1',
    contexts: [
      { id: 'ctx-1', text: '(1) Первый текст. '.repeat(10) },
      { id: 'ctx-2', text: '(1) Второй текст. '.repeat(10) },
    ],
    tasks,
  }
}

describe('config/ai-daily-test — konstantalar', () => {
  it('task sonlari: 32+3+9+1 = 45 (Milliy sertifikat formati)', () => {
    expect(AI_TEST_TASK_COUNTS).toEqual({ mcq: 32, matching: 3, short: 9, essay: 1 })
    expect(AI_TEST_TOTAL_TASKS).toBe(45)
    expect(AI_TEST_GRADED_TASKS).toBe(44)
  })

  it("iqtisod: coin konfigi oqilona (max 50c/test, ledger reason yangi)", () => {
    expect(AI_TEST_COIN_PER_CORRECT).toBe(1)
    expect(AI_TEST_ESSAY_MAX_COINS).toBeGreaterThan(0)
    expect(AI_TEST_MAX_COINS).toBe(50)
    expect(AI_TEST_LEDGER_REASON).toBe('ai_test')
    expect(AI_TEST_DAILY_GRADE_LIMIT).toBeGreaterThan(0)
  })

  it('subject rustili mavjud; slot 2 = premium; esse diapazoni valid', () => {
    expect(SUBJECT_BASES.some((s) => s.id === AI_TEST_SUBJECT_ID)).toBe(true)
    expect(AI_TEST_SLOTS).toEqual([1, 2])
    expect(AI_TEST_PREMIUM_SLOT).toBe(2)
    expect(AI_TEST_ESSAY_MIN_WORDS).toBeLessThan(AI_TEST_ESSAY_MAX_WORDS)
  })
})

describe('config/ai-daily-test — payload sxema', () => {
  it('valid fixture o\'tadi (45 topshiriq, superRefine tekshiruvlari)', () => {
    const p = buildValidPayload()
    const parsed = AiTestPayloadSchema.safeParse(p)
    expect(parsed.success).toBe(true)
  })

  it('noto\'g\'ri son (44 topshiriq) rad etiladi', () => {
    const p = buildValidPayload()
    p.tasks = p.tasks.slice(0, 44)
    expect(AiTestPayloadSchema.safeParse(p).success).toBe(false)
  })

  it('mcq: correctOptionId variantlarda bo\'lishi SHART', () => {
    const p = buildValidPayload()
    const mcq = p.tasks[0]
    if (mcq.kind !== 'mcq') throw new Error('fixture xato')
    mcq.correctOptionId = 'A9'
    expect(AiTestPayloadSchema.safeParse(p).success).toBe(false)
  })

  it('matching: har bir chap element uchun javob + valid id\'lar SHART', () => {
    const p = buildValidPayload()
    const m = p.tasks.find((t) => t.kind === 'matching')
    if (m?.kind !== 'matching') throw new Error('fixture xato')
    delete m.correct.L2
    expect(AiTestPayloadSchema.safeParse(p).success).toBe(false)
  })

  it('short: contextId contexts\'da mavjud bo\'lishi SHART', () => {
    const p = buildValidPayload()
    const s = p.tasks.find((t) => t.kind === 'short')
    if (s?.kind !== 'short') throw new Error('fixture xato')
    s.contextId = 'ctx-99'
    expect(AiTestPayloadSchema.safeParse(p).success).toBe(false)
  })
})

describe('config/ai-daily-test — helperlar', () => {
  it('normalizeShortAnswer: case/ё/пунктуация/бошлиқлар', () => {
    expect(normalizeShortAnswer('  Бередит  Душу ')).toBe('бередит душу')
    expect(normalizeShortAnswer('бередит душу.')).toBe('бередит душу')
    expect(normalizeShortAnswer('ОГОРЧЁННЫЙ')).toBe(normalizeShortAnswer('огорченный'))
    expect(normalizeShortAnswer('«свет» — добрый,')).toBe('свет добрый')
  })

  it('essayCoinsForScore: 0–10 → 0..6 (chegaralar)', () => {
    expect(essayCoinsForScore(0)).toBe(0)
    expect(essayCoinsForScore(5)).toBe(3)
    expect(essayCoinsForScore(10)).toBe(AI_TEST_ESSAY_MAX_COINS)
    expect(essayCoinsForScore(999)).toBe(AI_TEST_ESSAY_MAX_COINS)  // clamp
    expect(essayCoinsForScore(-5)).toBe(0)
  })

  it('toPublicAiTest: javob kalitlari STRIP (trust boundary)', () => {
    const pub = toPublicAiTest(buildValidPayload())
    for (const t of pub.tasks) {
      expect(t).not.toHaveProperty('correctOptionId')
      expect(t).not.toHaveProperty('correct')
      expect(t).not.toHaveProperty('acceptedAnswers')
    }
    expect(pub.tasks.length).toBe(AI_TEST_TOTAL_TASKS)
    expect(pub.contexts.length).toBe(2)
  })

  it('aiTestTaskNumber: global tartib 1..45', () => {
    const p = buildValidPayload()
    expect(aiTestTaskNumber(p, 'mcq-1')).toBe(1)
    expect(aiTestTaskNumber(p, 'essay-1')).toBe(AI_TEST_TOTAL_TASKS)
    expect(aiTestTaskNumber(p, 'yoq')).toBe(0)
  })

  it('AiTestAnswersSchema: default bo\'sh javoblar', () => {
    const a = AiTestAnswersSchema.parse({})
    expect(a).toEqual({ mcq: {}, matching: {}, short: {}, essay: '' })
  })
})
