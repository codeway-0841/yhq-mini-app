/**
 * AI Kunlik Test BAHOLASH (grader).
 *
 *  - 1–2 bo'limlar (mcq/matching): DETERMINISTIK aniq solishtirish.
 *  - 3 bo'lim (short): normalizeShortAnswer bilan aniq solishtirish; mos
 *    kelmagan (bo'sh bo'lmagan) javoblar AI qayta ko'rikka yuboriladi.
 *  - 4 bo'lim (essay): FAQAT AI baholaydi (rubrika: tezis/argumentlar/xulosa/
 *    grammatika → 0–10 + qisqa izoh).
 *
 * Esse + qisqa javob qayta-ko'rig'i BITTA Gemini chaqiriqda (xarajat tejaladi).
 * AI chaqiriq vaqtincha ishlamasa → AppError(503): hech narsa yozilmaydi,
 * client o'sha clientToken bilan qayta yuboradi (idempotent submit).
 * Kvota tugagan bo'lsa (router qarori) → aiAllowed=false: esse baholanMAYDI
 * (essay=null), qolgani deterministik — urinish baribir yoziladi.
 */

import { z } from 'zod'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import {
  AI_TEST_COIN_PER_CORRECT,
  essayCoinsForScore,
  normalizeShortAnswer,
  type AiTestAnswers,
  type AiTestGrading,
  type AiTestPayload,
  type AiTestShortTask,
} from '../../../shared/ai-daily-test'

export const GRADE_TIMEOUT_MS = 45_000

// generator.ts dagi MODELS bilan bir xil tartib (3.x avlod — 2.5 o'chirilgan)
const GRADE_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-pro-latest',
] as const

const AiGradeSchema = z.object({
  essay: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string().max(2000).default(''),
  }).nullable().default(null),
  shortReview: z.array(z.object({
    id: z.string().min(1),
    correct: z.boolean(),
  })).default([]),
})

export interface DeterministicGrade {
  grading: AiTestGrading
  /** Aniq match'dan o'tmagan (bo'sh bo'lmagan) qisqa javoblar — AI ko'rig'i uchun */
  failedShort: AiTestShortTask[]
  essayText: string
}

/** 1–3 bo'limlarni AI'siz baholash (sof funksiya — testlar ham shuni ishlatadi). */
export function gradeDeterministic(payload: AiTestPayload, answers: AiTestAnswers): DeterministicGrade {
  const grading: AiTestGrading = {
    mcq: {},
    matching: {},
    short: {},
    essay: null,
    correctCount: 0,
    essayScore: 0,
    coinsAwarded: 0,
  }
  const failedShort: AiTestShortTask[] = []

  for (const task of payload.tasks) {
    switch (task.kind) {
      case 'mcq': {
        const given = answers.mcq[task.id]
        const correct = given === task.correctOptionId
        grading.mcq[task.id] = { correct, correctOptionId: task.correctOptionId }
        if (correct) grading.correctCount++
        break
      }
      case 'matching': {
        const givenMap = answers.matching[task.id] ?? {}
        const correct = task.left.every((l) => givenMap[l.id] === task.correct[l.id])
        grading.matching[task.id] = { correct, correctMapping: task.correct }
        if (correct) grading.correctCount++
        break
      }
      case 'short': {
        const given = (answers.short[task.id] ?? '').trim()
        const normalized = normalizeShortAnswer(given)
        const exact = given.length > 0
          && task.acceptedAnswers.some((a) => normalizeShortAnswer(a) === normalized)
        grading.short[task.id] = { correct: exact, acceptedAnswers: task.acceptedAnswers }
        if (exact) grading.correctCount++
        else if (given.length > 0) failedShort.push(task)
        break
      }
      case 'essay':
        break
    }
  }
  return { grading, failedShort, essayText: answers.essay.trim() }
}

/** Bu javoblar to'plami AI baholashni talab qiladimi (kvota sarflashdan OLDIN tekshiruv). */
export function needsAiReview(payload: AiTestPayload, answers: AiTestAnswers): boolean {
  const { failedShort, essayText } = gradeDeterministic(payload, answers)
  return essayText.length > 0 || failedShort.length > 0
}

/**
 * To'liq baholash. `aiAllowed` — kunlik global kvota ichida ekanligi
 * (router tutor_usage orqali tekshiradi; oshgan bo'lsa AI'siz degradatsiya).
 */
export async function gradeAiDailyTest(
  payload: AiTestPayload,
  answers: AiTestAnswers,
  aiAllowed: boolean,
): Promise<AiTestGrading> {
  const { grading, failedShort, essayText } = gradeDeterministic(payload, answers)
  const essayTask = payload.tasks.find((t) => t.kind === 'essay') ?? null

  const needAi = aiAllowed && ((essayTask && essayText.length > 0) || failedShort.length > 0)

  if (needAi) {
    const review = await callGeminiGrade(
      essayTask && essayText.length > 0
        ? { prompt: essayTask.prompt, minWords: essayTask.minWords, maxWords: essayTask.maxWords, text: essayText }
        : null,
      failedShort.map((t) => ({
        id: t.id,
        prompt: t.prompt,
        acceptedAnswers: t.acceptedAnswers,
        userAnswer: answers.short[t.id] ?? '',
      })),
    )
    // Qisqa javob qayta-ko'rig'i: AI "to'g'ri" desa — hisobga qo'shiladi
    for (const r of review.shortReview) {
      const g = grading.short[r.id]
      if (g && !g.correct && r.correct) {
        g.correct = true
        grading.correctCount++
      }
    }
    if (review.essay) {
      grading.essay = { score: Math.round(review.essay.score), feedback: review.essay.feedback }
      grading.essayScore = grading.essay.score
    }
  }

  // Esse yozilgan, lekin AI ruxsati yo'q (kvota) → essay=null (baholanmadi).
  // Esse umuman yozilmagan → ball 0, izoh'siz.
  if (!grading.essay && essayText.length === 0) {
    grading.essay = { score: 0, feedback: '' }
    grading.essayScore = 0
  }

  grading.coinsAwarded =
    grading.correctCount * AI_TEST_COIN_PER_CORRECT
    + (grading.essay ? essayCoinsForScore(grading.essay.score) : 0)
  return grading
}

// ── Gemini baholash chaqirig'i (esse + qisqa javob qayta-ko'rig'i birga) ────

async function callGeminiGrade(
  essay: { prompt: string; minWords: number; maxWords: number; text: string } | null,
  shortItems: { id: string; prompt: string; acceptedAnswers: string[]; userAnswer: string }[],
): Promise<z.infer<typeof AiGradeSchema>> {
  const key = config.ai.geminiApiKey
  if (!key) throw new AppError(503, 'AI baholash vaqtincha mavjud emas')

  const parts: string[] = []
  if (essay) {
    parts.push(`ЭССЕ. Задание: «${essay.prompt}». Требуемый объём: ${essay.minWords}–${essay.maxWords} слов.
Текст ученика:
"""
${essay.text.slice(0, 6000)}
"""
Оцени по рубрике (сумма = score 0..10): тезис сформулирован (0–2); не менее двух аргументов, один из литературного произведения (0–4); логичный вывод (0–2); грамотность и соблюдение объёма (0–2). Если текст меньше половины требуемого объёма — не более 4 баллов суммарно. feedback: 2–4 предложения по-русски (сильные стороны + что улучшить).`)
  }
  if (shortItems.length > 0) {
    parts.push(`ПРОВЕРКА КРАТКИХ ОТВЕТОВ. Для каждого пункта реши, можно ли засчитать ответ ученика как верный (смысловое совпадение с эталоном; форма записи, падеж, порядок слов, ё/е — не важны; грубая смысловая ошибка — нельзя):
${shortItems.map((s) => `- id "${s.id}": задание «${s.prompt}»; эталон: ${s.acceptedAnswers.map((a) => `«${a}»`).join(', ')}; ответ ученика: «${s.userAnswer.slice(0, 300)}»`).join('\n')}`)
  }
  const prompt = `Ты — строгий, но справедливый эксперт-балловщик экзамена по русскому языку и литературе.

${parts.join('\n\n')}

Ответь СТРОГО валидным JSON (без markdown):
{"essay": ${essay ? '{"score": <0..10>, "feedback": "..."}' : 'null'}, "shortReview": [${shortItems.length ? '{"id": "<id>", "correct": <true|false>}' : ''}]}
В shortReview включай ТОЛЬКО перечисленные id.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GRADE_TIMEOUT_MS)
  try {
    // Model fallback: bitta model 404/429/503 qaytsa keyingisiga o'tiladi
    let res: Response | null = null
    let lastStatus = 0
    for (const model of GRADE_MODELS) {
      try {
        const attempt = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048, temperature: 0.2 },
            }),
          },
        )
        if (attempt.ok) { res = attempt; break }
        lastStatus = attempt.status
        console.warn(`[ai-test-grade] ${model}: HTTP ${attempt.status}`)
      } catch (err) {
        console.warn(`[ai-test-grade] ${model}:`, (err as Error)?.message ?? err)
      }
    }
    if (!res) {
      console.error('[ai-test-grade] barcha modellar yiqildi, oxirgi status:', lastStatus)
      throw new AppError(503, 'AI baholash vaqtincha ishlamayapti — birozdan so‘ng qayta yuboring')
    }
    const json = await res.json()
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new AppError(503, 'AI baholash bo‘sh javob qaytardi')
    return AiGradeSchema.parse(JSON.parse(text))
  } catch (err) {
    if (err instanceof AppError) throw err
    console.error('[ai-test-grade]', (err as Error)?.message ?? err)
    throw new AppError(503, 'AI baholash vaqtincha ishlamayapti — birozdan so‘ng qayta yuboring')
  } finally {
    clearTimeout(timeout)
  }
}
