/**
 * Math Board — qo'lyozma recognition servisi (Faza 4, Gemini Vision proxy).
 *
 * Client'da API kalit YO'Q (tuzatish #1): Gemini chaqiruvi FAQAT shu yerda.
 * Model fallback ro'yxati tutor.service'dagi VISION_MODELS bilan bir xil
 * (ataylab lokal nusxa — modullararo import cycle riski yo'q).
 */

import { config } from '../../config'
import { AppError } from '../../middleware/error-handler'

const VISION_MODELS = [
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
] as const

const TIMEOUT_MS = 60_000

export interface RecognitionServiceResult {
  latex: string
  alternatives: string[]
  confidence: number
}

/**
 * Gemini xom javobidan {latex, alternatives, confidence} ajratadi.
 * Sof funksiya — unit testda network'siz qoplanadi.
 */
export function parseRecognitionJson(raw: string): RecognitionServiceResult {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AppError(502, 'AI javobi parse qilinmadi')
  }
  if (!parsed || typeof parsed !== 'object') throw new AppError(502, 'AI javobi parse qilinmadi')
  const obj = parsed as Record<string, unknown>
  const latex = typeof obj.latex === 'string' ? obj.latex.trim() : ''
  if (!latex) throw new AppError(502, 'AI formulani tanimadi')
  const alternatives = Array.isArray(obj.alternatives)
    ? obj.alternatives.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 3)
    : []
  const confidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
    ? Math.min(1, Math.max(0, obj.confidence))
    : 0.5
  return { latex, alternatives, confidence }
}

const SYSTEM_UZ = `Sen qo'lyozma matematik ifodalarni LaTeX'ga o'giruvchi transkribersan.
Rasmda BITTA qo'lda yozilgan matematik ifoda/tenglama bor (doska/qog'oz surati).
Vazifang: uni aniq LaTeX'da qaytar. YECHMA, izohama, faqat transkripsiya.
Javob FAQAT strict JSON bo'lsin (markdown fence'siz):
{"latex": "<asosiy variant>", "alternatives": ["<muqobil 1>", "<muqobil 2>"], "confidence": 0.0-1.0}
Qoidalar: kasrlar \\frac{}{}, ildiz \\sqrt{}, logarifm \\log_{asos}(arg), daraja ^{}, ko'paytirish \\cdot.
Noaniq belgi bo'lsa alternatives'ga yoz, confidence'ni pasaytir.`

const SYSTEM_RU = `Ты транскрибер рукописных математических выражений в LaTeX.
На изображении ОДНО рукописное математическое выражение/уравнение (доска/бумага).
Задача: вернуть его точный LaTeX. НЕ РЕШАЙ, без объяснений, только транскрипция.
Ответ — СТРОГО JSON (без markdown fences):
{"latex": "<основной вариант>", "alternatives": ["<вариант 1>", "<вариант 2>"], "confidence": 0.0-1.0}
Правила: дроби \\frac{}{}, корень \\sqrt{}, логарифм \\log_{основание}(арг), степень ^{}, умножение \\cdot.
Неясный символ — в alternatives, confidence ниже.`

export async function recognizeHandwriting(params: {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  category?: string
  language?: 'uz' | 'ru'
}): Promise<RecognitionServiceResult> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, 'AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)')
  }

  const lang = params.language ?? 'uz'
  const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '').trim()
  const userPrompt = lang === 'ru'
    ? `Транскрибируй формулу.${params.category ? ` Категория: ${params.category}.` : ''}`
    : `Formulani transkripsiya qil.${params.category ? ` Kategoriya: ${params.category}.` : ''}`

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
            systemInstruction: { parts: [{ text: lang === 'ru' ? SYSTEM_RU : SYSTEM_UZ }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userPrompt },
                  { inlineData: { mimeType: params.mimeType, data: cleanBase64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: 'application/json',
            },
          }),
        },
      )

      clearTimeout(timeout)

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        lastError = `${model} HTTP ${res.status}: ${errBody.slice(0, 150)}`
        continue
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text.trim()) {
        lastError = `${model}: bo'sh javob`
        continue
      }
      return parseRecognitionJson(text)
    } catch (e) {
      clearTimeout(timeout)
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  throw new AppError(502, `AI tanimadi (${lastError.slice(0, 80)})`)
}

/**
 * Sokratik hint (Faza 5) — BITTA qisqa yo'naltiruvchi savol, javob YO'Q.
 * Client lokal hint topa olmaganda yoki xato takrorlanganda chaqiradi.
 */
export async function askBoardHint(params: {
  problemId: string
  promptLatex: string
  assumptions: string[]
  acceptedSteps: string[]
  candidateStep: string
  checkStatus: string
  checkDetail: string
  knownBlockIds: string[]
  language?: 'uz' | 'ru'
}): Promise<{ question: string; highlightBlockId?: string }> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, 'AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)')
  }

  const lang = params.language ?? 'uz'
  const system = lang === 'ru'
    ? `Ты сократский репетитор по математике. Ученик решает задачу по шагам и ошибся.
Верни СТРОГО JSON (без markdown fences):
{"question": "<РОВНО ОДИН короткий наводящий вопрос, 1–2 предложения>", "highlightBlockId": "<id блока из списка или null>"}
Правила: вопрос подталкивает найти ошибку САМОМУ; ответ и решение ЗАПРЕЩЕНЫ; только вопрос, без вступлений. Если ошибка связана с конкретным блоком доски — верни его blockId из списка, иначе null.`
    : `Sen Sokratik matematika repetitorisan. O'quvchi masalani qadam-baqadam yechib xato qildi.
QAT'IY JSON qaytar (markdown fence'siz):
{"question": "<ROVNO BITTA qisqa yo'naltiruvchi savol, 1–2 jumla>", "highlightBlockId": "<ro'yxatdagi blok id yoki null>"}
Qoidalar: savol xatoni O'ZI topishga undasin; javob va yechim TAQIQLANADI; faqat savol, kirish so'zlarsiz. Xato doskaning aniq blokiga tegishli bo'lsa — ro'yxatdan o'sha blockId'ni qaytar, aks holda null.`

  const steps = params.acceptedSteps.slice(-6).join('\n')
  const assumptions = params.assumptions.length > 0 ? params.assumptions.join('; ') : '—'
  const userPrompt = lang === 'ru'
    ? `Задача (${params.problemId}): ${params.promptLatex}\nДопущения: ${assumptions}\nВерные шаги:\n${steps || '(нет)'}\nТекущий неверный шаг: ${params.candidateStep}\nСтатус: ${params.checkStatus}/${params.checkDetail}\nБлоки доски: ${params.knownBlockIds.join(', ') || '(нет)'}`
    : `Masala (${params.problemId}): ${params.promptLatex}\nAssumptions: ${assumptions}\nTo'g'ri qadamlar:\n${steps || '(yo‘q)'}\nJoriy xato qadam: ${params.candidateStep}\nStatus: ${params.checkStatus}/${params.checkDetail}\nDoska bloklari: ${params.knownBlockIds.join(', ') || '(yo‘q)'}`

  let lastError = ''
  for (const model of VISION_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
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
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
          }),
        },
      )
      clearTimeout(timeout)
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        lastError = `${model} HTTP ${res.status}: ${errBody.slice(0, 150)}`
        continue
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      const parsed = parseHintResponse(text, params.knownBlockIds)
      if (!parsed) {
        lastError = `${model}: bo'sh/yaroqsiz javob`
        continue
      }
      return parsed
    } catch (e) {
      clearTimeout(timeout)
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  throw new AppError(502, `AI javob bermadi (${lastError.slice(0, 80)})`)
}

/**
 * Hint JSON validatsiyasi (Faza 5 structured response):
 * {question, highlightBlockId?} — question sanitize'dan o'tishi shart,
 * highlightBlockId faqat known ro'yxatdag bo'lsa qabul qilinadi.
 * Yaroqsiz → null (keyingi model / fallback).
 */
export function parseHintResponse(raw: string, knownBlockIds: string[]): { question: string; highlightBlockId?: string } | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.question !== 'string') return null
  const question = sanitizeHintQuestion(obj.question)
  if (!question) return null
  const out: { question: string; highlightBlockId?: string } = { question }
  if (typeof obj.highlightBlockId === 'string'
    && obj.highlightBlockId.length > 0
    && obj.highlightBlockId.length <= 64
    && knownBlockIds.includes(obj.highlightBlockId)) {
    out.highlightBlockId = obj.highlightBlockId
  }
  return out
}

// ── Blokli recognition (Faza 4) ──────────────────────────────────────────

export interface BlockImageInput {
  blockId: string
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface BlockRecognitionResult {
  blockId: string
  type: 'equation' | 'text'
  latex: string
  confidence: number
  alternatives: string[]
}

const BLOCK_ITEM_FALLBACK: Omit<BlockRecognitionResult, 'blockId'> = {
  type: 'text',
  latex: '',
  confidence: 0,
  alternatives: [],
}

/**
 * Gemini blokli javobini parse qiladi — QAT'IY schema, per-block fail-closed.
 * Top-level array bo'lmasa → 502 (hamma blok client'da failed).
 * Ayrim item yaroqsiz bo'lsa → faqat o'sha blok failed entry oladi.
 */
export function parseBlockResults(raw: string, expectedIds: string[]): BlockRecognitionResult[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AppError(502, 'AI javobi parse qilinmadi')
  }
  const arr = Array.isArray(parsed) ? parsed : (parsed as { results?: unknown }).results
  if (!Array.isArray(arr)) throw new AppError(502, 'AI javobi parse qilinmadi')
  const byId = new Map<string, BlockRecognitionResult>()
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (typeof obj.blockId !== 'string' || !obj.blockId) continue
    const latex = typeof obj.latex === 'string' ? obj.latex.trim() : ''
    if (!latex) {
      byId.set(obj.blockId, { ...BLOCK_ITEM_FALLBACK, blockId: obj.blockId })
      continue
    }
    byId.set(obj.blockId, {
      blockId: obj.blockId,
      type: obj.type === 'text' ? 'text' : 'equation',
      latex,
      confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
        ? Math.min(1, Math.max(0, obj.confidence))
        : 0.5,
      alternatives: Array.isArray(obj.alternatives)
        ? obj.alternatives.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 3)
        : [],
    })
  }
  // So'ralgan id'lar tartibida; javobda yo'q blok → failed
  return expectedIds.map((id) => byId.get(id) ?? { ...BLOCK_ITEM_FALLBACK, blockId: id })
}

const BLOCKS_SYSTEM_UZ = `Sen qo'lyozma matematik ifodalarni LaTeX'ga o'giruvchi transkribersan.
Senga BIR NECHTA rasm keladi — har biri bitta qo'lda yozilgan matematik qator (doska bloklari, tartibda).
Har rasm uchun alohida transkripsiya qil. YECHMA, izohama — faqat transkripsiya.
Javob FAQAT strict JSON ARRAY bo'lsin (markdown fence'siz), rasm tartibida:
[{"blockId": "<so'rovdagi id>", "type": "equation", "latex": "<LaTeX>", "confidence": 0.0-1.0, "alternatives": []}]
Qoidalar: kasrlar \\frac{}{}, ildiz \\sqrt{}, logarifm \\log_{asos}(arg), daraja ^{}. O'qib bo'lmaydigan blokda latex bo'sh string bo'lsin.`

const BLOCKS_SYSTEM_RU = `Ты транскрибер рукописных математических выражений в LaTeX.
Тебе придёт НЕСКОЛЬКО изображений — каждое это одна рукописная математическая строка (блоки доски, по порядку).
Транскрибируй каждое отдельно. НЕ РЕШАЙ, без объяснений — только транскрипция.
Ответ — СТРОГО JSON ARRAY (без markdown fences), в порядке изображений:
[{"blockId": "<id из запроса>", "type": "equation", "latex": "<LaTeX>", "confidence": 0.0-1.0, "alternatives": []}]
Правила: дроби \\frac{}{}, корень \\sqrt{}, логарифм \\log_{основание}(арг), степень ^{}. Нечитаемый блок — latex пустая строка.`

/**
 * Bir Gemini chaqiruvida N blok (bitta snapshot o'rniga).
 * Rasmlar parts ketma-ketligida, prompt'da blockId ro'yxati.
 */
export async function recognizeBlockImages(params: {
  blocks: BlockImageInput[]
  category?: string
  language?: 'uz' | 'ru'
}): Promise<BlockRecognitionResult[]> {
  const key = config.ai.geminiApiKey
  if (!key) {
    throw new AppError(503, 'AI xizmati vaqtincha mavjud emas (GEMINI_API_KEY sozlanmagan)')
  }
  if (params.blocks.length === 0) return []
  if (params.blocks.length > 10) throw new AppError(400, 'bloklar_soni_cheklangan')

  const lang = params.language ?? 'uz'
  const ids = params.blocks.map((b) => b.blockId)
  const userPrompt = lang === 'ru'
    ? `Блоки по порядку: ${ids.map((id, i) => `рисунок ${i + 1} = blockId "${id}"`).join('; ')}.${params.category ? ` Категория: ${params.category}.` : ''}`
    : `Bloklar tartibda: ${ids.map((id, i) => `${i + 1}-rasm = blockId "${id}"`).join('; ')}.${params.category ? ` Kategoriya: ${params.category}.` : ''}`

  const parts: unknown[] = [{ text: userPrompt }]
  for (const b of params.blocks) {
    parts.push({
      inlineData: {
        mimeType: b.mimeType,
        data: b.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '').trim(),
      },
    })
  }

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
            systemInstruction: { parts: [{ text: lang === 'ru' ? BLOCKS_SYSTEM_RU : BLOCKS_SYSTEM_UZ }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2000,
              responseMimeType: 'application/json',
            },
          }),
        },
      )

      clearTimeout(timeout)

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        lastError = `${model} HTTP ${res.status}: ${errBody.slice(0, 150)}`
        continue
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text.trim()) {
        lastError = `${model}: bo'sh javob`
        continue
      }
      return parseBlockResults(text, ids)
    } catch (e) {
      clearTimeout(timeout)
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  throw new AppError(502, `AI tanimadi (${lastError.slice(0, 80)})`)
}

/**
 * Hint javobi server-side validatsiyasi (review qo'shimcha + P2-E):
 * "bitta Sokratik savol" — fail-closed:
 *  - bullet/quote/fence tozalanadi, whitespace ixchamlanadi, 500 cap;
 *  - ROVNO BITTA `?` bo'lishi va `?` bilan tugashi shart (ko'p-savol → null);
 *  - `=` bo'lmasligi shart (deklarativ yechim/tenglama → null).
 * Yaroqsiz → null (caller 502 → client deterministik fallback'ga tushadi,
 * kvota yeyilmaydi).
 */
export function sanitizeHintQuestion(raw: string): string | null {
  const cleaned = raw
    .replace(/^```(?:json|markdown|md)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .replace(/^["'«»“”]+|["'«»“”]+$/g, '')
    .replace(/^\s*[-*•]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
  if (cleaned.length < 3) return null
  const questions = (cleaned.match(/\?/g) ?? []).length
  if (questions !== 1 || !cleaned.endsWith('?')) return null
  if (cleaned.includes('=')) return null
  return cleaned
}
