import { z } from 'zod'

export const CONTENT_BANK_VERSION = 1

export const CONTENT_BANK_DIFFICULTIES = ['easy', 'medium', 'hard'] as const

const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Faqat lowercase slug: harf/raqam va tire')

const ExternalIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, 'externalId lowercase harf/raqam, tire yoki underscore bo‘lsin')

const BankIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*_db$/, 'bankId lowercase snake_case va *_db bilan tugashi kerak')

const OptionKeySchema = z.string().regex(/^[A-Z]\d+$/, 'Variant kaliti A1, A2, ... formatida bo‘lsin')

const OptionsSchema = z
  .record(OptionKeySchema, z.string().trim().min(1).max(1000))
  .refine((rec) => Object.keys(rec).length >= 2, 'Kamida 2 ta variant kerak')

export const ContentBankTopicSchema = z.object({
  externalId: ExternalIdSchema,
  slug: SlugSchema.optional(),
  nameUz: z.string().trim().min(2).max(160),
  nameRu: z.string().trim().min(2).max(160),
})

export const ContentBankItemSchema = z
  .object({
    externalId: ExternalIdSchema,
    topicExternalId: ExternalIdSchema.optional(),
    topicSlug: SlugSchema.optional(),
    questionUz: z.string().trim().min(2).max(2000),
    questionRu: z.string().trim().min(2).max(2000),
    optionsUz: OptionsSchema,
    optionsRu: OptionsSchema,
    correctAnswer: OptionKeySchema,
    explanationUz: z.string().trim().min(2).max(4000).optional(),
    explanationRu: z.string().trim().min(2).max(4000).optional(),
    difficulty: z.enum(CONTENT_BANK_DIFFICULTIES).optional(),
    source: z.string().trim().min(2).max(500).optional(),
    image: z.string().trim().min(1).max(10_000_000).nullable().optional(),
  })
  .superRefine((item, ctx) => {
    const uzKeys = Object.keys(item.optionsUz)
    const ruKeys = Object.keys(item.optionsRu)

    if (uzKeys.length !== ruKeys.length || !uzKeys.every((key) => ruKeys.includes(key))) {
      ctx.addIssue({
        code: 'custom',
        path: ['optionsRu'],
        message: 'optionsUz va optionsRu kalitlari bir xil bo‘lishi shart',
      })
    }

    if (!uzKeys.includes(item.correctAnswer) || !ruKeys.includes(item.correctAnswer)) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctAnswer'],
        message: 'correctAnswer options ichidagi kalit bo‘lishi shart (UZ/RU)',
      })
    }

    if (!item.topicExternalId && !item.topicSlug) {
      ctx.addIssue({
        code: 'custom',
        path: ['topicExternalId'],
        message: 'Har savolda topicExternalId yoki topicSlug bo‘lishi shart',
      })
    }

    if ((item.explanationUz && !item.explanationRu) || (!item.explanationUz && item.explanationRu)) {
      ctx.addIssue({
        code: 'custom',
        path: ['explanationRu'],
        message: 'Tushuntirish bo‘lsa UZ va RU ikkalasi ham to‘ldirilsin',
      })
    }
  })

export const ContentBankSchema = z
  .object({
    version: z.literal(CONTENT_BANK_VERSION),
    subjectId: SlugSchema,
    bankId: BankIdSchema,
    bankName: z.string().trim().min(2).max(160),
    topics: z.array(ContentBankTopicSchema).min(1).max(500),
    items: z.array(ContentBankItemSchema).min(1).max(10_000),
  })
  .superRefine((bank, ctx) => {
    const topicExternalIds = new Set<string>()
    const topicSlugs = new Set<string>()

    bank.topics.forEach((topic, index) => {
      const slug = normalizeTopicSlug(bank.subjectId, topic)

      if (topicExternalIds.has(topic.externalId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', index, 'externalId'],
          message: `Takror topic externalId: ${topic.externalId}`,
        })
      }
      topicExternalIds.add(topic.externalId)

      if (topicSlugs.has(slug)) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', index, 'slug'],
          message: `Takror topic slug: ${slug}`,
        })
      }
      topicSlugs.add(slug)
    })

    const itemExternalIds = new Set<string>()
    bank.items.forEach((item, index) => {
      if (itemExternalIds.has(item.externalId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'externalId'],
          message: `Takror savol externalId: ${item.externalId}`,
        })
      }
      itemExternalIds.add(item.externalId)

      if (item.topicExternalId && !topicExternalIds.has(item.topicExternalId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'topicExternalId'],
          message: `Noma’lum topicExternalId: ${item.topicExternalId}`,
        })
      }

      if (item.topicSlug && !topicSlugs.has(item.topicSlug)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'topicSlug'],
          message: `Noma’lum topicSlug: ${item.topicSlug}`,
        })
      }
    })
  })

export type ContentBankTopic = z.infer<typeof ContentBankTopicSchema>
export type ContentBankItem = z.infer<typeof ContentBankItemSchema>
export type ContentBank = z.infer<typeof ContentBankSchema>

export interface ContentBankValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
  data?: ContentBank
}

export interface TopicSeedRow {
  externalId: string
  slug: string
  nameUz: string
  nameRu: string
  bankId: string
}

export interface AdminBulkImportPayload {
  subjectId: string
  bankId: string
  items: Array<{
    questionUz: string
    questionRu: string
    optionsUz: Record<string, string>
    optionsRu: Record<string, string>
    correctAnswer: string
    image: string | null
    topicId: number | null
  }>
}

export interface ExplanationSeedRow {
  externalId: string
  explanationUz: string
  explanationRu: string
}

export function normalizeTopicSlug(subjectId: string, topic: Pick<ContentBankTopic, 'externalId' | 'slug'>): string {
  return topic.slug ?? `${subjectId}-${topic.externalId.replace(/_/g, '-')}`
}

export function parseContentBank(input: unknown): ContentBankValidation {
  const parsed = ContentBankSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : 'root'
        return `${path}: ${issue.message}`
      }),
      warnings: [],
    }
  }

  return {
    ok: true,
    errors: [],
    warnings: contentBankWarnings(parsed.data),
    data: parsed.data,
  }
}

export function contentBankWarnings(bank: ContentBank): string[] {
  const warnings: string[] = []
  const prefix = `${bank.subjectId}-`

  for (const [index, topic] of bank.topics.entries()) {
    const slug = normalizeTopicSlug(bank.subjectId, topic)
    if (!slug.startsWith(prefix)) {
      warnings.push(`topics.${index}.slug: "${slug}" fan prefiksi bilan boshlansa yaxshi (${prefix}...)`)
    }
  }

  const withoutDifficulty = bank.items.filter((item) => !item.difficulty).length
  if (withoutDifficulty) warnings.push(`${withoutDifficulty} ta savolda difficulty yo‘q`)

  const withoutSource = bank.items.filter((item) => !item.source).length
  if (withoutSource) warnings.push(`${withoutSource} ta savolda source yo‘q`)

  const withoutExplanation = bank.items.filter((item) => !item.explanationUz || !item.explanationRu).length
  if (withoutExplanation) warnings.push(`${withoutExplanation} ta savolda explanation yo‘q`)

  return warnings
}

export function toTopicSeedRows(bank: ContentBank): TopicSeedRow[] {
  return bank.topics.map((topic) => ({
    externalId: topic.externalId,
    slug: normalizeTopicSlug(bank.subjectId, topic),
    nameUz: topic.nameUz,
    nameRu: topic.nameRu,
    bankId: bank.bankId,
  }))
}

export function toTopicIdTemplate(bank: ContentBank): Record<string, null> {
  const entries = toTopicSeedRows(bank).flatMap((topic) => [
    [topic.externalId, null] as const,
    [topic.slug, null] as const,
  ])
  return Object.fromEntries(entries)
}

export function toAdminBulkImportPayload(
  bank: ContentBank,
  topicIds: Record<string, number | null | undefined> = {},
): AdminBulkImportPayload {
  const topicByExternalId = new Map(bank.topics.map((topic) => [topic.externalId, normalizeTopicSlug(bank.subjectId, topic)]))

  return {
    subjectId: bank.subjectId,
    bankId: bank.bankId,
    items: bank.items.map((item) => {
      const slug = item.topicSlug ?? (item.topicExternalId ? topicByExternalId.get(item.topicExternalId) : undefined)
      const topicId = firstNumber(topicIds[item.topicExternalId ?? ''], topicIds[slug ?? ''])

      return {
        questionUz: item.questionUz,
        questionRu: item.questionRu,
        optionsUz: item.optionsUz,
        optionsRu: item.optionsRu,
        correctAnswer: item.correctAnswer,
        image: item.image ?? null,
        topicId: topicId ?? null,
      }
    }),
  }
}

export function toExplanationSeedRows(bank: ContentBank): ExplanationSeedRow[] {
  return bank.items
    .filter((item): item is ContentBankItem & { explanationUz: string; explanationRu: string } =>
      Boolean(item.explanationUz && item.explanationRu),
    )
    .map((item) => ({
      externalId: item.externalId,
      explanationUz: item.explanationUz,
      explanationRu: item.explanationRu,
    }))
}

function firstNumber(...values: Array<number | null | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  }
  return undefined
}
