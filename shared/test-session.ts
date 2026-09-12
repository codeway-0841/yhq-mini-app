import { z } from 'zod'
import { EXAM_PRESET_IDS } from './exam-presets'

/** Barcha selectorlar server tomonidan resolve qilinadi; client master ID yubormaydi. */
export const RandomTestSelectorSchema = z.object({
  type: z.literal('random'),
  count: z.union([z.literal(20), z.literal(50), z.literal(100)]),
})

export const TopicTestSelectorSchema = z.object({
  type: z.literal('topic'),
  topicId: z.number().int().positive(),
})

export const TicketTestSelectorSchema = z.object({
  type: z.literal('ticket'),
  ticketNumber: z.number().int().positive(),
})

export const LessonTestSelectorSchema = z.object({
  type: z.literal('lesson'),
  moduleId: z.number().int().positive().max(10_000),
  lessonIndex: z.number().int().min(0).max(1_000),
})

export const ModuleTestSelectorSchema = z.object({
  type: z.literal('module'),
  moduleId: z.number().int().positive().max(10_000),
})

export const ExamTestSelectorSchema = z.object({
  type: z.literal('exam'),
  presetId: z.enum(EXAM_PRESET_IDS),
})

export const MockTestSelectorSchema = z.object({
  type: z.literal('mock'),
})

export const MarathonTestSelectorSchema = z.object({
  type: z.literal('marathon'),
})

export const SavedTestSelectorSchema = z.object({
  type: z.literal('saved'),
})

export const MistakesTestSelectorSchema = z.object({
  type: z.literal('mistakes'),
  topicId: z.number().int().positive().optional(),
})

export const SingleTestSelectorSchema = z.object({
  type: z.literal('single'),
  launchToken: z.string().min(16),
})

export const TestSelectorSchema = z.discriminatedUnion('type', [
  RandomTestSelectorSchema,
  TopicTestSelectorSchema,
  TicketTestSelectorSchema,
  LessonTestSelectorSchema,
  ModuleTestSelectorSchema,
  ExamTestSelectorSchema,
  MockTestSelectorSchema,
  MarathonTestSelectorSchema,
  SavedTestSelectorSchema,
  MistakesTestSelectorSchema,
  SingleTestSelectorSchema,
])

export const CreateTestSessionSchema = z.object({
  subjectId: z.string().min(1).max(32),
  selector: TestSelectorSchema,
  language: z.enum(['uz', 'ru']).default('uz'),
})

export const SubmitTestAnswerSchema = z.object({
  position: z.number().int().min(0),
  deliveryToken: z.string().min(16).max(256),
  expiresAt: z.string().datetime(),
  selectedOptionId: z.string().min(1).max(32),
  clientToken: z.string().min(8).max(64),
  elapsedMs: z.number().int().min(0).max(600_000).optional(),
})

export const FinishTestSessionSchema = z.object({
  status: z.enum(['completed', 'abandoned']).default('completed'),
})

export type CreateTestSessionInput = z.infer<typeof CreateTestSessionSchema>
export type SubmitTestAnswerInput = z.infer<typeof SubmitTestAnswerSchema>

export interface DeliveredTestQuestion {
  position: number
  deliveryToken: string
  expiresAt: string
  text: string
  options: Array<{ id: string; text: string }>
  media: string | null
  topic: { id: number } | null
}

export interface TestSessionState {
  id: string
  subjectId: string
  mode: 'random' | 'topic' | 'ticket' | 'lesson' | 'module' | 'exam' | 'mock' | 'marathon' | 'saved' | 'mistakes' | 'single'
  status: 'active' | 'completed' | 'abandoned' | 'expired'
  answered: number
  total: number
  expiresAt: string
}
export interface TestSessionResponse {
  session: TestSessionState
  questions: DeliveredTestQuestion[]
  /** Resume uchun faqat oldin javob berilgan positionlar; unanswered key yo'q. */
  review: Array<{
    position: number
    selectedOptionId: string
    correct: boolean
    correctOptionId: string
  }>
}

export interface TestAnswerResponse {
  attempt: {
    position: number
    correct: boolean
    correctOptionId: string
    duplicate: boolean
    dailyStreak: number | null
    xp: number | null
    xpEarned: number
    coinsEarned: number
    coinBalance: number | null
    coinSaved: boolean
  }
  append: DeliveredTestQuestion[]
  session: TestSessionState
}
