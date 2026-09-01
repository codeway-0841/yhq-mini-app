/**
 * AI KUNLIK TEST (rustili, Milliy sertifikat formati) — YAGONA MANBA.
 *
 * Har Tashkent kuni uchun AI (Gemini) 2 ta to'liq variant tuzadi:
 * slot 1 = free, slot 2 = premium. Struktura (45 topshiriq):
 *   1-bo'lim: 32 yopiq test (1 to'g'ri javob, 4 variant)
 *   2-bo'lim: 3 moslashtirish (chap ↔ o'ng kolonka)
 *   3-bo'lim: 9 qisqa ochiq javob (kontekst matn asosida)
 *   4-bo'lim: 1 esse (150–200 so'z, AI baholaydi)
 *
 * QOIDALAR:
 * - Savollar ASOSIY bazaga (russian_db) KIRMAYDI — alohida `ai_daily_tests`
 *   jadvalida, javob kalitlari FAQAT serverda (payload client'ga
 *   toPublicAiTest() orqali javoblarsiz chiqadi — scoring trust boundary).
 * - 1 test = 1 urinish: UNIQUE(test_id, user_id) strukturaviy himoya.
 * - Coin: har to'g'ri topshiriq (1–3 bo'lim) = AI_TEST_COIN_PER_CORRECT,
 *   esse bahosiga 0..AI_TEST_ESSAY_MAX_COINS. Mint FAQAT submit CTE'da,
 *   ledger reason 'ai_test' + UNIQUE(user, reason, ref) — retry xavfsiz.
 * - Esse + o'tmagan qisqa javoblarni 1 Gemini chaqiriq baholaydi;
 *   AI_TEST_DAILY_GRADE_LIMIT — kunlik global xarajat shifti.
 */

import { z } from 'zod'

// ── Konstantalar ─────────────────────────────────────────────────────────────

/** Hozircha FAQAT rus tili (shared/subjects.ts id) */
export const AI_TEST_SUBJECT_ID = 'rustili'

export const AI_TEST_SLOTS = [1, 2] as const
export type AiTestSlot = (typeof AI_TEST_SLOTS)[number]
/** Shu slot'dan boshlab premium talab qilinadi (slot 1 = free) */
export const AI_TEST_PREMIUM_SLOT: AiTestSlot = 2

export const AI_TEST_TASK_COUNTS = { mcq: 32, matching: 3, short: 9, essay: 1 } as const
export const AI_TEST_TOTAL_TASKS =
  AI_TEST_TASK_COUNTS.mcq + AI_TEST_TASK_COUNTS.matching +
  AI_TEST_TASK_COUNTS.short + AI_TEST_TASK_COUNTS.essay

export const AI_TEST_COIN_PER_CORRECT = 1
export const AI_TEST_ESSAY_MAX_COINS = 6
/** Aniq ball olinadigan topshiriqlar soni (esse'siz) — "X/44" ko'rsatkichlari uchun */
export const AI_TEST_GRADED_TASKS =
  AI_TEST_TASK_COUNTS.mcq + AI_TEST_TASK_COUNTS.matching + AI_TEST_TASK_COUNTS.short
/** Bir testdan olish mumkin bo'lgan maksimal coin (44 + 6) */
export const AI_TEST_MAX_COINS =
  AI_TEST_GRADED_TASKS * AI_TEST_COIN_PER_CORRECT + AI_TEST_ESSAY_MAX_COINS

export const AI_TEST_ESSAY_MIN_WORDS = 150
export const AI_TEST_ESSAY_MAX_WORDS = 200

/** Kunlik GLOBAL AI-baholash kvotasi (submit boshiga 1 Gemini chaqiriq) */
export const AI_TEST_DAILY_GRADE_LIMIT = 400
/** tutor_usage'dagi global byudjet qatori uchun maxsus sentinel (haqiqiy user emas) */
export const AI_TEST_GRADE_GLOBAL_USER_ID = 'ai-grade-global'

/** Ledger reason (coin_transactions.reason) — ShopPage reasonLabel'da ham bo'lsin */
export const AI_TEST_LEDGER_REASON = 'ai_test'
export const aiTestLedgerRef = (testId: number, userId: string) => `ai_test:${testId}:${userId}`

// ── Zod sxemalari (server payload — javob kalitlari BILAN) ──────────────────

const OptionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) })

export const AiTestMcqTaskSchema = z.object({
  kind: z.literal('mcq'),
  id: z.string().min(1),
  /** Mavzu yorlig'i: 'Орфография', 'Пунктуация', 'Литература' ... */
  topic: z.string().min(1),
  prompt: z.string().min(3),
  options: z.array(OptionSchema).length(4),
  correctOptionId: z.string().min(1),
})

export const AiTestMatchingTaskSchema = z.object({
  kind: z.literal('matching'),
  id: z.string().min(1),
  topic: z.string().min(1),
  prompt: z.string().min(3),
  left: z.array(OptionSchema).min(3).max(6),
  right: z.array(OptionSchema).min(3).max(6),
  /** leftId → rightId (HAR bir chap element uchun to'liq) */
  correct: z.record(z.string(), z.string()),
})

export const AiTestShortTaskSchema = z.object({
  kind: z.literal('short'),
  id: z.string().min(1),
  topic: z.string().min(1),
  /** Qaysi kontekst matnga tegishli (payload.contexts id) */
  contextId: z.string().min(1),
  prompt: z.string().min(3),
  /** Qabul qilinadigan javob variantlari (normalizeShortAnswer bilan solishtiriladi) */
  acceptedAnswers: z.array(z.string().min(1)).min(1).max(8),
})

export const AiTestEssayTaskSchema = z.object({
  kind: z.literal('essay'),
  id: z.string().min(1),
  topic: z.string().min(1),
  prompt: z.string().min(10),
  minWords: z.number().int().min(50).max(400),
  maxWords: z.number().int().min(100).max(600),
})

export const AiTestContextSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(20),
})

export const AiTestTaskSchema = z.discriminatedUnion('kind', [
  AiTestMcqTaskSchema,
  AiTestMatchingTaskSchema,
  AiTestShortTaskSchema,
  AiTestEssayTaskSchema,
])

export const AiTestPayloadSchema = z.object({
  version: z.literal(1),
  /** Variant nomi, masalan 'Вариант №1' */
  title: z.string().min(1),
  contexts: z.array(AiTestContextSchema).min(1).max(4),
  tasks: z.array(AiTestTaskSchema).length(AI_TEST_TOTAL_TASKS),
}).superRefine((p, ctx) => {
  const counts = { mcq: 0, matching: 0, short: 0, essay: 0 }
  const contextIds = new Set(p.contexts.map((c) => c.id))
  for (const t of p.tasks) {
    counts[t.kind]++
    if (t.kind === 'mcq' && !t.options.some((o) => o.id === t.correctOptionId)) {
      ctx.addIssue({ code: 'custom', message: `mcq ${t.id}: correctOptionId variantlarda yo'q` })
    }
    if (t.kind === 'matching') {
      const leftIds = new Set(t.left.map((l) => l.id))
      const rightIds = new Set(t.right.map((r) => r.id))
      for (const l of t.left) {
        if (!t.correct[l.id]) ctx.addIssue({ code: 'custom', message: `matching ${t.id}: ${l.id} uchun javob yo'q` })
      }
      for (const [l, r] of Object.entries(t.correct)) {
        if (!leftIds.has(l) || !rightIds.has(r)) {
          ctx.addIssue({ code: 'custom', message: `matching ${t.id}: yaroqsiz juftlik ${l}->${r}` })
        }
      }
    }
    if (t.kind === 'short' && !contextIds.has(t.contextId)) {
      ctx.addIssue({ code: 'custom', message: `short ${t.id}: contextId '${t.contextId}' contexts'da yo'q` })
    }
  }
  for (const [kind, want] of Object.entries(AI_TEST_TASK_COUNTS)) {
    if (counts[kind as keyof typeof counts] !== want) {
      ctx.addIssue({ code: 'custom', message: `${kind}: ${want} ta kerak, ${counts[kind as keyof typeof counts]} ta keldi` })
    }
  }
})

// ── Tiplar ───────────────────────────────────────────────────────────────────

export type AiTestMcqTask = z.infer<typeof AiTestMcqTaskSchema>
export type AiTestMatchingTask = z.infer<typeof AiTestMatchingTaskSchema>
export type AiTestShortTask = z.infer<typeof AiTestShortTaskSchema>
export type AiTestEssayTask = z.infer<typeof AiTestEssayTaskSchema>
export type AiTestTask = z.infer<typeof AiTestTaskSchema>
export type AiTestContext = z.infer<typeof AiTestContextSchema>
export type AiTestPayload = z.infer<typeof AiTestPayloadSchema>

// ── Client javoblari (submit body) ───────────────────────────────────────────

export const AiTestAnswersSchema = z.object({
  /** taskId → optionId */
  mcq: z.record(z.string(), z.string()).default({}),
  /** taskId → (leftId → rightId) */
  matching: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** taskId → erkin matn */
  short: z.record(z.string(), z.string().max(500)).default({}),
  /** Esse matni */
  essay: z.string().max(20_000).default(''),
})
export type AiTestAnswers = z.infer<typeof AiTestAnswersSchema>

// ── Baholash natijasi (attempts.grading jsonb) ──────────────────────────────

export interface AiTestGrading {
  mcq: Record<string, { correct: boolean; correctOptionId: string }>
  matching: Record<string, { correct: boolean; correctMapping: Record<string, string> }>
  short: Record<string, { correct: boolean; acceptedAnswers: string[] }>
  /** null = AI kvota tugab esse baholanmadi (coin'siz) */
  essay: { score: number; feedback: string } | null
  /** 1–3 bo'limlardagi to'g'ri topshiriqlar soni (coin asosi) */
  correctCount: number
  /** Esse bahosi 0–10 */
  essayScore: number
  coinsAwarded: number
}

// ── Public payload (client'ga — javob kalitlarisiz) ─────────────────────────

export type AiTestMcqTaskPublic = Omit<AiTestMcqTask, 'correctOptionId'>
export type AiTestMatchingTaskPublic = Omit<AiTestMatchingTask, 'correct'>
export type AiTestShortTaskPublic = Omit<AiTestShortTask, 'acceptedAnswers'>
export type AiTestEssayTaskPublic = AiTestEssayTask
export type AiTestTaskPublic =
  | AiTestMcqTaskPublic | AiTestMatchingTaskPublic
  | AiTestShortTaskPublic | AiTestEssayTaskPublic

export interface AiTestPublicPayload {
  version: 1
  title: string
  contexts: AiTestContext[]
  tasks: AiTestTaskPublic[]
}

/** SCORING TRUST BOUNDARY: javob kalitlarini client'ga chiqarmaslik. */
export function toPublicAiTest(payload: AiTestPayload): AiTestPublicPayload {
  return {
    version: 1,
    title: payload.title,
    contexts: payload.contexts,
    tasks: payload.tasks.map((t) => {
      switch (t.kind) {
        case 'mcq': {
          const { correctOptionId: _c, ...rest } = t
          return rest
        }
        case 'matching': {
          const { correct: _c, ...rest } = t
          return rest
        }
        case 'short': {
          const { acceptedAnswers: _a, ...rest } = t
          return rest
        }
        case 'essay':
          return t
      }
    }),
  }
}

// ── Helperlar ────────────────────────────────────────────────────────────────

/**
 * Qisqa javob normallashtirish (baholashda adolat uchun):
 * lowercase, ё→е, punktuatsiya olib tashlanadi, bo'shliqlar bittaga.
 * Diapazon/bosh so'z farqlarini acceptedAnswers variantlari qoplaydi.
 */
export function normalizeShortAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"'«»„“”()\-—–\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Esse AI bahosi (0–10) → coin (0..AI_TEST_ESSAY_MAX_COINS) */
export function essayCoinsForScore(score: number): number {
  const clamped = Math.min(10, Math.max(0, Math.round(score)))
  return Math.round((clamped / 10) * AI_TEST_ESSAY_MAX_COINS)
}

/** Topshiriqning global tartib raqami (1..45) — payload.tasks tartibi bo'yicha */
export function aiTestTaskNumber(payload: AiTestPayload | AiTestPublicPayload, taskId: string): number {
  const idx = payload.tasks.findIndex((t) => t.id === taskId)
  return idx === -1 ? 0 : idx + 1
}

/** Bo'lim meta-ma'lumotlari (UI sarlavhalari) */
export const AI_TEST_SECTIONS = [
  { kind: 'mcq' as const,
    label: { uz: '1-bo‘lim. Yopiq testlar (bitta to‘g‘ri javob)', ru: 'Раздел 1. Закрытые тесты (один верный ответ)' } },
  { kind: 'matching' as const,
    label: { uz: '2-bo‘lim. Moslashtirish', ru: 'Раздел 2. Установление соответствия' } },
  { kind: 'short' as const,
    label: { uz: '3-bo‘lim. Qisqa ochiq javoblar', ru: 'Раздел 3. Открытые задания с кратким ответом' } },
  { kind: 'essay' as const,
    label: { uz: '4-bo‘lim. Esse', ru: 'Раздел 4. Сочинение-эссе' } },
] as const
