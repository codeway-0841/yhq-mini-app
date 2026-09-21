/**
 * Math Board — recognition adapterlar (Faza 4).
 *
 * - `manual`: qo'lda MathLive kiritish (echo, network YO'Q).
 * - `gemini`: server proxy (`POST /api/math-board/recognize`) — kalit
 *   client'da YO'Q; faqat foydalanuvchi "Tanish" tugmasini bosganda chaqiriladi
 *   (avto-yuborish YO'Q). Natija har doim editable confirmation'dan o'tadi.
 * - `myscript` / `mlkit`: Faza 0 spike tanlovigacha YO'Q (registry'da yo'q —
 *   UI faqat mavjud adapterlarni taklif qiladi).
 */

import { api } from '../../../shared/api'
import type {
  RecognitionAdapter,
  RecognitionInput,
  RecognitionResult,
} from './types'

const manualAdapter: RecognitionAdapter = {
  provider: 'manual',
  recognize: async (input: RecognitionInput): Promise<RecognitionResult> => {
    const latex = (input.manualLatex ?? '').trim()
    if (!latex) throw new Error('empty_manual_input')
    return { latex, alternatives: [], provider: 'manual' }
  },
}

const geminiAdapter: RecognitionAdapter = {
  provider: 'gemini',
  recognize: async (input: RecognitionInput): Promise<RecognitionResult> => {
    if (!input.imageDataUrl) throw new Error('missing_snapshot')
    const mimeType = input.imageDataUrl.startsWith('data:image/jpeg')
      ? 'image/jpeg'
      : input.imageDataUrl.startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/png'
    const res = await api.recognizeHandwriting({
      image: input.imageDataUrl,
      mimeType,
      category: input.category,
    })
    return {
      latex: res.latex,
      alternatives: res.alternatives,
      confidence: res.confidence,
      provider: 'gemini',
    }
  },
}

const REGISTRY: Record<string, RecognitionAdapter> = {
  manual: manualAdapter,
  gemini: geminiAdapter,
}

/** Mavjud adapter — bo'lmasa null (UI faqat mavjudlarni ko'rsatadi) */
export function getAdapter(provider: string): RecognitionAdapter | null {
  return REGISTRY[provider] ?? null
}

export function availableProviders(): string[] {
  return Object.keys(REGISTRY)
}

export interface BlockRecognitionInput {
  blockId: string
  imageDataUrl: string
}

export interface BlockRecognitionOutput {
  blockId: string
  type: 'equation' | 'text'
  latex: string
  confidence: number
  alternatives: string[]
}

/**
 * Blokli recognition (Faza 4): bitta server chaqiruvida N blok.
 * Faqat o'zgargan/unrecognized bloklar yuboriladi (caller filtrlaydi).
 */
export async function recognizeBlocks(
  blocks: BlockRecognitionInput[],
  opts?: { category?: string; language?: 'uz' | 'ru' },
): Promise<BlockRecognitionOutput[]> {
  if (blocks.length === 0) return []
  const res = await api.recognizeBlocks({
    blocks: blocks.map((b) => ({
      blockId: b.blockId,
      image: b.imageDataUrl,
      mimeType: b.imageDataUrl.startsWith('data:image/jpeg')
        ? 'image/jpeg'
        : b.imageDataUrl.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/png',
    })),
    category: opts?.category,
    language: opts?.language,
  })
  return res.results
}
