/**
 * AI Question Generator Service (Google Gemini Flash)
 * Generates high-quality exam/quiz questions from custom text or topic concepts.
 */

import { z } from 'zod'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'

export const GenerateQuestionsInputSchema = z.object({
  mode: z.enum(['custom_text', 'topic']),
  subjectId: z.string().min(1),
  subjectName: z.string().optional(),
  promptText: z.string().min(3).max(15_000),
  count: z.number().int().min(1).max(30).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('medium'),
  language: z.enum(['uz', 'ru', 'both']).default('both'),
})

export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsInputSchema>

export interface GeneratedQuestionItem {
  questionUz: string
  questionRu: string
  optionsUz: Array<{ id: string; text: string }>
  optionsRu: Array<{ id: string; text: string }>
  correctAnswer: string // e.g. "A1"
  explanation?: string
}

export async function generateAiQuestions(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestionItem[]> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, "AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)")
  }

  const subjectTitle = input.subjectName || input.subjectId.toUpperCase()
  const isCustomText = input.mode === 'custom_text'

  const systemInstruction = `Siz ${subjectTitle} fani bo'yicha professional test tuzuvchi va ekspert o'qituvchisiz.
Sizning vazifangiz taqdim etilgan ${isCustomText ? "matn / konspekt" : "mavzu"} asosida aniq, mantiqiy va 4 ta javob variantiga ega bo'lgan ${input.count} ta sifatli test savolini tuzish.

QOIDALAR:
1. Har bir savol uchun 4 ta javob varianti (A1, A2, A3, A4) bo'lishi SHART.
2. Faqat 1 ta to'g'ri javob bo'lishi va u "correctAnswer" maydonida ko'rsatilishi kerak (masalan "A1", "A2", "A3" yoki "A4").
3. Savol va variantlar ham o'zbek tilida (questionUz, optionsUz), ham rus tilida (questionRu, optionsRu) professional tarzda tarjima qilingan bo'lsin.
4. Javob variantlarining id qiymatlari mos ravishda A1, A2, A3, A4 bo'lishi shart.
5. Qiyinchilik darajasi: ${input.difficulty}.
${isCustomText ? "6. SAVOLLARNI FAQAT VA FAQAT BERILGAN MATNDAGI FAKTLAR VA QOIDALAR ASOSIDA TUZING." : ""}

JAVOB FORMATI:
Faqat va faqat quyidagi JSON massiv formatida javob qaytaring (hech qanday markdown \`\`\`json belgisiz, toza JSON):
[
  {
    "questionUz": "Savol matni o'zbekcha...",
    "questionRu": "Savol matni ruscha...",
    "optionsUz": [
      { "id": "A1", "text": "1-variant" },
      { "id": "A2", "text": "2-variant" },
      { "id": "A3", "text": "3-variant" },
      { "id": "A4", "text": "4-variant" }
    ],
    "optionsRu": [
      { "id": "A1", "text": "1-вариант" },
      { "id": "A2", "text": "2-вариант" },
      { "id": "A3", "text": "3-вариант" },
      { "id": "A4", "text": "4-вариант" }
    ],
    "correctAnswer": "A1",
    "explanation": "Nega aynan shu javob to'g'ri ekanligi tushuntirishi..."
  }
]`

  const userPrompt = isCustomText
    ? `Quyidagi darslik matni / konspekt asosida ${input.count} ta test savolini tuzing:\n\n---\n${input.promptText}\n---`
    : `Quyidagi mavzu bo'yicha ${input.count} ta test savolini tuzing: "${input.promptText}" (Fan: ${subjectTitle})`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 75_000)

  const modelsToTry = ['gemini-flash-latest', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-exp', 'gemini-pro-latest']
  let apiRes: Response | null = null
  let lastErrorText = ''

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
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
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
              temperature: 0.4,
            },
          }),
        }
      )

      if (response.ok) {
        apiRes = response
        break
      } else {
        lastErrorText = await response.text().catch(() => '')
        console.warn(`[ai-question-generator] Model ${model} failed (${response.status}):`, lastErrorText.slice(0, 200))
        if (response.status === 429) {
          throw new AppError(429, "Gemini API kunlik kvotasi yetarli emas. Birozdan so'ng qayta urinib ko'ring.")
        }
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      console.warn(`[ai-question-generator] Request error for ${model}:`, err?.message || err)
    }
  }

  clearTimeout(timeout)

  if (!apiRes) {
    throw new AppError(500, `AI xizmati bilan bog'lanib bo'lmadi: ${lastErrorText.slice(0, 100)}`)
  }

  const rawJson = await apiRes.json()
  const textContent = rawJson.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textContent) {
    throw new AppError(500, "AI dan bo'sh javob qaytdi")
  }

  let parsedQuestions: any[]
  try {
    const parsed = JSON.parse(textContent)
    parsedQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || [])
  } catch {
    console.error('[ai-question-generator] JSON parse error:', textContent.slice(0, 300))
    throw new AppError(500, "AI javobini JSON formatida o'qib bo'lmadi")
  }

  if (!Array.isArray(parsedQuestions)) {
    throw new AppError(500, "AI javobi ro'yxat shaklida kelmadi")
  }

  // Sanitize and validate questions
  const sanitized: GeneratedQuestionItem[] = []
  for (const q of parsedQuestions) {
    if (!q.questionUz && !q.questionRu) continue

    const optsUz = Array.isArray(q.optionsUz) ? q.optionsUz : []
    const optsRu = Array.isArray(q.optionsRu) ? q.optionsRu : []

    // Ensure options format
    const validOptsUz = optsUz.map((opt: any, idx: number) => ({
      id: opt.id || `A${idx + 1}`,
      text: String(opt.text || `Variant ${idx + 1}`).trim(),
    }))

    const validOptsRu = optsRu.map((opt: any, idx: number) => ({
      id: opt.id || `A${idx + 1}`,
      text: String(opt.text || `Вариант ${idx + 1}`).trim(),
    }))

    // Must have at least 2 options and valid correctAnswer
    if (validOptsUz.length < 2) continue

    const correct = String(q.correctAnswer || '').trim()
    if (!validOptsUz.some((o: any) => o.id === correct)) {
      continue // Skip invalid question rather than defaulting to arbitrary A1
    }

    sanitized.push({
      questionUz: String(q.questionUz || q.questionRu || '').trim(),
      questionRu: String(q.questionRu || q.questionUz || '').trim(),
      optionsUz: validOptsUz,
      optionsRu: validOptsRu.length > 0 ? validOptsRu : validOptsUz,
      correctAnswer: correct,
      explanation: q.explanation ? String(q.explanation).trim() : undefined,
    })
  }

  if (sanitized.length === 0) {
    throw new AppError(500, "Hech qanday to'g'ri formatdagi savol shakllantirilmadi")
  }

  return sanitized
}
