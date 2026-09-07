import { createHmac, randomBytes, randomUUID } from 'crypto'
import { config } from '../../config'
import { transactionBestEffort } from '../../db/connection'
import { AppError } from '../../middleware/error-handler'
import { resolveSubject } from '../../config/subjects'
import { progressRepository } from '../progress/progress.repository'
import { bossRepository } from '../boss/boss.repository'
import { bossPeriodKey, BOSS_DAMAGE_PER_CORRECT } from '../../../shared/boss-battle'
import { tashkentDate } from '../../utils/date'
import { Sentry } from '../../utils/sentry'
import { getExamPreset } from '../../../shared/exam-presets'
import type {
  CreateTestSessionInput,
  DeliveredTestQuestion,
  SubmitTestAnswerInput,
  TestAnswerResponse,
  TestSessionResponse,
  TestSessionState,
} from '../../../shared/test-session'
import { createDeliveryToken, verifyDeliveryToken } from './delivery-proof'
import {
  testSessionsRepository,
  type SessionQuestionRow,
  type TestSessionRow,
} from './test-sessions.repository'

const MAX_TOPIC_QUESTIONS = 100
const MAX_CANDIDATE_CACHE_ENTRIES = 64
const candidateCache = new Map<string, readonly number[]>()

async function candidateQuestionIds(
  bankId: string,
  bankVersion: number,
  topicId: number | undefined,
  language: 'uz' | 'ru',
  tx: Parameters<typeof testSessionsRepository.listQuestionIds>[1],
): Promise<number[]> {
  const key = `${bankId}:${bankVersion}:${language}:${topicId ?? 'all'}`
  const hit = candidateCache.get(key)
  if (hit) return [...hit]
  const ids = await testSessionsRepository.listQuestionIds(bankId, tx, topicId, language)
  candidateCache.set(key, ids)
  if (candidateCache.size > MAX_CANDIDATE_CACHE_ENTRIES) {
    const oldest = candidateCache.keys().next().value
    if (oldest !== undefined) candidateCache.delete(oldest)
  }
  return [...ids]
}

function sessionTtlMinutes(selector: CreateTestSessionInput['selector']): number {
  const productMinutes = selector.type === 'exam'
    ? getExamPreset(selector.presetId)?.durationMinutes ?? 25
    : selector.type === 'mock' || selector.type === 'topic'
      || selector.type === 'saved' || selector.type === 'mistakes'
      ? 25
      : selector.count === 20
        ? 30
        : selector.count === 50
          ? 25
          : 120
  return Math.min(productMinutes, config.testSessions.ttlMinutes)
}

function proofSecret(): string {
  const secret = config.testSessions.proofSecret
  if (!secret) throw new AppError(503, 'test_sessions_unavailable')
  return secret
}

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function stateOf(row: TestSessionRow): TestSessionState {
  return {
    id: row.id,
    subjectId: row.subjectId,
    mode: row.mode as TestSessionState['mode'],
    status: row.status as TestSessionState['status'],
    answered: row.answeredCount,
    total: row.totalQuestions,
    expiresAt: normalizeDate(row.expiresAt).toISOString(),
  }
}

/** HMAC-sort: tanlov takrorlanuvchi, lekin client uchun oldindan topib bo'lmaydi. */
function selectQuestionIds(ids: number[], seed: string, count: number): number[] {
  return ids
    .map((id) => ({
      id,
      rank: createHmac('sha256', seed).update(String(id)).digest('hex'),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.id - b.id)
    .slice(0, count)
    .map((item) => item.id)
}

function shuffledOptions(row: SessionQuestionRow, language: 'uz' | 'ru', seed: string, position: number) {
  const map = language === 'ru' ? row.optionsRu : row.optionsUz
  return Object.entries(map)
    .map(([id, text]) => ({
      id,
      text,
      rank: createHmac('sha256', seed).update(`${position}:${id}`).digest('hex'),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id))
    .map(({ id, text }) => ({ id, text }))
}

function languageOf(row: TestSessionRow): 'uz' | 'ru' {
  return row.selector['language'] === 'ru' ? 'ru' : 'uz'
}

async function deliveredQuestions(
  row: TestSessionRow,
  positions: number[],
  tx?: Parameters<typeof testSessionsRepository.getQuestions>[2],
): Promise<DeliveredTestQuestion[]> {
  if (positions.length === 0) return []
  const ids = positions.map((position) => row.questionIds[position]).filter((id): id is number => Number.isInteger(id))
  const questionRows = await testSessionsRepository.getQuestions(ids, row.bankId, tx)
  const byId = new Map(questionRows.map((question) => [question.id, question]))
  const expiresAt = normalizeDate(row.expiresAt).toISOString()
  const language = languageOf(row)
  const secret = proofSecret()

  return positions.map((position) => {
    const questionId = row.questionIds[position]
    const question = questionId === undefined ? undefined : byId.get(questionId)
    if (!question) throw new AppError(409, 'test_session_bank_changed')
    return {
      position,
      deliveryToken: createDeliveryToken(secret, {
        userId: row.userId,
        sessionId: row.id,
        subjectId: row.subjectId,
        position,
        expiresAt,
      }),
      expiresAt,
      text: language === 'ru' ? question.questionRu : question.questionUz,
      options: shuffledOptions(question, language, row.selectionSeed, position),
      media: question.image,
      topic: question.topicId === null ? null : { id: question.topicId },
    }
  })
}

function ensureActive(row: TestSessionRow): void {
  if (row.status !== 'active') throw new AppError(409, `test_session_${row.status}`)
  if (normalizeDate(row.expiresAt).getTime() <= Date.now()) {
    throw new AppError(410, 'test_session_expired')
  }
}

export const testSessionsService = {
  async create(userId: string, input: CreateTestSessionInput): Promise<TestSessionResponse> {
    const subject = resolveSubject(input.subjectId)
    if (subject.id !== input.subjectId) throw new AppError(404, 'subject_not_found')
    if (!subject.isActive) throw new AppError(400, 'subject_inactive')
    if (input.selector.type === 'mock' && input.subjectId !== 'yhq') {
      throw new AppError(400, 'selector_not_supported')
    }
    if (input.selector.type === 'exam' && !subject.examPresets.includes(input.selector.presetId)) {
      throw new AppError(400, 'exam_preset_not_supported')
    }
    proofSecret()
    return transactionBestEffort(async (tx) => {
      const bankVersion = await testSessionsRepository.lockBankVersion(subject.dataSourceId, tx)
      if (bankVersion === null) throw new AppError(404, 'question_bank_not_found')
      const topicId = input.selector.type === 'topic' ? input.selector.topicId : undefined
      const allQuestionIds = input.selector.type === 'saved'
        ? await testSessionsRepository.listSavedQuestionIds(
            userId, input.subjectId, subject.dataSourceId, tx,
          )
        : input.selector.type === 'mistakes'
          ? await testSessionsRepository.listMistakeQuestionIds(
              userId, input.subjectId, subject.dataSourceId, tx,
            )
        : await candidateQuestionIds(
            subject.dataSourceId, bankVersion, topicId, input.language, tx,
          )
      if (input.selector.type === 'topic' && allQuestionIds.length === 0) {
        throw new AppError(404, 'topic_not_found')
      }
      if (input.selector.type === 'saved' && allQuestionIds.length === 0) {
        throw new AppError(404, 'saved_questions_empty')
      }
      if (input.selector.type === 'mistakes' && allQuestionIds.length === 0) {
        throw new AppError(404, 'mistakes_empty')
      }
      if (input.selector.type === 'random' && allQuestionIds.length < input.selector.count) {
        throw new AppError(409, 'not_enough_questions')
      }

      const requestedCount = input.selector.type === 'random'
        ? input.selector.count
        : input.selector.type === 'topic'
          ? Math.min(allQuestionIds.length, MAX_TOPIC_QUESTIONS)
          : input.selector.type === 'saved' || input.selector.type === 'mistakes'
            ? Math.min(allQuestionIds.length, MAX_TOPIC_QUESTIONS)
            : input.selector.type === 'mock'
              ? 20
              : getExamPreset(input.selector.presetId)!.questionCount
      if (input.selector.type !== 'topic' && allQuestionIds.length < requestedCount) {
        throw new AppError(409, 'not_enough_questions')
      }

      const selectionSeed = randomBytes(32).toString('hex')
      const questionIds = selectQuestionIds(allQuestionIds, selectionSeed, requestedCount)
      const initialIssued = Math.min(questionIds.length, config.testSessions.bufferSize) - 1
      const expiresAt = new Date(Date.now() + sessionTtlMinutes(input.selector) * 60_000)
      const row = await testSessionsRepository.create({
        id: randomUUID(),
        userId,
        subjectId: input.subjectId,
        bankId: subject.dataSourceId,
        mode: input.selector.type,
        selector: { ...input.selector, language: input.language },
        selectionSeed,
        bankVersion,
        questionIds,
        totalQuestions: questionIds.length,
        issuedThrough: initialIssued,
        answeredCount: 0,
        status: 'active',
        expiresAt,
        lastActiveAt: new Date(),
      }, tx)
      const positions = Array.from({ length: initialIssued + 1 }, (_, index) => index)
      return { session: stateOf(row), questions: await deliveredQuestions(row, positions, tx), review: [] }
    })
  },

  async resume(userId: string, sessionId: string): Promise<TestSessionResponse> {
    return transactionBestEffort(async (tx) => {
      const row = await testSessionsRepository.lockOwned(sessionId, userId, tx)
      if (!row) throw new AppError(404, 'test_session_not_found')
      ensureActive(row)
      const bankVersion = await testSessionsRepository.lockBankVersion(row.bankId, tx)
      if (bankVersion === null || bankVersion !== row.bankVersion) {
        throw new AppError(409, 'test_session_bank_changed')
      }
      const attempts = await testSessionsRepository.listAttempts(sessionId, tx)
      const answered = new Set(attempts.map((attempt) => attempt.position))
      const positions = Array.from({ length: row.issuedThrough + 1 }, (_, index) => index)
        .filter((position) => !answered.has(position))
      const review = attempts.map((attempt) => {
        const payload = attempt.resultPayload as unknown as Partial<TestAnswerResponse>
        const correctOptionId = payload.attempt?.correctOptionId
        if (!correctOptionId) throw new AppError(409, 'test_attempt_incomplete')
        return {
          position: attempt.position,
          selectedOptionId: attempt.selectedOptionId,
          correct: attempt.correct,
          correctOptionId,
        }
      })
      return { session: stateOf(row), questions: await deliveredQuestions(row, positions, tx), review }
    })
  },

  async answer(userId: string, sessionId: string, input: SubmitTestAnswerInput): Promise<TestAnswerResponse> {
    const result = await transactionBestEffort(async (tx) => {
      const row = await testSessionsRepository.lockOwned(sessionId, userId, tx)
      if (!row) throw new AppError(404, 'test_session_not_found')
      if (input.position > row.issuedThrough || input.position >= row.totalQuestions) {
        throw new AppError(400, 'question_not_issued')
      }

      const expiresAt = normalizeDate(row.expiresAt).toISOString()
      if (input.expiresAt !== expiresAt || !verifyDeliveryToken(proofSecret(), {
        userId,
        sessionId,
        subjectId: row.subjectId,
        position: input.position,
        expiresAt,
      }, input.deliveryToken)) {
        throw new AppError(403, 'invalid_delivery_proof')
      }

      const existing = await testSessionsRepository.findAttempt(
        sessionId, userId, input.position, input.clientToken, tx,
      )
      if (existing) {
        const exact = existing.sessionId === sessionId
          && existing.position === input.position
          && existing.clientToken === input.clientToken
          && existing.selectedOptionId === input.selectedOptionId
        if (!exact) throw new AppError(409, 'answer_idempotency_conflict')
        return { response: existing.resultPayload as unknown as TestAnswerResponse, applyBoss: false }
      }

      // Exact retry yuqorida active/expiry'dan OLDIN qaytariladi: ayniqsa oxirgi
      // javob commit bo'lib session completed bo'lgach HTTP response yo'qolsa,
      // o'sha clientToken canonical natijani yana olishi shart. Yangi urinishlar
      // esa quyidagi lifecycle guard'dan o'tmaydi.
      ensureActive(row)

      const bankVersion = await testSessionsRepository.lockBankVersion(row.bankId, tx)
      if (bankVersion === null || bankVersion !== row.bankVersion) {
        throw new AppError(409, 'test_session_bank_changed')
      }

      const questionId = row.questionIds[input.position]
      if (!Number.isInteger(questionId)) throw new AppError(409, 'test_session_bank_changed')
      const [question] = await testSessionsRepository.getQuestions([questionId!], row.bankId, tx)
      if (!question) throw new AppError(409, 'test_session_bank_changed')
      const deliveredOptionMap = languageOf(row) === 'ru' ? question.optionsRu : question.optionsUz
      if (!(input.selectedOptionId in deliveredOptionMap)) throw new AppError(400, 'invalid_option')
      const correct = input.selectedOptionId === question.correctAnswer
      const now = new Date()
      const elapsedServer = Math.max(0, now.getTime() - normalizeDate(row.lastActiveAt).getTime())

      const attempt = await testSessionsRepository.insertAttempt({
        sessionId,
        userId,
        position: input.position,
        questionId: question.id,
        selectedOptionId: input.selectedOptionId,
        correct,
        clientToken: input.clientToken,
        resultPayload: {},
        elapsedMsClient: input.elapsedMs ?? null,
        elapsedMsServer: elapsedServer,
        answeredAt: now,
      }, tx)

      const progressResult = await progressRepository.recordAnswer({
        userId,
        correct,
        questionId: question.id,
        date: tashkentDate(),
        subjectId: row.subjectId,
        clientToken: `ts:${sessionId}:${input.clientToken}`,
        elapsedMs: input.elapsedMs,
        txOrDb: tx,
      })
      if (!progressResult.updated) throw new AppError(404, 'progress_not_initialized')

      const answeredCount = row.answeredCount + 1
      const issuedThrough = Math.min(
        row.totalQuestions - 1,
        Math.max(row.issuedThrough, answeredCount + config.testSessions.bufferSize - 1),
      )
      const status = answeredCount >= row.totalQuestions ? 'completed' : 'active'
      await testSessionsRepository.updateProgress(sessionId, {
        issuedThrough,
        answeredCount,
        ...(status === 'completed' ? { status } : {}),
      }, tx)

      const updatedRow = { ...row, issuedThrough, answeredCount, status, lastActiveAt: now }
      const newPositions = Array.from(
        { length: Math.max(0, issuedThrough - row.issuedThrough) },
        (_, index) => row.issuedThrough + 1 + index,
      )
      const response: TestAnswerResponse = {
        attempt: {
          position: input.position,
          correct,
          correctOptionId: question.correctAnswer,
          duplicate: progressResult.duplicate,
          dailyStreak: progressResult.dailyStreak,
          xp: progressResult.xp,
          xpEarned: progressResult.xpEarned,
          coinsEarned: progressResult.coinsMinted,
          coinBalance: progressResult.coinBalance,
          coinSaved: progressResult.coinSaved,
        },
        append: await deliveredQuestions(updatedRow, newPositions, tx),
        session: stateOf(updatedRow),
      }
      await testSessionsRepository.completeAttempt(attempt.id, response as unknown as Record<string, unknown>, tx)
      return { response, applyBoss: correct && !progressResult.duplicate }
    })

    if (result.applyBoss) {
      await bossRepository.applyDamage(userId, bossPeriodKey(), BOSS_DAMAGE_PER_CORRECT).catch((error) => {
        Sentry.captureException(error, { tags: { feature: 'test-sessions-v2', stage: 'boss-damage' } })
      })
    }
    return result.response
  },

  async finish(userId: string, sessionId: string, status: 'completed' | 'abandoned'): Promise<TestSessionState> {
    return transactionBestEffort(async (tx) => {
      const row = await testSessionsRepository.lockOwned(sessionId, userId, tx)
      if (!row) throw new AppError(404, 'test_session_not_found')
      if (row.status === 'expired') throw new AppError(410, 'test_session_expired')
      if (row.status !== 'active' && row.status !== status) throw new AppError(409, `test_session_${row.status}`)
      if (row.status === 'active') await testSessionsRepository.setStatus(sessionId, userId, status, tx)
      return stateOf({ ...row, status })
    })
  },
}

export const testSessionInternals = {
  selectQuestionIds,
  sessionTtlMinutes,
  clearCandidateCache: () => candidateCache.clear(),
}
