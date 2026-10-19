import { z } from 'zod'
import outline from '../src/content/darslik-rustili/outline.json'

/**
 * Darslik mashqlari shartnomasi (server + client uchun yagona manba).
 *
 * v2 — Duolingo uslubidagi dars oqimi: 5–7 mashq, kamida 4 xil tur.
 * v1 — eski 2 MCQ + 1 input sxemasi. U saqlanadi va o'qish oqimini
 * bloklamaydi: v1 mastery qatorlari v2 bilan birga hurmat qilinadi.
 */
export const DARSLIK_CHECK_VERSION = 2
export const DARSLIK_LEGACY_CHECK_VERSION = 1
export const DARSLIK_CHECK_VERSIONS = [DARSLIK_CHECK_VERSION, DARSLIK_LEGACY_CHECK_VERSION] as const
export const DARSLIK_LESSON_MIN_EXERCISES = 5
export const DARSLIK_LESSON_MAX_EXERCISES = 7
export const DARSLIK_LESSON_MIN_KINDS = 4

export const darslikTopicId = (blockId: number, sectionIndex: number) => `${blockId}:${sectionIndex}`
export const DARSLIK_TOPIC_IDS = Object.entries(outline).flatMap(([block, titles]) =>
  titles.map((_, index) => darslikTopicId(Number(block), index)),
)

/** All earlier topics must be mastered, including topics in previous blocks. */
export function canOpenDarslikTopic(topicId: string, passed: readonly string[]): boolean {
  const index = DARSLIK_TOPIC_IDS.indexOf(topicId)
  const completed = new Set(passed)
  return index >= 0 && DARSLIK_TOPIC_IDS.slice(0, index).every(id => completed.has(id))
}

/** Same numbered-heading convention as the textbook outline; never include future topics. */
export function splitDarslikSections(source: string): string[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const headings = lines.flatMap((line, index) => /^#{1,2}\s+/.test(line.trim()) ? [index] : [])
  const numbered = headings.filter(index => /^#{1,2}\s+\d{1,2}[.)]\s+/.test(lines[index].trim()))
  const starts = numbered.length ? numbered : headings
  return starts.map((start, index) => {
    let end = starts[index + 1] ?? lines.length
    // The last topic otherwise swallows the block summary and mini-test,
    // whose answers must never become AI-check source material.
    if (index === starts.length - 1) {
      for (let line = start + 1; line < lines.length; line++) {
        const heading = lines[line].trim().match(/^#{1,2}\s+(.*)$/)
        if (heading && /(ЧТО НУЖНО ЗАПОМНИТЬ|МИНИ-ТЕСТ|ПРАКТИКА|ОТВЕТЫ|ИТОГ|АТТЕСТАЦИОННЫЙ ТЕСТ|ТЕСТ)/i.test(heading[1])) {
          end = line
          break
        }
      }
    }
    return lines.slice(start, end).join('\n').trim()
  })
}

const exerciseId = z.string().min(1).max(30)
const prompt = z.string().min(5).max(600)
const explanation = z.string().min(5).max(800)
const optionText = z.string().min(1).max(300)

const BaseExercise = { id: exerciseId, prompt, explanation }
const ChoiceFields = {
  options: z.array(optionText).length(4),
  correctIndex: z.number().int().min(0).max(3),
}

export const DarslikExerciseSchema = z.discriminatedUnion('kind', [
  z.object({ ...BaseExercise, kind: z.literal('mcq'), ...ChoiceFields }),
  z.object({ ...BaseExercise, kind: z.literal('input'), answers: z.array(z.string().min(1).max(100)).min(1).max(8) }),
  z.object({
    ...BaseExercise,
    kind: z.literal('word_bank'),
    tokens: z.array(z.string().min(1).max(40)).min(3).max(12),
    answer: z.array(z.string().min(1).max(40)).min(1).max(12),
  }),
  z.object({
    ...BaseExercise,
    kind: z.literal('match'),
    pairs: z.array(z.object({ left: z.string().min(1).max(100), right: z.string().min(1).max(100) })).min(3).max(5),
  }),
  z.object({ ...BaseExercise, kind: z.literal('listening'), ...ChoiceFields, audioText: z.string().min(1).max(200) }),
])

/** v1 question shape — kept so cached v1 checks and the legacy fallback still parse. */
export const DarslikLegacyQuestionSchema = z.discriminatedUnion('kind', [
  z.object({ ...BaseExercise, kind: z.literal('mcq'), ...ChoiceFields }),
  z.object({ ...BaseExercise, kind: z.literal('input'), answers: z.array(z.string().min(1).max(100)).min(1).max(8) }),
])

export const DarslikQuestionSchema = z.union([DarslikExerciseSchema, DarslikLegacyQuestionSchema])

/** Variant/juftlik UNIKALLIGI uchun: registr muhim (звОнит ≠ звонИт). */
const normalizeDarslikOption = (value: string) => value.trim().replace(/\s+/g, ' ')
const uniqueNormalized = (values: string[]) => new Set(values.map(normalizeDarslikOption)).size === values.length

const LessonCheckSchema = z.object({
  format: z.literal('lesson'),
  questions: z.array(DarslikExerciseSchema).min(DARSLIK_LESSON_MIN_EXERCISES).max(DARSLIK_LESSON_MAX_EXERCISES),
}).superRefine(({ questions }, ctx) => {
  const ids = questions.map(question => question.id)
  const kinds = new Set(questions.map(question => question.kind))
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'Exercise IDs must be unique' })
  }
  if (kinds.size < DARSLIK_LESSON_MIN_KINDS) {
    ctx.addIssue({ code: 'custom', message: 'At least four exercise kinds are required' })
  }
  if (!kinds.has('listening')) {
    ctx.addIssue({ code: 'custom', message: 'At least one listening exercise is required' })
  }
  for (const question of questions) {
    if (question.kind === 'mcq' || question.kind === 'listening') {
      if (!uniqueNormalized(question.options)) {
        ctx.addIssue({ code: 'custom', message: `Options must be distinct: ${question.id}` })
      }
      if (question.kind === 'listening') {
        const audio = normalizeDarslikOption(question.audioText)
        if (question.options.some(option => normalizeDarslikOption(option) === audio)) {
          ctx.addIssue({ code: 'custom', message: `Listening answer must not repeat the audio text: ${question.id}` })
        }
      }
    }
    if (question.kind === 'word_bank') {
      if (!uniqueNormalized(question.tokens)) {
        ctx.addIssue({ code: 'custom', message: `Word bank tokens must be distinct: ${question.id}` })
      }
      const tokens = new Set(question.tokens.map(normalizeDarslikOption))
      if (question.answer.some(token => !tokens.has(normalizeDarslikOption(token)))) {
        ctx.addIssue({ code: 'custom', message: `Word bank answer must use its tokens: ${question.id}` })
      }
    }
    if (question.kind === 'match') {
      if (!uniqueNormalized(question.pairs.map(pair => pair.left)) || !uniqueNormalized(question.pairs.map(pair => pair.right))) {
        ctx.addIssue({ code: 'custom', message: `Match columns must be distinct: ${question.id}` })
      }
    }
  }
})

const LegacyCheckSchema = z.object({
  format: z.literal('legacy').optional(),
  questions: z.array(DarslikLegacyQuestionSchema).length(3),
}).superRefine(({ questions }, ctx) => {
  if (new Set(questions.map(question => question.id)).size !== questions.length ||
      questions.filter(question => question.kind === 'mcq').length !== 2 ||
      questions.filter(question => question.kind === 'input').length !== 1 ||
      questions.some(question => question.kind === 'mcq' && !uniqueNormalized(question.options))) {
    ctx.addIssue({ code: 'custom', message: 'Require unique IDs, two distinct-option tests and one written exercise' })
  }
})

export const DarslikCheckSchema = z.union([LessonCheckSchema, LegacyCheckSchema])

export type DarslikExercise = z.infer<typeof DarslikExerciseSchema>
export type DarslikLegacyQuestion = z.infer<typeof DarslikLegacyQuestionSchema>
export type DarslikQuestion = DarslikExercise | DarslikLegacyQuestion
export type DarslikCheck = z.infer<typeof DarslikCheckSchema>
export type DarslikCheckFormat = 'lesson' | 'legacy'

export type DarslikAnswerValue = string | string[]
export type DarslikAnswers = Record<string, DarslikAnswerValue>

export type DarslikPublicExercise =
  | { id: string; kind: 'mcq'; prompt: string; options: string[] }
  | { id: string; kind: 'input'; prompt: string }
  | { id: string; kind: 'word_bank'; prompt: string; tokens: string[] }
  | { id: string; kind: 'match'; prompt: string; left: string[]; right: string[] }
  | { id: string; kind: 'listening'; prompt: string; options: string[]; audioText: string }

export type DarslikPublicCheck = { format?: DarslikCheckFormat; questions: DarslikPublicExercise[] }

export type DarslikAnswerFeedback = {
  correct: boolean
  explanation: string
  correctAnswer: string
}

export type DarslikCheckResult = {
  passed: boolean
  correct: number
  total: number
  feedback: { id: string; correct: boolean; explanation: string; correctAnswer?: string }[]
  /** v2 natija ekrani uchun — server hisoblaydi. */
  accuracy?: number
  xpEarned?: number
  xp?: number | null
  dailyStreak?: number
  coinSaved?: boolean
  alreadyPassed?: boolean
}

export const DarslikAnswersSchema = z.record(
  z.string().min(1).max(30),
  z.union([
    z.string().trim().min(1).max(400),
    z.array(z.string().trim().min(1).max(100)).min(1).max(12),
  ]),
).refine(answers => Object.keys(answers).length >= 1 && Object.keys(answers).length <= 20)

export function normalizeDarslikAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')
}

function answerText(value: DarslikAnswerValue | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? value.join(' ') : value
}

function answerList(value: DarslikAnswerValue | undefined, separator?: RegExp): string[] {
  if (value === undefined) return []
  if (Array.isArray(value)) return value
  return value.split(separator ?? /\s+/)
}

function answerMatchesText(value: DarslikAnswerValue | undefined, expected: string[]): boolean {
  const text = normalizeDarslikAnswer(answerText(value))
  return expected.some(candidate => normalizeDarslikAnswer(candidate) === text)
}

function answerMatchesSequence(value: DarslikAnswerValue | undefined, expected: string[], separator?: RegExp): boolean {
  const actual = answerList(value, separator).map(normalizeDarslikAnswer)
  const target = expected.map(normalizeDarslikAnswer)
  return actual.length === target.length && actual.every((item, index) => item === target[index])
}

export function darslikCorrectAnswer(question: DarslikQuestion): string {
  switch (question.kind) {
    case 'mcq':
    case 'listening':
      return question.options[question.correctIndex] ?? ''
    case 'input':
      return question.answers[0] ?? ''
    case 'word_bank':
      return question.answer.join(' ')
    case 'match':
      return question.pairs.map(pair => `${pair.left} → ${pair.right}`).join('; ')
  }
}

export function gradeDarslikExercise(
  question: DarslikQuestion,
  answer: DarslikAnswerValue | undefined,
): DarslikAnswerFeedback {
  let correct = false
  switch (question.kind) {
    case 'mcq':
    case 'listening':
      correct = answerText(answer).trim() === String(question.correctIndex)
      break
    case 'input':
      correct = answerMatchesText(answer, question.answers)
      break
    case 'word_bank':
      correct = answerMatchesSequence(answer, question.answer)
      break
    case 'match':
      correct = answerMatchesSequence(answer, question.pairs.map(pair => pair.right), /,/)
      break
  }
  return { correct, explanation: question.explanation, correctAnswer: darslikCorrectAnswer(question) }
}

function seededShuffle<T>(values: readonly T[], seed: string): T[] {
  let state = 2166136261
  for (let index = 0; index < seed.length; index++) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  const next = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507)
    state = Math.imul(state ^ (state >>> 13), 3266489909)
    return (state ^= state >>> 16) >>> 0
  }
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) {
    const swap = next() % (index + 1)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

function publicExercise(question: DarslikQuestion): DarslikPublicExercise {
  switch (question.kind) {
    case 'mcq':
      return { id: question.id, kind: 'mcq', prompt: question.prompt, options: question.options }
    case 'input':
      return { id: question.id, kind: 'input', prompt: question.prompt }
    case 'word_bank':
      // Tokens include distractors; the accepted order lives only on the server.
      return { id: question.id, kind: 'word_bank', prompt: question.prompt, tokens: question.tokens }
    case 'match': {
      // Pair mapping is the answer key — the client receives an independent right column.
      // Identity permutation would expose the mapping visually; rotate in that case.
      const rights = question.pairs.map(pair => pair.right)
      const shuffled = seededShuffle(rights, question.id)
      const independent = shuffled.every((value, index) => value === rights[index]) && rights.length > 1
        ? rights.slice(1).concat(rights[0])
        : shuffled
      return {
        id: question.id,
        kind: 'match',
        prompt: question.prompt,
        left: question.pairs.map(pair => pair.left),
        right: independent,
      }
    }
    case 'listening':
      return { id: question.id, kind: 'listening', prompt: question.prompt, options: question.options, audioText: question.audioText }
  }
}

export function publicDarslikCheck(check: DarslikCheck): DarslikPublicCheck {
  return {
    format: check.format === 'lesson' ? 'lesson' : 'legacy',
    questions: check.questions.map(publicExercise),
  }
}

export function gradeDarslikCheck(check: DarslikCheck, answers: DarslikAnswers): DarslikCheckResult {
  const feedback = check.questions.map(question => {
    const graded = gradeDarslikExercise(question, answers[question.id])
    return { id: question.id, correct: graded.correct, explanation: graded.explanation, correctAnswer: graded.correctAnswer }
  })
  const correct = feedback.filter(item => item.correct).length
  return {
    passed: correct === check.questions.length && correct > 0,
    correct,
    total: check.questions.length,
    accuracy: check.questions.length ? Math.round((correct / check.questions.length) * 100) : 0,
    feedback,
  }
}

function answerIsComplete(kind: DarslikQuestion['kind'], requiredPairs: number, answer: DarslikAnswerValue | undefined): boolean {
  if (answer === undefined) return false
  if (kind === 'mcq' || kind === 'listening') {
    return typeof answer === 'string' && answer.trim().length > 0 && Number.isInteger(Number(answer))
  }
  if (kind === 'input') {
    return typeof answer === 'string' ? answer.trim().length > 0 : answer.length > 0
  }
  if (kind === 'word_bank') {
    return answerList(answer).filter(Boolean).length > 0
  }
  return answerList(answer, /,/).filter(Boolean).length >= requiredPairs
}

/** Har mashq uchun javob to'liqmi (server "incomplete" tekshiruvi bilan bir xil). */
export function isDarslikAnswerComplete(question: DarslikQuestion, answer: DarslikAnswerValue | undefined): boolean {
  return answerIsComplete(question.kind, question.kind === 'match' ? question.pairs.length : 0, answer)
}

/** Clientdagi public mashq uchun javob to'liqmi (correctIndex/answers public emas). */
export function isDarslikPublicAnswerComplete(exercise: DarslikPublicExercise, answer: DarslikAnswerValue | undefined): boolean {
  return answerIsComplete(exercise.kind, exercise.kind === 'match' ? exercise.left.length : 0, answer)
}

/** v2 dars uchun server hisoblaydigan XP (faqat birinchi passda beriladi). */
export function darslikLessonXp(correct: number, total: number): number {
  if (total <= 0) return 0
  const safeCorrect = Math.max(0, Math.min(correct, total))
  return 10 + safeCorrect * 2 + (safeCorrect === total ? 10 : 0)
}
