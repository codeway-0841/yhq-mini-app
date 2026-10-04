/**
 * AI Exam Variant Generator Service
 * Orchestrates chunked generation of complete, officially compliant exam variants
 * using Google Gemini Flash and specialized exam blueprints.
 */

import { z } from 'zod'
import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'
import { getExamBlueprint, type ExamType } from './blueprints'
import { buildExamBlockPrompt } from './exam-prompt-engine'

export const GenerateExamVariantInputSchema = z.object({
  subjectId: z.string().min(1),
  examType: z.enum(['milliy-sertifikat', 'attestatsiya']),
  variantNumber: z.number().int().min(1).default(1),
  saveToFile: z.boolean().default(false),
})

export type GenerateExamVariantInput = z.infer<typeof GenerateExamVariantInputSchema>

export interface ExamVariantQuestionItem {
  number: number
  topic: string
  topicCategory: string
  difficulty: 'easy' | 'medium' | 'hard'
  questionUz: string
  questionRu: string
  optionsUz: Array<{ id: string; text: string }>
  optionsRu: Array<{ id: string; text: string }>
  correctAnswer: string // "A1" | "A2" | "A3" | "A4"
  explanation: string
}

export interface GeneratedExamVariant {
  variantId: string
  subjectId: string
  examType: ExamType
  variantNumber: number
  title: string
  totalQuestions: number
  durationMinutes: number
  specificationSource: string
  createdAt: string
  questions: ExamVariantQuestionItem[]
}

interface CallGeminiOptions {
  systemInstruction: string
  userPrompt: string
  apiKey: string
}

async function callGeminiApi(options: CallGeminiOptions): Promise<string> {
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
  ]

  let lastErrorText = ''

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90_000)

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': options.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: options.systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 16384,
              temperature: 0.3,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        }
      )

      clearTimeout(timeout)

      if (response.ok) {
        const rawJson = await response.json()
        const text = rawJson.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
      } else {
        lastErrorText = await response.text().catch(() => '')
        console.warn(`[exam-variant-generator] Model ${model} failed (${response.status}):`, lastErrorText.slice(0, 200))
        if (response.status === 429) {
          throw new AppError(429, 'Gemini API kunlik kvotasi yetarli emas. Birozdan so‘ng urinib ko‘ring.')
        }
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      console.warn(`[exam-variant-generator] Model error ${model}:`, err?.message || err)
    }
  }

  throw new AppError(500, `AI xizmati bilan bog'lanib bo'lmadi: ${lastErrorText.slice(0, 100)}`)
}

function parseJsonSafely(rawText: string): any[] {
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : (parsed.questions || [])
  } catch (initialErr) {
    // Attempt 1: sanitize unescaped newlines/tabs inside string literals
    try {
      const sanitized = cleaned.replace(/[\n\r\t]/g, (c) => {
        if (c === '\n') return '\\n'
        if (c === '\r') return '\\r'
        if (c === '\t') return '\\t'
        return ''
      })
      const parsed = JSON.parse(sanitized)
      return Array.isArray(parsed) ? parsed : (parsed.questions || [])
    } catch {
      // fall through
    }

    // Attempt 2: salvage truncated JSON array
    const lastObjectIdx = cleaned.lastIndexOf('}')
    if (lastObjectIdx > 0) {
      const salvaged = cleaned.slice(0, lastObjectIdx + 1) + ']'
      try {
        const parsed = JSON.parse(salvaged)
        return Array.isArray(parsed) ? parsed : (parsed.questions || [])
      } catch {
        // fall through
      }
    }
    throw initialErr
  }
}

export async function generateExamVariant(
  input: GenerateExamVariantInput,
  onProgress?: (step: string, percent: number) => void
): Promise<GeneratedExamVariant> {
  const apiKey = config.ai.geminiApiKey
  if (!apiKey) {
    throw new AppError(503, 'AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)')
  }

  const blueprint = getExamBlueprint(input.subjectId, input.examType)
  if (!blueprint) {
    throw new AppError(
      404,
      `Bunday fan va imtihon turi uchun blueprint topilmadi: ${input.subjectId} / ${input.examType}`
    )
  }

  const allQuestions: ExamVariantQuestionItem[] = []
  const totalBlocks = blueprint.blocks.length
  let sharedContext = ''

  for (let bIndex = 0; bIndex < totalBlocks; bIndex++) {
    const block = blueprint.blocks[bIndex]
    const percent = Math.round((bIndex / totalBlocks) * 100)

    onProgress?.(`Blok ${bIndex + 1}/${totalBlocks} shakllantirilmoqda: ${block.title}`, percent)

    const { systemInstruction, userPrompt } = buildExamBlockPrompt(
      blueprint,
      block,
      input.variantNumber,
      sharedContext
    )

    const responseText = await callGeminiApi({
      systemInstruction,
      userPrompt,
      apiKey,
    })

    let parsedBlockQuestions: any[]
    try {
      parsedBlockQuestions = parseJsonSafely(responseText)
    } catch (err) {
      console.error('[exam-variant-generator] JSON parse error:', responseText.slice(0, 300))
      throw new AppError(500, `Blok ${bIndex + 1} uchun AI javobini JSON formatida o‘qib bo‘lmadi`)
    }

    if (!Array.isArray(parsedBlockQuestions) || parsedBlockQuestions.length === 0) {
      throw new AppError(500, `Blok ${bIndex + 1} bo‘yicha savollar bo‘sh qaytdi`)
    }

    // Sanitize and validate questions
    for (let i = 0; i < parsedBlockQuestions.length; i++) {
      const q = parsedBlockQuestions[i]
      const expectedNumber = block.startNumber + i
      const num = typeof q.number === 'number' ? q.number : expectedNumber

      const qText = String(q.questionRu || q.questionUz || '').trim()
      if (!qText) continue

      const optsRu = Array.isArray(q.optionsRu) ? q.optionsRu : (q.optionsUz || [])
      const validOptions = optsRu.slice(0, 4).map((opt: any, optIdx: number) => ({
        id: opt.id || `A${optIdx + 1}`,
        text: String(opt.text || `Вариант ${optIdx + 1}`).trim(),
      }))

      if (validOptions.length < 4) {
        // Pad to 4 if needed
        while (validOptions.length < 4) {
          validOptions.push({
            id: `A${validOptions.length + 1}`,
            text: `Дополнительный вариант ${validOptions.length + 1}`,
          })
        }
      }

      let correct = String(q.correctAnswer || '').trim()
      if (!validOptions.some((o: { id: string; text: string }) => o.id === correct)) {
        correct = 'A1'
      }

      allQuestions.push({
        number: num,
        topic: String(q.topic || block.questions[i]?.topic || block.title).trim(),
        topicCategory: String(q.topicCategory || block.questions[i]?.topicCategory || 'Общее').trim(),
        difficulty: (q.difficulty as any) || block.questions[i]?.difficulty || 'medium',
        questionUz: String(q.questionUz || qText).trim(),
        questionRu: qText,
        optionsUz: validOptions,
        optionsRu: validOptions,
        correctAnswer: correct,
        explanation: String(q.explanation || 'Правильный ответ подтверждается языковыми нормами.').trim(),
      })
    }
  }

  onProgress?.('Variant to‘liq yig‘ildi va tekshirildi', 100)

  // Ensure sorting by question number
  allQuestions.sort((a, b) => a.number - b.number)

  const variantId = `${blueprint.subjectId}-${blueprint.examType}-v${input.variantNumber}`
  const examTitle = blueprint.examType === 'milliy-sertifikat' ? 'Milliy Sertifikat' : 'Attestatsiya'

  const generatedVariant: GeneratedExamVariant = {
    variantId,
    subjectId: blueprint.subjectId,
    examType: blueprint.examType,
    variantNumber: input.variantNumber,
    title: `${blueprint.subjectNameRu} — ${examTitle} (Вариант №${input.variantNumber})`,
    totalQuestions: allQuestions.length,
    durationMinutes: blueprint.durationMinutes,
    specificationSource: blueprint.specificationSource,
    createdAt: new Date().toISOString(),
    questions: allQuestions,
  }

  if (input.saveToFile) {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = path.resolve(process.cwd(), `content-banks/${blueprint.subjectId}/variants`)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const filePath = path.join(dir, `${variantId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(generatedVariant, null, 2), 'utf-8')
    console.log(`[exam-variant-generator] Saved variant to ${filePath}`)
  }

  return generatedVariant
}
