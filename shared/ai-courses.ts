/**
 * AI KURSLAR (Wondering-style user-created courses) — YAGONA MANBA.
 *
 * Foydalanuvchi istagan mavzuda kurs yaratadi (mavzu/link/PDF/suhbat),
 * tizim outline (Section → Lesson) + sahifalar + mashqlar + bilim kartalari
 * tayyorlaydi. MVP'da generatsiya — deterministik MOCK provider
 * (server/modules/ai-courses/mock-provider.ts); real Gemini keyingi bosqich.
 *
 * Struktura (Wondering 1:1):
 *   Course → Section[] → Lesson[] → { tldr, pages[], practices[], knowledgeCards[] }
 *   pages: text | visual (chart stillar)
 *   practices: flashcard | mcq | cloze (Click & Fill) | order (Order Steps)
 *
 * QOIDALAR:
 * - Javob kalitlari FAQAT serverda: toPublicCourseLesson() strip qiladi
 *   (scoring trust boundary — ai-daily-test.ts pattern'i).
 * - Tartib-osiladigan mashqlar (mcq options, cloze pool, order steps) public
 *   chiqishda SEEDED shuffle (shuffleSeeded) — javob tartibi sizmasligi uchun.
 * - Coin FAQAT darsni birinchi yakunlashda: AI_COURSE_COINS_PER_LESSON,
 *   ledger reason 'ai_course' + UNIQUE(course, lesson, user) — replay xavfsiz.
 * - Oylik yaratish limiti: free 2 / premium 15 (Tashkent oyi bo'yicha).
 */

import { z } from 'zod'

// ── Konstantalar ─────────────────────────────────────────────────────────────

export const AI_COURSE_FREE_MONTHLY_LIMIT = 2
export const AI_COURSE_PREMIUM_MONTHLY_LIMIT = 15

/** Mock outline o'lchami (real AI kelganda kengayadi — sxema 2..7 section ruxsat beradi) */
export const AI_COURSE_MOCK_SECTIONS = 3
export const AI_COURSE_MOCK_LESSONS_PER_SECTION = 3

/** Darsni birinchi yakunlash uchun coin (javob sifatidan qat'iy nazar — anti-farm: 1 marta) */
export const AI_COURSE_COINS_PER_LESSON = 2

/** Ledger reason (coin_transactions.reason) — ShopPage reasonLabel'da ham bo'ladi */
export const AI_COURSE_LEDGER_REASON = 'ai_course'
export const aiCourseLedgerRef = (courseId: number, lessonId: string, userId: string) =>
  `ai_course:${courseId}:${lessonId}:${userId}`

export const AI_COURSE_INPUT_KINDS = ['topic', 'link', 'pdf', 'chat'] as const
export type AiCourseInputKind = (typeof AI_COURSE_INPUT_KINDS)[number]

export const AI_COURSE_LESSON_LENGTHS = ['short', 'standard', 'deep'] as const
export type AiCourseLessonLength = (typeof AI_COURSE_LESSON_LENGTHS)[number]

/** Quiz tab tiplari (Wondering QUIZ_TABS 1:1 + flashcard) */
export const AI_COURSE_PRACTICE_TYPES = ['flashcard', 'mcq', 'cloze', 'order'] as const
export type AiCoursePracticeType = (typeof AI_COURSE_PRACTICE_TYPES)[number]

/** Vizual blok stillari (MVP renderer: bar-chart, pie-chart, cycle; qolganlari — ro'yxat fallback) */
export const AI_COURSE_VISUAL_STYLES = [
  'bar-chart', 'line-chart', 'pie-chart', 'scatter-plot', 'area-chart', 'cycle', 'infographic',
] as const
export type AiCourseVisualStyle = (typeof AI_COURSE_VISUAL_STYLES)[number]

// ── Zod: sahifa bloklari ─────────────────────────────────────────────────────

const PageTextSchema = z.object({
  kind: z.literal('text'),
  heading: z.string().min(1).max(120),
  body: z.string().min(20).max(2000),
})

const VisualItemSchema = z.object({
  label: z.string().min(1).max(80),
  /** 0..100 (diagram balandligi/ulushi) */
  value: z.number().min(0).max(100),
})

const PageVisualSchema = z.object({
  kind: z.literal('visual'),
  style: z.enum(AI_COURSE_VISUAL_STYLES),
  heading: z.string().min(1).max(120),
  items: z.array(VisualItemSchema).min(2).max(6),
})

export const AiCoursePageSchema = z.discriminatedUnion('kind', [PageTextSchema, PageVisualSchema])

// ── Zod: mashqlar (server payload — javoblar BILAN) ──────────────────────────

const PracticeBase = { id: z.string().min(1), prompt: z.string().min(3).max(500) }

export const AiCourseFlashcardSchema = z.object({
  ...PracticeBase, kind: z.literal('flashcard'),
  /** O'rganish materiali — public'da OCHIQ qoladi (flip-card), baho self-report */
  answer: z.string().min(1).max(500),
})

const PracticeOptionSchema = z.object({ id: z.string().min(1), text: z.string().min(1).max(300) })

export const AiCourseMcqSchema = z.object({
  ...PracticeBase, kind: z.literal('mcq'),
  options: z.array(PracticeOptionSchema).min(3).max(5),
  correctOptionId: z.string().min(1),
})

export const AiCourseClozeSchema = z.object({
  ...PracticeBase, kind: z.literal('cloze'),
  /** `{{c1}}`, `{{c2}}` marker'li shablon */
  template: z.string().min(5).max(500),
  blanks: z.array(z.object({ id: z.string().min(1), answer: z.string().min(1).max(100) })).min(1).max(4),
  /** Tanlash havzasi (to'g'ri javoblar + chalg'ituvchilar) */
  pool: z.array(z.string().min(1).max(100)).min(2).max(8),
})

export const AiCourseOrderSchema = z.object({
  ...PracticeBase, kind: z.literal('order'),
  /** TO'G'RI tartibda (public'da shuffle qilinadi) */
  steps: z.array(z.object({ id: z.string().min(1), text: z.string().min(1).max(200) })).min(3).max(6),
})

export const AiCoursePracticeSchema = z.discriminatedUnion('kind', [
  AiCourseFlashcardSchema, AiCourseMcqSchema, AiCourseClozeSchema, AiCourseOrderSchema,
])

// ── Zod: bilim kartasi / dars / section / kurs ───────────────────────────────

export const AiCourseKnowledgeCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(10).max(500),
})

export const AiCourseLessonSchema = z.object({
  id: z.string().min(1),
  ord: z.number().int().min(0),
  title: z.string().min(1).max(140),
  /** Har dars boshidagi majburiy xulosa (Wondering TLDR) */
  tldr: z.string().min(20).max(500),
  pages: z.array(AiCoursePageSchema).min(1).max(5),
  practices: z.array(AiCoursePracticeSchema).min(2).max(5),
  knowledgeCards: z.array(AiCourseKnowledgeCardSchema).min(1).max(4),
})

export const AiCourseSectionSchema = z.object({
  id: z.string().min(1),
  ord: z.number().int().min(0),
  title: z.string().min(1).max(140),
  lessons: z.array(AiCourseLessonSchema).min(2).max(6),
})

export const AiCoursePayloadSchema = z.object({
  version: z.literal(1),
  sections: z.array(AiCourseSectionSchema).min(2).max(7),
})

// ── Tiplar ───────────────────────────────────────────────────────────────────

export type AiCoursePage = z.infer<typeof AiCoursePageSchema>
export type AiCoursePractice = z.infer<typeof AiCoursePracticeSchema>
export type AiCourseFlashcard = z.infer<typeof AiCourseFlashcardSchema>
export type AiCourseMcq = z.infer<typeof AiCourseMcqSchema>
export type AiCourseCloze = z.infer<typeof AiCourseClozeSchema>
export type AiCourseOrder = z.infer<typeof AiCourseOrderSchema>
export type AiCourseKnowledgeCard = z.infer<typeof AiCourseKnowledgeCardSchema>
export type AiCourseLesson = z.infer<typeof AiCourseLessonSchema>
export type AiCourseSection = z.infer<typeof AiCourseSectionSchema>
export type AiCoursePayload = z.infer<typeof AiCoursePayloadSchema>

// ── Create input (POST /api/ai-courses body) ─────────────────────────────────

export const AiCourseCreateSchema = z.object({
  /** Mavzu matni (link/pdf/chat'da ham — outline shu matndan quriladi) */
  topic: z.string().trim().min(3).max(200),
  inputKind: z.enum(AI_COURSE_INPUT_KINDS).default('topic'),
  /** URL / fayl nomi / suhbat id — manba izi (ixtiyoriy) */
  inputRef: z.string().trim().max(500).default(''),
  lessonLength: z.enum(AI_COURSE_LESSON_LENGTHS).default('standard'),
  language: z.enum(['uz', 'ru']).default('uz'),
})
export type AiCourseCreateInput = z.infer<typeof AiCourseCreateSchema>

// ── Client javoblari (complete body) ─────────────────────────────────────────

export const AiCourseAnswersSchema = z.object({
  /** practiceId → 'known' | 'unknown' (self-report) */
  flashcard: z.record(z.string(), z.enum(['known', 'unknown'])).default({}),
  /** practiceId → optionId */
  mcq: z.record(z.string(), z.string()).default({}),
  /** practiceId → (blankId → matn) */
  cloze: z.record(z.string(), z.record(z.string(), z.string().max(100))).default({}),
  /** practiceId → stepId[] (foydalanuvchi tartibi) */
  order: z.record(z.string(), z.array(z.string()).max(8)).default({}),
})
export type AiCourseAnswers = z.infer<typeof AiCourseAnswersSchema>

export const AiCourseCompleteSchema = z.object({
  answers: AiCourseAnswersSchema,
  clientToken: z.string().min(8).max(64),
})

// ── Public payload (javob kalitlarisiz) ──────────────────────────────────────

export type AiCourseMcqPublic = Omit<AiCourseMcq, 'correctOptionId'>
export type AiCourseClozePublic = Omit<AiCourseCloze, 'blanks'> & {
  blanks: { id: string }[]
}
export type AiCourseOrderPublic = Omit<AiCourseOrder, 'steps'> & {
  steps: { id: string; text: string }[]
}
export type AiCoursePracticePublic =
  | AiCourseFlashcard | AiCourseMcqPublic | AiCourseClozePublic | AiCourseOrderPublic
export interface AiCourseLessonPublic extends Omit<AiCourseLesson, 'practices'> {
  practices: AiCoursePracticePublic[]
}
export interface AiCourseSectionPublic extends Omit<AiCourseSection, 'lessons'> {
  lessons: AiCourseLessonPublic[]
}
export interface AiCoursePayloadPublic {
  version: 1
  sections: AiCourseSectionPublic[]
}

/**
 * Deterministik seeded shuffle (LCG) — server va test bir xil natija oladi.
 * Maqsad: public payload'da to'g'ri tartib sizmasligi (mcq options, order steps).
 */
export function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let state = h >>> 0
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** SCORING TRUST BOUNDARY: javoblar client'ga chiqmaydi, tartiblar aralashtiriladi. */
export function toPublicCourseLesson(lesson: AiCourseLesson): AiCourseLessonPublic {
  return {
    ...lesson,
    practices: lesson.practices.map((p): AiCoursePracticePublic => {
      switch (p.kind) {
        case 'flashcard':
          return p
        case 'mcq': {
          const { correctOptionId: _c, options, ...rest } = p
          return { ...rest, options: shuffleSeeded(options, `mcq:${p.id}`) }
        }
        case 'cloze': {
          const { blanks, pool, ...rest } = p
          return {
            ...rest,
            blanks: blanks.map((b) => ({ id: b.id })),
            pool: shuffleSeeded(pool, `cloze:${p.id}`),
          }
        }
        case 'order': {
          const { steps, ...rest } = p
          return { ...rest, steps: shuffleSeeded(steps, `order:${p.id}`) }
        }
      }
    }),
  }
}

export function toPublicCoursePayload(payload: AiCoursePayload): AiCoursePayloadPublic {
  return {
    version: 1,
    sections: payload.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map(toPublicCourseLesson),
    })),
  }
}

// ── Baholash (server + test UMUMIY, sof funksiya) ────────────────────────────

export interface AiCourseGrading {
  perTask: Record<string, { correct: boolean }>
  correctCount: number
  totalCount: number
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:"'«»„“”()\-—–\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function gradeCoursePractices(
  practices: readonly AiCoursePractice[],
  answers: AiCourseAnswers,
): AiCourseGrading {
  const perTask: Record<string, { correct: boolean }> = {}
  for (const p of practices) {
    let correct = false
    switch (p.kind) {
      case 'flashcard':
        correct = answers.flashcard[p.id] === 'known'
        break
      case 'mcq':
        correct = answers.mcq[p.id] === p.correctOptionId
        break
      case 'cloze': {
        const given = answers.cloze[p.id] ?? {}
        correct =
          p.blanks.length > 0 &&
          p.blanks.every((b) => norm(given[b.id] ?? '') === norm(b.answer))
        break
      }
      case 'order': {
        const given = answers.order[p.id] ?? []
        correct =
          given.length === p.steps.length &&
          p.steps.every((s, i) => given[i] === s.id)
        break
      }
    }
    perTask[p.id] = { correct }
  }
  const correctCount = Object.values(perTask).filter((r) => r.correct).length
  return { perTask, correctCount, totalCount: practices.length }
}

/** Darsdagi barcha mashqlarga javob berilganmi (yakunlash sharti) — public payload'da ham ishlaydi */
export function isLessonFullyAnswered(
  practices: readonly (AiCoursePractice | AiCoursePracticePublic)[],
  answers: AiCourseAnswers,
): boolean {
  return practices.every((p) => {
    switch (p.kind) {
      case 'flashcard':
        return answers.flashcard[p.id] === 'known' || answers.flashcard[p.id] === 'unknown'
      case 'mcq':
        return typeof answers.mcq[p.id] === 'string' && answers.mcq[p.id].length > 0
      case 'cloze': {
        const given = answers.cloze[p.id] ?? {}
        const blanks = (p as AiCourseCloze | AiCourseClozePublic).blanks
        return blanks.every((b) => (given[b.id] ?? '').trim().length > 0)
      }
      case 'order':
        return (answers.order[p.id] ?? []).length === (p as AiCourseOrder | AiCourseOrderPublic).steps.length
    }
  })
}

/** Kursdagi jami dars soni (progress "X/Y" uchun) */
export function aiCourseLessonCount(payload: AiCoursePayload | AiCoursePayloadPublic): number {
  return payload.sections.reduce((n, s) => n + s.lessons.length, 0)
}

/** Roadmap tartibida birinchi yakunlanmagan dars (Davom etish tugmasi uchun) */
export function findFirstIncompleteLesson(
  payload: AiCoursePayload | AiCoursePayloadPublic,
  completedIds: ReadonlySet<string> | readonly string[],
): string | null {
  const done = completedIds instanceof Set ? completedIds : new Set(completedIds)
  const ordered = [...payload.sections]
    .sort((a, b) => a.ord - b.ord)
    .flatMap((s) => [...s.lessons].sort((a, b) => a.ord - b.ord))
  return ordered.find((l) => !done.has(l.id))?.id ?? null
}

export function findCourseLesson(
  payload: AiCoursePayload,
  lessonId: string,
): { sectionId: string; lesson: AiCourseLesson } | null
export function findCourseLesson(
  payload: AiCoursePayloadPublic,
  lessonId: string,
): { sectionId: string; lesson: AiCourseLessonPublic } | null
export function findCourseLesson(
  payload: AiCoursePayload | AiCoursePayloadPublic,
  lessonId: string,
): { sectionId: string; lesson: AiCourseLesson | AiCourseLessonPublic } | null {
  for (const s of payload.sections) {
    const lesson = s.lessons.find((l) => l.id === lessonId)
    if (lesson) return { sectionId: s.id, lesson: lesson as AiCourseLesson }
  }
  return null
}
