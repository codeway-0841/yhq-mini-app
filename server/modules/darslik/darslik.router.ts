import { Router } from 'express'
import { z } from 'zod'
import { config } from '../../config'
import { wrap, AppError } from '../../middleware/error-handler'
import { validate } from '../../middleware/validate'
import { dbRateLimit } from '../../middleware/db-rate-limiter'
import { callMetaJson } from '../ai-courses/meta-generator'
import {
  DARSLIK_LEGACY_CHECK_VERSION,
  DarslikAnswersSchema,
  DarslikCheckSchema,
  canOpenDarslikTopic,
  darslikLessonXp,
  gradeDarslikCheck,
  gradeDarslikExercise,
  isDarslikAnswerComplete,
  publicDarslikCheck,
  type DarslikAnswerValue,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'
import { tashkentDate } from '../../utils/date'
import { RUSSIAN_SUBJECT_ID } from '../../../shared/subjects'
import { darslikRepository } from './darslik.repository'
import { firstTopicCheck } from './first-topic'
import { buildFallbackCheck } from './fallback-check'
import { curatedDarslikCheck } from './curated'
import { dailyRepository } from '../daily/daily.repository'
import source from './source.json'

const router = Router()
const params = z.object({ topicId: z.string().regex(/^\d{1,2}:\d{1,3}$/) })
const topics: Record<string, { title: string; source: string }> = source
const DARSLIK_SUBJECT_ID = RUSSIAN_SUBJECT_ID

router.use('/darslik', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!(req as { userId?: string }).userId) return next(new AppError(401, 'UNAUTHORIZED'))
  next()
})

router.get('/darslik/progress', wrap(async (req, res) => {
  const userId = (req as unknown as { userId: string }).userId
  res.json({ passed: await darslikRepository.passed(userId) })
}))

async function requireTopicAccess(userId: string, topicId: string): Promise<string[]> {
  if (!topics[topicId]) throw new AppError(404, 'TOPIC_NOT_FOUND')
  const passed = await darslikRepository.passed(userId)
  if (!canOpenDarslikTopic(topicId, passed)) throw new AppError(403, 'TOPIC_LOCKED')
  return passed
}

type StoredCheck = { version: number; check: DarslikCheck }

/**
 * Mavzu testini yuklaydi: avval v2, deploy paytida ochilgan eski dars uchun v1.
 * v2 yo'q bo'lsa 409 — client avval /check chaqirishi kerak.
 */
async function loadStoredCheck(topicId: string): Promise<StoredCheck | null> {
  const stored = await darslikRepository.findCheck(topicId)
  if (!stored) return null
  const parsed = DarslikCheckSchema.safeParse(stored.payload)
  if (!parsed.success) return null
  return { version: stored.version, check: parsed.data }
}

/** AI javobi format maydonini tushirib qoldirsa, 5+ mashqni v2 deb qabul qilamiz. */
function normalizeAiCheck(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const value = raw as { format?: unknown; questions?: unknown }
  if (value.format === undefined && Array.isArray(value.questions) && value.questions.length >= 5) {
    return { ...value, format: 'lesson' }
  }
  return raw
}

const AI_FORMAT = {
  format: 'lesson',
  questions: [
    { id: 'q1', kind: 'mcq', prompt: '...', options: ['...', '...', '...', '...'], correctIndex: 0, explanation: '...' },
    { id: 'q2', kind: 'input', prompt: '...', answers: ['...'], explanation: '...' },
    { id: 'q3', kind: 'word_bank', prompt: '...', tokens: ['...', '...', '...', '...'], answer: ['...', '...'], explanation: '...' },
    { id: 'q4', kind: 'match', prompt: '...', pairs: [{ left: '...', right: '...' }, { left: '...', right: '...' }, { left: '...', right: '...' }], explanation: '...' },
    { id: 'q5', kind: 'listening', prompt: '...', audioText: '...', options: ['...', '...', '...', '...'], correctIndex: 0, explanation: '...' },
  ],
}

async function generateCheck(topicId: string, topic: { title: string; source: string }): Promise<DarslikCheck | null> {
  const curated = curatedDarslikCheck(topicId)
  if (curated) return darslikRepository.saveCheck(topicId, curated)

  // 1:0 uchun eski qo'lda yozilgan test — curated topilmasa ham zaxira.
  if (topicId === '1:0') return darslikRepository.saveCheck(topicId, firstTopicCheck)

  let aiError: unknown
  if (config.ai.metaApiKey) {
    try {
      const raw = await callMetaJson(config.ai.metaApiKey,
        'Ты преподаватель русского языка. Создай короткий интерактивный урок строго по данной теме: 5–7 заданий и минимум 4 разных типа из списка mcq, input, word_bank, match, listening. Обязательно включи хотя бы одно задание listening. Каждый вопрос должен проверять понимание и применение, а не запоминание названия раздела. Все ответы должны быть однозначными и основанными на источнике. Для listening в audioText укажи слово или короткую фразу, которую произнесёт синтезатор речи; ответ не должен быть самой этой фразой. Только русский язык и JSON. Не используй последующие темы.',
        JSON.stringify({ topic: topic.title, source: topic.source, format: AI_FORMAT }),
        fetch,
        { timeoutMs: 45_000, maxTokens: 4200 },
      )
      const parsed = DarslikCheckSchema.safeParse(normalizeAiCheck(raw))
      if (parsed.success) return darslikRepository.saveCheck(topicId, parsed.data)
      aiError = new Error('AI check schema invalid')
    } catch (error) {
      aiError = error
    }
  } else {
    aiError = new Error('META_API_KEY is not configured')
  }

  // AI provayderi billing/kvota xatosi bersa ham mavzu yopilib qolmasin:
  // manba matnidan deterministik 2 test + 1 amaliy topshiriq yasaymiz.
  console.warn(
    '[darslik] AI check generation failed, using fallback:',
    topicId,
    aiError instanceof Error ? aiError.message.slice(0, 200) : String(aiError),
  )
  const fallback = buildFallbackCheck(topic, topics)
  if (fallback) return darslikRepository.saveCheck(topicId, fallback)

  // Oxirgi chora: eski v1 test bo'lsa, uni v2 jurnaliga ko'chiramiz.
  const legacy = await darslikRepository.check(topicId, DARSLIK_LEGACY_CHECK_VERSION)
  if (legacy) {
    const parsed = DarslikCheckSchema.safeParse(legacy)
    if (parsed.success) return darslikRepository.saveCheck(topicId, parsed.data)
  }
  return null
}

router.post('/darslik/:topicId/check', dbRateLimit({ maxPerMinute: 6, bucket: 'darslik-check', keyFn: req => (req as { userId?: string }).userId ?? req.ip }), validate({ params }), wrap(async (req, res) => {
  const topicId = req.params.topicId as string
  await requireTopicAccess((req as unknown as { userId: string }).userId, topicId)

  let check: DarslikCheck | null = await darslikRepository.check(topicId)
  if (!check) check = await generateCheck(topicId, topics[topicId])
  if (!check) throw new AppError(503, 'PRACTICE_UNAVAILABLE')
  const parsed = DarslikCheckSchema.safeParse(check)
  if (!parsed.success) throw new AppError(503, 'PRACTICE_UNAVAILABLE')
  res.json(publicDarslikCheck(parsed.data))
}))

const AnswerBody = z.object({
  exerciseId: z.string().min(1).max(30),
  answer: z.union([
    z.string().max(400),
    z.array(z.string().max(100)).max(12),
  ]),
})

router.post('/darslik/:topicId/answer', dbRateLimit({ maxPerMinute: 60, bucket: 'darslik-answer', keyFn: req => (req as { userId?: string }).userId ?? req.ip }), validate({ params, body: AnswerBody }), wrap(async (req, res) => {
  const userId = (req as unknown as { userId: string }).userId
  const topicId = req.params.topicId as string
  await requireTopicAccess(userId, topicId)
  const stored = await loadStoredCheck(topicId)
  if (!stored) throw new AppError(409, 'PRACTICE_NOT_STARTED')
  const exercise = stored.check.questions.find(question => question.id === req.body.exerciseId)
  if (!exercise) throw new AppError(404, 'EXERCISE_NOT_FOUND')
  const answer = req.body.answer as DarslikAnswerValue
  res.json(gradeDarslikExercise(exercise, answer))
}))

router.post('/darslik/:topicId/submit', dbRateLimit({ maxPerMinute: 20, bucket: 'darslik-submit', keyFn: req => (req as { userId?: string }).userId ?? req.ip }), validate({ params, body: z.object({ answers: DarslikAnswersSchema }) }), wrap(async (req, res) => {
  const userId = (req as unknown as { userId: string }).userId
  const topicId = req.params.topicId as string
  const passedTopics = await requireTopicAccess(userId, topicId)
  const stored = await loadStoredCheck(topicId)
  if (!stored) throw new AppError(409, 'PRACTICE_NOT_STARTED')
  const { check } = stored
  const answers = req.body.answers as Record<string, DarslikAnswerValue>
  if (!check.questions.every(question => isDarslikAnswerComplete(question, answers[question.id]))) {
    throw new AppError(400, 'PRACTICE_INCOMPLETE')
  }

  const result = gradeDarslikCheck(check, answers)
  const alreadyPassed = passedTopics.includes(topicId)
  let xpEarned = 0
  let xp: number | null = null
  let dailyStreak: number | undefined
  let coinSaved: boolean | undefined

  if (result.passed) {
    const date = tashkentDate()
    const pass = await darslikRepository.passWithXp({
      userId,
      topicId,
      date,
      xp: darslikLessonXp(result.correct, result.total),
    })
    xpEarned = pass.xpEarned
    xp = pass.xp
    try {
      // Mavjud kunlik faollik/streak tizimi — yangi streak store yaratilmaydi.
      const daily = await dailyRepository.touchActivity(
        userId,
        date,
        DARSLIK_SUBJECT_ID,
        pass.passedNow ? result.total : 0,
        pass.passedNow ? result.correct : 0,
      )
      dailyStreak = daily.dailyStreak
      coinSaved = daily.coinSaved
    } catch (error) {
      // Dars pass bo'ldi — streak xatosi natijani yoki keyingi mavzuni buzmaydi.
      console.warn('[darslik] daily activity update failed:', topicId, error instanceof Error ? error.message : String(error))
    }
  }

  res.json({
    ...result,
    xpEarned,
    xp,
    dailyStreak,
    coinSaved,
    alreadyPassed,
  })
}))

export default router
