/**
 * Math Board — recognition provider-agnostic interfeyslar (Faza 1 skelet).
 *
 * Qoida: Faza 1'da Gemini/MyScript IMPLEMENTATSIYA YO'Q — faqat type/interface.
 * Provider tanlash Faza 0 spike natijasiga ko'ra (Faza 4'da adapterlar keladi).
 * Spike metrikasi: raw LaTeX string EMAS, normalized AST equivalence.
 */

/** Recognition manbai — adapter qaysi provider'dan kelganini bildiradi */
export type RecognitionProvider = 'manual' | 'gemini' | 'myscript' | 'mlkit'

/** Bitta tanish natijasi — har doim editable confirmation'dan o'tadi */
export interface RecognitionResult {
  latex: string
  alternatives: string[]
  confidence?: number
  provider: RecognitionProvider
}

/** Adapter kontrakти — Faza 4'da har provider shu interfeysni implement qiladi */
export interface RecognitionAdapter {
  readonly provider: RecognitionProvider
  /** Foydalanuvchi "Tanish" tugmasini bosgandagina chaqiriladi (avto-yuborish YO'Q) */
  recognize: (input: RecognitionInput) => Promise<RecognitionResult>
}

export interface RecognitionInput {
  /** Stroke snapshot (PNG data URL) yoki stroke payload — provider-agnostic */
  imageDataUrl?: string
  /** Qo'lda kiritilgan LaTeX (manual adapter uchun) */
  manualLatex?: string
  /** Spike dataset kategoriyasi: algebra | fraction | root | power | logarithm */
  category?: RecognitionCategory
}

export type RecognitionCategory = 'algebra' | 'fraction' | 'root' | 'power' | 'logarithm'
