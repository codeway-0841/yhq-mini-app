/**
 * AI Kunlik Test GENERATORI (Google Gemini) — rustili, Milliy sertifikat formati.
 *
 * 45 topshiriqli to'liq variant 5 ta PARALLEL Gemini chaqiriqda tuziladi:
 *   mcq-a (16) + mcq-b (16) + matching (3) + short (2 kontekst + 9 topshiriq) + essay (1)
 * Har chaqiriq JSON (responseMimeType) qaytaradi → zod bilan QAT'IY validatsiya →
 * yig'ilgach AiTestPayloadSchema superRefine'i umumiy tekshiruv qiladi.
 * Har bir bo'lim chaqiriq'i 1 marta retry qilinadi; umumiy fail → AppError.
 *
 * Diqqat: bu modul FAQAT server (cron-scheduler/admin trigger) — Vercel 60s
 * limitiga sig'masligi mumkin, shuning uchun asosiy ishga tushirish Render'da.
 */

import { z } from 'zod'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import {
  AI_TEST_TASK_COUNTS,
  AI_TEST_ESSAY_MIN_WORDS,
  AI_TEST_ESSAY_MAX_WORDS,
  AiTestPayloadSchema,
  type AiTestPayload,
  type AiTestTask,
} from '../../../shared/ai-daily-test'

// Model fallback tartibi (2026-09-01): gemini-2.5-* Google'da O'CHIRILGAN (404),
// gemini-flash-latest davriy 503/429 qaytaradi — ishlaydigan avlod 3.x birinchi.
const MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-pro-latest',
] as const
const TIMEOUT_MS = 75_000

// ── Gemini JSON chaqiriq (model fallback bilan) ─────────────────────────────

async function callGeminiJson(systemInstruction: string, userPrompt: string, maxOutputTokens: number): Promise<unknown> {
  const key = config.ai.geminiApiKey
  if (!key) throw new AppError(503, "AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)")

  let lastError = ''
  for (const model of MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens, temperature: 0.55 },
          }),
        },
      )
      clearTimeout(timeout)
      if (!res.ok) {
        lastError = `${model}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 150)}`
        console.warn('[ai-test-gen]', lastError)
        if (res.status === 429) throw new AppError(429, 'Gemini API kvotasi tugadi. Keyinroq qayta urinib ko‘ring.')
        continue
      }
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) { lastError = `${model}: bo'sh javob`; continue }
      try {
        return JSON.parse(text)
      } catch {
        lastError = `${model}: JSON parse xatosi`
        console.warn('[ai-test-gen]', lastError, text.slice(0, 200))
        continue
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof AppError) throw err
      lastError = `${model}: ${(err as Error)?.message ?? 'network'}`
      console.warn('[ai-test-gen]', lastError)
    }
  }
  throw new AppError(502, `AI generator ishlamadi: ${lastError.slice(0, 120)}`)
}

const SYSTEM = `Ты — профессиональный составитель тестов для национального сертификационного экзамена по русскому языку и литературе (Узбекистан).
Требования:
- Все задания ТОЛЬКО на русском языке, экзаменационного стиля и высокого качества.
- Задания должны быть однозначными: ровно один правильный ответ, без спорных формулировок.
- Отвечай СТРОГО валидным JSON без markdown-обёрток и пояснений.`

// ── AI javoblari uchun zod sxemalari ────────────────────────────────────────

const McqAiSchema = z.array(z.object({
  topic: z.string().min(1),
  prompt: z.string().min(10),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
}))

const MatchingAiSchema = z.array(z.object({
  topic: z.string().min(1),
  prompt: z.string().min(10),
  left: z.array(z.string().min(1)).min(3).max(6),
  right: z.array(z.string().min(1)).min(3).max(6),
  /** correct[i] — left[i] uchun right indeks */
  correct: z.array(z.number().int().min(0)).min(3).max(6),
}))

const ShortAiSchema = z.object({
  contexts: z.array(z.object({
    text: z.string().min(100),
    tasks: z.array(z.object({
      topic: z.string().min(1),
      prompt: z.string().min(10),
      acceptedAnswers: z.array(z.string().min(1)).min(1).max(8),
    })).min(1),
  })).min(2).max(2),
})

const EssayAiSchema = z.object({
  topic: z.string().min(5),
  prompt: z.string().min(30),
})

// ── Bo'lim generatorlari ────────────────────────────────────────────────────

const OPTION_IDS = ['A1', 'A2', 'A3', 'A4'] as const

async function genMcqBatch(batchTag: string, spec: string, count: number): Promise<AiTestTask[]> {
  const raw = await callGeminiJson(SYSTEM, `Составь РОВНО ${count} закрытых тестовых заданий (ровно один верный ответ) для раздела 1 экзамена по русскому языку и литературе.
Распределение по темам: ${spec}.
Каждое задание: вопрос/задание + 4 варианта ответа (А, Б, В, Г) + индекс верного (0..3).
Формат — JSON массив:
[{"topic": "Орфография", "prompt": "В каком варианте во всех словах пишется одна буква Н?", "options": ["...", "...", "...", "..."], "correctIndex": 2}]
Варианты ответов НЕ должны содержать буквы А), Б) внутри текста. Задания разнообразные, не повторяй классические примеры дословно.`, 8192)
  const parsed = McqAiSchema.parse(raw)
  if (parsed.length !== count) throw new AppError(502, `mcq ${batchTag}: ${count} ta kutilgan, ${parsed.length} ta keldi`)
  return parsed.map((q, i) => ({
    kind: 'mcq' as const,
    id: `mcq-${batchTag === 'a' ? i + 1 : i + 1 + 16}`,
    topic: q.topic.trim(),
    prompt: q.prompt.trim(),
    options: q.options.map((text, oi) => ({ id: OPTION_IDS[oi], text: text.trim() })),
    correctOptionId: OPTION_IDS[q.correctIndex],
  }))
}

async function genMatching(): Promise<AiTestTask[]> {
  const raw = await callGeminiJson(SYSTEM, `Составь РОВНО ${AI_TEST_TASK_COUNTS.matching} задания на установление соответствия (раздел 2) по теории литературы и русскому языку.
Примеры тем: средства выразительности (метафора/метонимия/сравнение/эпитет), жанры литературы, термины синтаксиса/морфологии, литературные направления и их представители.
Каждое задание: инструкция + левая колонка (3–5 элементов) + правая колонка (3–6 элементов, на 0–2 БОЛЬШЕ чем левая, чтобы были лишние) + массив correct, где correct[i] — индекс элемента правой колонки для left[i].
Формат — JSON массив:
[{"topic": "Теория литературы: тропы", "prompt": "Установите соответствие между поэтическими строками и тропами", "left": ["«...» (автор)", ...], "right": ["Метафора", "Метонимия", "Сравнение", "Эпитет"], "correct": [1, 2, 0]}]
Каждый элемент левой колонки должен иметь РОВНО одно верное соответствие.`, 4096)
  const parsed = MatchingAiSchema.parse(raw)
  if (parsed.length !== AI_TEST_TASK_COUNTS.matching) {
    throw new AppError(502, `matching: ${AI_TEST_TASK_COUNTS.matching} ta kutilgan, ${parsed.length} ta keldi`)
  }
  return parsed.map((q, i) => {
    if (q.correct.length !== q.left.length) throw new AppError(502, `matching ${i + 1}: correct uzunligi left'ga teng emas`)
    const left = q.left.map((text, li) => ({ id: `L${li + 1}`, text: text.trim() }))
    const right = q.right.map((text, ri) => ({ id: `R${ri + 1}`, text: text.trim() }))
    const correct: Record<string, string> = {}
    q.correct.forEach((ri, li) => {
      if (ri < 0 || ri >= right.length) throw new AppError(502, `matching ${i + 1}: yaroqsiz correct indeks`)
      correct[`L${li + 1}`] = `R${ri + 1}`
    })
    return { kind: 'matching' as const, id: `match-${i + 1}`, topic: q.topic.trim(), prompt: q.prompt.trim(), left, right, correct }
  })
}

async function genShort(): Promise<{ tasks: AiTestTask[]; contexts: { id: string; text: string }[] }> {
  const raw = await callGeminiJson(SYSTEM, `Составь материал раздела 3 (открытые задания с кратким ответом) экзамена по русскому языку и литературе.
Нужно РОВНО 2 связных текста (каждый 4–6 предложений, о литературе/чтении/языке) и по ним ВСЕГО ${AI_TEST_TASK_COUNTS.short} заданий: к первому тексту 5, ко второму 4.
Типы заданий: найти фразеологизм, антонимы/синонимы из текста, тип связи в словосочетании, найти предложение с обособленным обстоятельством/определением (ответ — номер), определить средство выразительности, грамматическая основа предложения и т.п.
Каждое задание: короткий вопрос + ВСЕ приемлемые варианты ответа (acceptedAnswers: 1–5 вариантов, включая возможные формы записи, например "2" и "второе предложение").
Формат — JSON:
{"contexts": [{"text": "(1) ... (2) ... (предложения пронумерованы)", "tasks": [{"topic": "Лексический анализ", "prompt": "Найдите в предложении (3) фразеологизм. Выпишите его.", "acceptedAnswers": ["бередит душу"]}]}]}
Ответ каждого задания должен ТОЧНО находиться в тексте или быть однозначно проверяемым (номер предложения, тип связи).`, 8192)
  const parsed = ShortAiSchema.parse(raw)
  const total = parsed.contexts.reduce((s, c) => s + c.tasks.length, 0)
  if (total !== AI_TEST_TASK_COUNTS.short) {
    throw new AppError(502, `short: ${AI_TEST_TASK_COUNTS.short} ta kutilgan, ${total} ta keldi`)
  }
  const contexts = parsed.contexts.map((c, i) => ({ id: `ctx-${i + 1}`, text: c.text.trim() }))
  const tasks: AiTestTask[] = []
  let n = 0
  parsed.contexts.forEach((c, ci) => {
    for (const t of c.tasks) {
      n++
      tasks.push({
        kind: 'short' as const,
        id: `short-${n}`,
        topic: t.topic.trim(),
        contextId: `ctx-${ci + 1}`,
        prompt: t.prompt.trim(),
        acceptedAnswers: t.acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      })
    }
  })
  return { tasks, contexts }
}

async function genEssay(): Promise<AiTestTask> {
  const raw = await callGeminiJson(SYSTEM, `Придумай ОДНО задание раздела 4 — сочинение-эссе (${AI_TEST_ESSAY_MIN_WORDS}–${AI_TEST_ESSAY_MAX_WORDS} слов) для экзамена по русскому языку и литературе.
Тема: актуальная нравственно-философская проблема с опорой на русскую классическую литературу (можно цитату классика).
Инструкция: сформулировать тезис, привести не менее двух аргументов (один — из литературного произведения, второй — из жизненного опыта), сделать логический вывод.
Формат — JSON: {"topic": "краткая тема", "prompt": "полный текст задания с инструкцией"}`, 1024)
  const parsed = EssayAiSchema.parse(raw)
  return {
    kind: 'essay' as const,
    id: 'essay-1',
    topic: parsed.topic.trim(),
    prompt: parsed.prompt.trim(),
    minWords: AI_TEST_ESSAY_MIN_WORDS,
    maxWords: AI_TEST_ESSAY_MAX_WORDS,
  }
}

// ── To'liq variant ──────────────────────────────────────────────────────────

/**
 * Bitta to'liq 45 topshiriqli variant generatsiya qiladi (5 parallel chaqiriq).
 * Muvaffaqiyatsizlikda BUTUN variant 1 marta qayta uriniladi.
 */
export async function generateAiDailyTest(slot: 1 | 2): Promise<AiTestPayload> {
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const [mcqA, mcqB, matching, short, essay] = await Promise.all([
        genMcqBatch('a', 'Орфография — 4, Пунктуация — 4, Лексика и фразеология — 3, Морфология — 3, Синтаксис — 2', 16),
        genMcqBatch('b', 'Литература: тексты и герои — 5, Литература: авторы и произведения — 4, Теория литературы — 4, Стилистика и речеведение — 3', 16),
        genMatching(),
        genShort(),
        genEssay(),
      ])
      const payload = AiTestPayloadSchema.parse({
        version: 1,
        title: `Вариант №${slot}`,
        contexts: short.contexts,
        tasks: [...mcqA, ...mcqB, ...matching, ...short.tasks, essay],
      })
      return payload
    } catch (err) {
      lastErr = err
      console.warn(`[ai-test-gen] slot ${slot} urinish ${attempt} yiqildi:`, (err as Error)?.message ?? err)
    }
  }
  throw lastErr instanceof AppError ? lastErr : new AppError(502, `AI test generatsiyasi 2 urinishda ham yiqildi: ${(lastErr as Error)?.message}`)
}
