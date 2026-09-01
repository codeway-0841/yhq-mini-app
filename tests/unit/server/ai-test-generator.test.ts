/**
 * AI Kunlik Test GENERATOR (server/modules/ai-tests/generator.ts) — Gemini mock.
 *
 * Nega: generator chiqishi DB'ga tushadi — buzuk payload butun kunlik testni
 * buzadi. Zod validatsiya + retry + xato yo'llari shu yerda qulflanadi.
 * Gemini chaqiriqlari global fetch ustida mock'lanadi (tutor-explain pattern'i).
 */
import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { AppError } from '../../../server/middleware/error-handler'
import { config } from '../../../server/config'
import { generateAiDailyTest } from '../../../server/modules/ai-tests/generator'
import {
  AI_TEST_TASK_COUNTS, AI_TEST_TOTAL_TASKS, AiTestPayloadSchema,
} from '../../../shared/ai-daily-test'

const ORIGINAL_KEY = config.ai.geminiApiKey
const realFetch = globalThis.fetch

// ── Mock javob builderlar ────────────────────────────────────────────────────

function mcqItems(count: number, topicBase: string) {
  return Array.from({ length: count }, (_, i) => ({
    topic: `${topicBase} ${i + 1}`,
    prompt: `Тестовый вопрос ${topicBase} №${i + 1}: выберите верный вариант?`,
    options: [`вариант а${i}`, `вариант б${i}`, `вариант в${i}`, `вариант г${i}`],
    correctIndex: i % 4,
  }))
}

function geminiResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

/** Prompt matniga qarab tegishli bo'lim javobini qaytaradi (5 parallel chaqiriq). */
function validSectionResponse(bodyText: string): Response {
  if (bodyText.includes('сочинение-эссе')) {
    return geminiResponse({
      topic: 'Равнодушие — паралич души',
      prompt: 'Напишите связное эссе объёмом 150–200 слов о том, как чёрствость влияет на общество. Сформулируйте тезис, приведите не менее двух аргументов и сделайте вывод.',
    })
  }
  if (bodyText.includes('установление соответствия')) {
    return geminiResponse(
      Array.from({ length: AI_TEST_TASK_COUNTS.matching }, (_, i) => ({
        topic: `Тропы ${i + 1}`,
        prompt: `Установите соответствие между строками и тропами (${i + 1})`,
        left: ['«Строка первая» (автор)', '«Строка вторая» (автор)', '«Строка третья» (автор)'],
        right: ['Метафора', 'Метонимия', 'Сравнение', 'Эпитет'],
        correct: [1, 2, 0],
      })),
    )
  }
  if (bodyText.includes('раздела 3')) {
    return geminiResponse({
      contexts: [
        {
          text: '(1) Книги обладают удивительным свойством. (2) Читая классику, мы переносимся в далёкие эпохи. (3) Литература бередит душу читателя. (4) В век интернета чтение становится личным занятием.',
          tasks: Array.from({ length: 5 }, (_, i) => ({
            topic: 'Лексический анализ',
            prompt: `Задание к первому тексту №${i + 1}: выпишите фразеологизм из предложения (3).`,
            acceptedAnswers: ['бередит душу', 'бередит читателю душу'],
          })),
        },
        {
          text: '(1) Язык — живая система. (2) Слова меняют значения веками. (3) Неологизмы появляются ежедневно. (4) Архаизмы уходят в пассивный запас. (5) Это естественный процесс развития.',
          tasks: Array.from({ length: 4 }, (_, i) => ({
            topic: 'Грамматический анализ',
            prompt: `Задание ко второму тексту №${i + 1}: укажите номер предложения с деепричастным оборотом.`,
            acceptedAnswers: ['2', 'второе предложение'],
          })),
        },
      ],
    })
  }
  if (bodyText.includes('Литература: тексты и герои')) {
    return geminiResponse(mcqItems(16, 'Литература'))
  }
  // mcq batch a (Орфография — 4, ...)
  return geminiResponse(mcqItems(16, 'Грамотность'))
}

function mockGemini(handler: (bodyText: string) => Response) {
  const calls = { count: 0 }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('generativelanguage.googleapis.com')) {
      calls.count++
      return handler(String(init?.body ?? ''))
    }
    return realFetch(input as RequestInfo, init)
  }) as unknown as typeof fetch
  return calls
}

beforeEach(() => {
  config.ai.geminiApiKey = 'test-gemini-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

afterAll(() => {
  config.ai.geminiApiKey = ORIGINAL_KEY
})

describe('ai-test generator', () => {
  it('valid bo\'lim javoblari → 45 topshiriqli payload, sxema o\'tadi', async () => {
    mockGemini(validSectionResponse)
    const payload = await generateAiDailyTest(1)
    expect(payload.title).toBe('Вариант №1')
    expect(payload.tasks.length).toBe(AI_TEST_TOTAL_TASKS)
    expect(AiTestPayloadSchema.safeParse(payload).success).toBe(true)
    // Id'lar: mcq-1..mcq-32, match-1..3, short-1..9, essay-1
    expect(payload.tasks[0]?.id).toBe('mcq-1')
    expect(payload.tasks[31]?.id).toBe('mcq-32')
    expect(payload.tasks[32]?.id).toBe('match-1')
    expect(payload.tasks[35]?.id).toBe('short-1')
    expect(payload.tasks[44]?.id).toBe('essay-1')
    // correctOptionId indeksdan id'ga to'g'ri xaritalangan
    const first = payload.tasks[0]
    if (first?.kind !== 'mcq') throw new Error('mcq kutilgan edi')
    expect(first.correctOptionId).toBe(first.options[0]!.id)  // correctIndex: 0
    // matching: correct map to'liq
    const m = payload.tasks[32]
    if (m?.kind !== 'matching') throw new Error('matching kutilgan edi')
    expect(Object.keys(m.correct).sort()).toEqual(['L1', 'L2', 'L3'])
  })

  it('bo\'lim noto\'g\'ri sonda kelsa → retry, keyin AppError (validatsiya darvozasi)', async () => {
    const calls = mockGemini((body) => {
      if (body.includes('Литература: тексты и герои')) {
        return geminiResponse(mcqItems(10, 'Литература'))  // 16 o'rniga 10!
      }
      return validSectionResponse(body)
    })
    await expect(generateAiDailyTest(1)).rejects.toThrow(AppError)
    // 2 urinish × har birida mcq-b chaqiruvi (parallel) — kamida 2 marta
    expect(calls.count).toBeGreaterThanOrEqual(2)
  })

  it('GEMINI_API_KEY yo\'q → 503 (fail-fast, DB\'ga yozilmaydi)', async () => {
    config.ai.geminiApiKey = undefined
    await expect(generateAiDailyTest(2)).rejects.toMatchObject({ statusCode: 503 })
  })
})
