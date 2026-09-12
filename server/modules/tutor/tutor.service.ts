/**
 * AI Tutor Servisi — Multimodal Vision (Suratdan yechish) va Sokratik Dialog.
 * Google Gemini API (Flash 3.x / Flash Latest) integratsiyasi.
 */

import { z } from 'zod'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import { SUBJECT_BASES } from '../../../shared/subjects'

// Model fallback ierarxiyasi (3.x va oxirgi Flash modellar)
const VISION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
] as const

const CHAT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
] as const

const TIMEOUT_MS = 60_000

export const PhotoSolveResultSchema = z.object({
  ocrText: z.string().describe("Rasmdan o'qilgan masala/test matni to'liq va aniq"),
  detectedSubject: z.string().describe("Fan id'si (masalan: fizika, matematika, kimyo, rustili, ingliz, biologiya, tarix, yhq)"),
  subjectName: z.string().describe("Fanning to'liq nomi (masalan: Fizika)"),
  finalAnswer: z.string().describe("Yakuniy qisqa va lo'nda javob (masalan: 'B javob: 14 m/s' yoki 'x = 5')"),
  steps: z.array(z.object({
    stepNumber: z.number(),
    title: z.string().describe("Qadam sarlavhasi (masalan: '1. Berilganlarni yozib olamiz')"),
    explanation: z.string().describe("Qadamning batafsil tushuntirilishi"),
    formula: z.string().optional().describe("Qadamda qo'llangan LaTeX formulasi (masalan: '$v = v_0 + at$')"),
  })),
  keyConcept: z.string().describe("Masalada qo'llangan asosiy qoida, qonun yoki formula"),
})

export type PhotoSolveResult = z.infer<typeof PhotoSolveResultSchema>

const PHOTO_SOLVE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ocrText: { type: 'STRING', description: "Rasmdan o'qilgan masala/test matni to'liq va aniq" },
    detectedSubject: { type: 'STRING', description: "Fan id'si (masalan: fizika, matematika, kimyo, rustili, ingliz, biologiya, tarix, yhq)" },
    subjectName: { type: 'STRING', description: "Fanning to'liq nomi (masalan: Fizika)" },
    finalAnswer: { type: 'STRING', description: "Yakuniy qisqa va lo'nda javob" },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          stepNumber: { type: 'INTEGER' },
          title: { type: 'STRING', description: "Qadam sarlavhasi" },
          explanation: { type: 'STRING', description: "Qadamning batafsil tushuntirilishi" },
          formula: { type: 'STRING', description: "LaTeX formulasi" },
        },
        required: ['stepNumber', 'title', 'explanation'],
      },
    },
    keyConcept: { type: 'STRING', description: "Asosiy qoida yoki formula" },
  },
  required: ['ocrText', 'detectedSubject', 'subjectName', 'finalAnswer', 'steps', 'keyConcept'],
}

export interface SocraticMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SocraticContext {
  questionText?: string
  options?: Record<string, string>
  userSelectedOption?: string
  correctAnswer?: string
  subjectId?: string
  topicName?: string
}

/**
 * Rasmdan masalani o'qib, qadamma-qadam yechim ishlab chiqarish (Vision AI).
 */
export async function solveProblemFromPhoto(params: {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  subjectHint?: string
  language?: 'uz' | 'ru'
}): Promise<PhotoSolveResult> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, "AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)")
  }

  const lang = params.language ?? 'uz'
  const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '').trim()

  const systemInstruction = lang === 'ru'
    ? `Ты — ведущий академический репетитор и эксперт платформы Kivvi (Узбекистан).
Твоя задача — внимательно проанализировать изображение с учебной задачей/тестом (по физике, математике, химии, биологии, русскому, английскому языку или ПДД).
1. Точно распознай текст задачи (OCR).
2. Определи предмет. Доступные ID предметов: ${SUBJECT_BASES.map(s => s.id).join(', ')}.
3. Реши задачу последовательно, по шагам. Формулы и математические выражения ОБЯЗАТЕЛЬНО оформляй в формате LaTeX: внутристрочные через $...$, блочные через $$...$$.
4. Если задача тестовая с вариантами (A, B, C, D), укажи правильный вариант и объясни, почему остальные неверны.
5. Ответ строго в формате JSON, соответствующем заданной схеме.`
    : `Sen — O'zbekistondagi eng mohir, do'stona va tajribali Kivvi akadem-repetitorisan.
Vazifang — o'quvchi yuborgan rasmdagi o'quv topshirig'i, masala yoki testni (Fizika, Matematika, Kimyo, Biologiya, Rus tili, Ingliz tili, Tarix, YHQ va h.k.) sinchkovlik bilan tahlil qilish.
1. Rasmdagi matnni (formulalar, shartlar, variantlar) xatosiz o'qi (OCR).
2. Fanni aniq belgilagin. Mavjud fan id'lari: ${SUBJECT_BASES.map(s => s.id).join(', ')}.
3. Masalani mantiqiy, bosqichma-bosqich yech. Barcha matematik formulalarni QAT'IY ravishda LaTeX formatida yoz: satr ichidagi formulalar $...$, alohida bloklar $$...$$.
4. Agar test variantlari (A, B, C, D) bo'lsa, to'g'ri variantni aniq ayt va nega boshqalari to'g'ri kelmasligini qisqacha ko'rsat.
5. O'zbek tilining lotin alifbosida, samimiy va sodda tushuntir.
6. Javobni FAQAT berilgan JSON schema'ga mos JSON formatda qaytar.`

  const userPrompt = lang === 'ru'
    ? `Пожалуйста, реши задачу на фото.${params.subjectHint ? ` Подсказка по предмету: ${params.subjectHint}.` : ''}`
    : `Iltimos, ushbu rasmdagi masalani batafsil yechib bering.${params.subjectHint ? ` Fan yo'nalishi: ${params.subjectHint}.` : ''}`

  let lastError = ''
  for (const model of VISION_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userPrompt },
                  {
                    inlineData: {
                      mimeType: params.mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: PHOTO_SOLVE_RESPONSE_SCHEMA,
              temperature: 0.2,
              maxOutputTokens: 3000,
            },
          }),
        },
      )

      clearTimeout(timeout)

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        lastError = `${model} HTTP ${res.status}: ${errBody.slice(0, 150)}`
        console.warn(`[tutor.service] ${lastError}`)
        continue
      }

      const json = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        lastError = `${model} returned empty content`
        continue
      }

      // JSON parsing & normalization
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(cleaned)
      }

      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>
        if (!p.detectedSubject && p.subject) p.detectedSubject = String(p.subject)
        if (!p.ocrText && p.text) p.ocrText = String(p.text)
        if (!p.subjectName && p.detectedSubject) p.subjectName = String(p.detectedSubject)
        if (!p.finalAnswer && p.answer) p.finalAnswer = String(p.answer)
        if (!Array.isArray(p.steps)) p.steps = []
        if (!p.keyConcept) p.keyConcept = "Asosiy qoida"
      }

      const validated = PhotoSolveResultSchema.safeParse(parsed)
      if (validated.success) {
        return validated.data
      } else {
        lastError = `${model} JSON schema mismatch: ${validated.error.message}`
        console.warn(`[tutor.service] ${lastError}`)
      }
    } catch (err: unknown) {
      clearTimeout(timeout)
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[tutor.service] ${model} fetch failed:`, lastError)
    }
  }

  throw new AppError(503, "Sun'iy intellekt xizmati vaqtincha band yoki rasmdagi matnni o'qib bo'lmadi. Iltimos, qayta urinib ko'ring.")
}

/**
 * Sokratik dialog promptini generatsiya qilish.
 */
export function buildSocraticPrompt(
  context: SocraticContext,
  language: 'uz' | 'ru',
): string {
  const isRu = language === 'ru'
  const ctxParts: string[] = []

  if (context.subjectId) ctxParts.push(`Предмет/Fan: ${context.subjectId}`)
  if (context.topicName) ctxParts.push(`Тема/Mavzu: ${context.topicName}`)
  if (context.questionText) ctxParts.push(`Вопрос/Savol: ${context.questionText}`)
  if (context.options) {
    const opts = Object.entries(context.options).map(([k, v]) => `${k}) ${v}`).join('\n')
    ctxParts.push(`Варианты/Variantlar:\n${opts}`)
  }
  if (context.userSelectedOption) ctxParts.push(`Ответ ученика/O'quvchi tanlagan javob: ${context.userSelectedOption}`)
  if (context.correctAnswer) ctxParts.push(`Правильный ответ/To'g'ri javob: ${context.correctAnswer}`)

  const contextBlock = ctxParts.join('\n\n')

  if (isRu) {
    return `Ты — персональный Сократический репетитор платформы Kivvi.
Твоя цель — НЕ просто выдать готовый ответ, а развить мышление ученика с помощью наводящих вопросов (метод Сократа).

КОНТЕКСТ ВОПРОСА:
${contextBlock}

ПРАВИЛА ОБЩЕНИЯ:
1. Если ученик ошибся или не понимает — не ругай. Спроси его о ключевом понятии или правиле, которое здесь применимо.
2. Подсказывай аккуратно, шаг за шагом.
3. Если ученик сам догадался — похвали и закрепи вывод.
4. Если ученик прямо умоляет: "Объясни полностью / Скажи ответ" — объясни решение целиком, но доступно.
5. Формулы оформляй через LaTeX: $...$.
6. Держи реплики живыми, емкими (не более 100-150 слов за реплику), без лишней воды.`
  }

  return `Siz — Kivvi platformasining shaxsiy Sokratik repetitorisiz.
Sizning asosiy maqsadingiz — o'quvchiga darhol tayyor javobni aytib qo'yish EMAS, balki yo'naltiruvchi savollar orqali o'quvchini to'g'ri fikrlashga va yechimni o'zi topishiga yetaklash (Sokrat metodi).

SAVOL VA VAZIFANING KONTEKSTI:
${contextBlock}

MULOQOT QOIDALARI:
1. O'quvchi xato qilgan bo'lsa yoki tushunmasa — koyimang, dalda bering. Savoldagi asosiy qonun yoki formula haqida yo'naltiruvchi savol bering.
2. Har bir xabarda 1 ta aniq qadamni muhokama qiling. Juda uzun yozmang (100-150 so'zdan oshmasin).
3. Agar o'quvchi to'g'ri yo'nalishni topsa — qisqacha maqtang va keyingi qadamga o'ting.
4. Agar o'quvchi "To'liq tushuntirib ber / Javobni ayt" desa — qadamma-qadam to'liq yechimni tushuntiring.
5. Barcha matematik va fizik formulalarni LaTeX formatida yozing: satr ichida $...$, alohida formulalar $$...$$.
6. O'zbek tilida (lotin yozuvida), juda samimiy, sabrli va professional ustoz ohangida gapiring.`
}

/**
 * Sokratik dialog javobini Gemini orqali SSE oqimi ko'rinishida uzatish.
 */
export async function streamSocraticChatResponse(params: {
  messages: SocraticMessage[]
  context: SocraticContext
  language: 'uz' | 'ru'
  signal: AbortSignal
  onChunk: (textChunk: string) => void
}): Promise<void> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, "AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)")
  }

  const systemInstruction = buildSocraticPrompt(params.context, params.language)

  // Gemini contents formati: { role: 'user' | 'model', parts: [{ text }] }
  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  let lastError = ''
  for (const model of CHAT_MODELS) {
    if (params.signal.aborted) return
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal: params.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
        },
      )

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        lastError = `${model} ${res.status}: ${errText.slice(0, 100)}`
        console.warn(`[tutor.service chat] ${lastError}`)
        if (res.status === 429) continue
        break
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done || params.signal.aborted) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''
        for (const line of parts) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const json = trimmed.slice(5).trim()
          if (!json || json === '[DONE]') continue
          try {
            const obj = JSON.parse(json) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
            const chunkText = obj?.candidates?.[0]?.content?.parts?.[0]?.text
            if (chunkText) {
              params.onChunk(chunkText)
            }
          } catch { /* parse error ignored for partial chunk */ }
        }
      }

      return // stream successful
    } catch (err: unknown) {
      if (params.signal.aborted) return
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[tutor.service chat] ${model} failed:`, lastError)
    }
  }

  throw new AppError(502, `AI javob berishda xatolik (${lastError.slice(0, 60)})`)
}
