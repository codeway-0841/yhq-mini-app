/**
 * Rasmiy AI Imtihon Variantlari Katalogi (SSOT).
 *
 * JSON fayllar to'g'ridan-to'g'ri import qilinadi, shuning uchun esbuild
 * ularni bundle ichiga oladi. Natijada Vercel serverless lambda muhitida
 * fayl tizimidagi nisbiy yo'llar yo'qolib qolishi xavfi 0 ga teng bo'ladi.
 */

import russianVariant1 from '../../../content-banks/rustili/variants/rustili-milliy-sertifikat-v1.json'

export interface AiVariantMeta {
  variantId: string
  subjectId: string
  examType: string
  variantNumber: number
  title: string
  totalQuestions: number
  durationMinutes: number
  specificationSource: string
  createdAt: string
}

export interface AiVariantQuestion {
  number: number
  topic: string
  topicCategory: string
  difficulty: string
  questionUz: string
  questionRu: string
  optionsUz: Array<{ id: string; text: string }>
  optionsRu: Array<{ id: string; text: string }>
  correctAnswer: string
  explanation: string
}

export interface AiVariantFull extends AiVariantMeta {
  questions: AiVariantQuestion[]
}

const STATIC_VARIANTS: AiVariantFull[] = [
  russianVariant1 as unknown as AiVariantFull,
]

export function getCatalogVariants(subjectId?: string): AiVariantMeta[] {
  const list = subjectId
    ? STATIC_VARIANTS.filter((v) => v.subjectId === subjectId)
    : STATIC_VARIANTS

  return list.map((v) => ({
    variantId: v.variantId,
    subjectId: v.subjectId,
    examType: v.examType,
    variantNumber: v.variantNumber,
    title: v.title,
    totalQuestions: v.totalQuestions || v.questions.length,
    durationMinutes: v.durationMinutes,
    specificationSource: v.specificationSource,
    createdAt: v.createdAt,
  }))
}

export function getCatalogVariantById(variantId: string): AiVariantFull | undefined {
  return STATIC_VARIANTS.find((v) => v.variantId === variantId)
}
