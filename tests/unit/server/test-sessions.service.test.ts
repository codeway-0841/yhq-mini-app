import { beforeEach, describe, expect, it, vi } from 'vitest'

const TX = { marker: 'tx' }
const repo = vi.hoisted(() => ({
  create: vi.fn(),
  lockBankVersion: vi.fn(),
  listQuestionIds: vi.fn(),
  listSavedQuestionIds: vi.fn(),
  listMistakeQuestionIds: vi.fn(),
  lockOwned: vi.fn(),
  listAttempts: vi.fn(),
  findAttempt: vi.fn(),
  insertAttempt: vi.fn(),
  completeAttempt: vi.fn(),
  updateProgress: vi.fn(),
  setStatus: vi.fn(),
  getQuestions: vi.fn(),
}))
const recordAnswer = vi.hoisted(() => vi.fn())
const isPremiumUser = vi.hoisted(() => vi.fn())

vi.mock('../../../server/config', () => ({
  config: {
    testSessions: { proofSecret: '0123456789abcdef0123456789abcdef', bufferSize: 6, ttlMinutes: 180, marathonTtlMinutes: 300 },
    sentry: { dsn: undefined },
    deploy: { buildId: 'test' },
    isProd: false,
  },
}))
vi.mock('../../../server/db/connection', () => ({
  db: {},
  executeRows: vi.fn(),
  transactionBestEffort: (callback: (tx: unknown) => unknown) => callback(TX),
}))
vi.mock('../../../server/modules/test-sessions/test-sessions.repository', () => ({
  testSessionsRepository: repo,
}))
vi.mock('../../../server/modules/progress/progress.repository', () => ({
  progressRepository: { recordAnswer },
}))
vi.mock('../../../server/modules/boss/boss.repository', () => ({
  bossRepository: { applyDamage: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('../../../server/utils/premium', () => ({
  isPremiumUser,
}))
vi.mock('../../../server/config/subjects', () => ({
  resolveSubject: (id: string) => id === 'unknown'
    ? { id: 'yhq', isActive: true, dataSourceId: 'traffic_rules_db', examPresets: [] }
    : {
        id,
        isActive: true,
        dataSourceId: id === 'rustili' ? 'russian_db' : 'traffic_rules_db',
        examPresets: id === 'rustili' ? ['milliy-sertifikat', 'attestatsiya'] : [],
      },
}))

import { AppError } from '../../../server/middleware/error-handler'
import { createDeliveryToken } from '../../../server/modules/test-sessions/delivery-proof'
import { testSessionInternals, testSessionsService } from '../../../server/modules/test-sessions/test-sessions.service'
import lessonMap from '../../../shared/lesson-map.yhq.json'

const SESSION_ID = '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa'
const EXPIRES = new Date(Date.now() + 60 * 60_000)
const QUESTION = {
  id: 101,
  questionUz: 'Qaysi javob?',
  questionRu: 'Какой ответ?',
  optionsUz: { F1: 'Birinchi', F2: 'Ikkinchi' },
  optionsRu: { F1: 'Первый', F2: 'Второй' },
  image: null,
  topicId: 9,
  correctAnswer: 'F2',
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    userId: 'user-1',
    subjectId: 'yhq',
    bankId: 'traffic_rules_db',
    mode: 'random',
    selector: { type: 'random', count: 20, language: 'uz' },
    selectionSeed: 'seed',
    bankVersion: 1,
    questionIds: [101, 102, 103, 104, 105, 106, 107],
    totalQuestions: 20,
    issuedThrough: 5,
    answeredCount: 0,
    status: 'active',
    expiresAt: EXPIRES,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    ...overrides,
  }
}

function validAnswer(expiry = EXPIRES) {
  const expiresAt = expiry.toISOString()
  return {
    position: 0,
    deliveryToken: createDeliveryToken('0123456789abcdef0123456789abcdef', {
      userId: 'user-1', sessionId: SESSION_ID, subjectId: 'yhq', position: 0, expiresAt,
    }),
    expiresAt,
    selectedOptionId: 'F2',
    clientToken: 'client-token-123',
    elapsedMs: 1500,
  }
}

describe('testSessionsService security invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testSessionInternals.clearCandidateCache()
    repo.getQuestions.mockImplementation(async (ids: number[]) => ids.map((id) => ({ ...QUESTION, id })))
    repo.lockBankVersion.mockResolvedValue(1)
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 20 }, (_, index) => index + 1))
    repo.listSavedQuestionIds.mockResolvedValue([101, 102])
    repo.listMistakeQuestionIds.mockResolvedValue([103, 104])
    repo.lockOwned.mockResolvedValue(session())
    repo.findAttempt.mockResolvedValue(null)
    repo.insertAttempt.mockResolvedValue({ id: 77 })
    repo.completeAttempt.mockResolvedValue(undefined)
    repo.updateProgress.mockResolvedValue(undefined)
    recordAnswer.mockResolvedValue({
      updated: true,
      dailyStreak: 2,
      duplicate: false,
      coinBalance: 8,
      coinSaved: false,
      xp: 25,
      xpEarned: 10,
      coinsMinted: 1,
    })
    isPremiumUser.mockResolvedValue(true)
  })

  it('never exposes master IDs or answers in an unanswered create payload', async () => {
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))
    repo.getQuestions.mockImplementation(async (ids: number[]) => ids.map((id) => ({
      ...QUESTION, id, correctAnswer: id % 2 ? 'F1' : 'F2',
    })))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'random', count: 20 }, language: 'uz',
    })
    expect(result.questions).toHaveLength(6)
    for (const question of result.questions) {
      expect(question).not.toHaveProperty('id')
      expect(question).not.toHaveProperty('questionId')
      expect(question).not.toHaveProperty('correctAnswer')
      expect(question).not.toHaveProperty('bankId')
      expect(question.deliveryToken).toMatch(/^v1\./)
    }
    expect(repo.create.mock.calls[0]?.[0].questionIds).toHaveLength(20)
  })

  it('keeps product deadlines server-authoritative for every bounded mode', () => {
    expect(testSessionInternals.sessionTtlMinutes({ type: 'random', count: 20 })).toBe(30)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'random', count: 50 })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'random', count: 100 })).toBe(120)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'topic', topicId: 9 })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'mock' })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'saved' })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'mistakes' })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'ticket', ticketNumber: 2 })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'lesson', moduleId: 1, lessonIndex: 0 })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'module', moduleId: 1 })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'single', launchToken: 'lt1.dummy.token' })).toBe(25)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'marathon' })).toBe(300)
    expect(testSessionInternals.sessionTtlMinutes({ type: 'exam', presetId: 'milliy-sertifikat' })).toBe(180)
  })

  it('requires effective premium before creating paid test modes', async () => {
    isPremiumUser.mockResolvedValue(false)

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'random', count: 50 }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 403, message: 'premium_required' })
    expect(repo.lockBankVersion).not.toHaveBeenCalled()
  })

  it('allows premium users to create paid test modes', async () => {
    isPremiumUser.mockResolvedValue(true)
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 50 }, (_, i) => i + 1))
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'random', count: 50 }, language: 'uz',
    })
    expect(result.session.mode).toBe('random')
    expect(result.session.total).toBe(50)
  })

  it('runs marathon over the full server-owned pool with rolling delivery', async () => {
    const pool = Array.from({ length: 30 }, (_, index) => index + 1)
    repo.listQuestionIds.mockResolvedValue(pool)
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'marathon' }, language: 'uz',
    })

    const created = repo.create.mock.calls[0]?.[0] as { questionIds: number[] } | undefined
    expect(repo.listQuestionIds).toHaveBeenCalledWith('traffic_rules_db', TX, undefined, 'uz')
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'marathon',
      selector: { type: 'marathon', language: 'uz' },
      totalQuestions: 30,
    }), TX)
    expect(created?.questionIds).toHaveLength(30)
    expect([...(created?.questionIds ?? [])].sort((a, b) => a - b)).toEqual(pool)
    expect(result.session).toMatchObject({ mode: 'marathon', total: 30 })
    expect(result.questions).toHaveLength(6)
  })

  it('fails closed when marathon has no server-owned candidates', async () => {
    repo.listQuestionIds.mockResolvedValue([])

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'marathon' }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 409, message: 'not_enough_questions' })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('limits free topic practice to the shared preview count', async () => {
    isPremiumUser.mockResolvedValue(false)
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 30 }, (_, i) => i + 1))
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'topic', topicId: 9 }, language: 'uz',
    })
    expect(result.session.total).toBe(10)
  })

  it('allows premium topic practice to use the full bounded topic set', async () => {
    isPremiumUser.mockResolvedValue(true)
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 30 }, (_, i) => i + 1))
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'topic', topicId: 9 }, language: 'uz',
    })
    expect(result.session.total).toBe(30)
  })

  it('opens the first three tickets for free and keeps ticket selection server-owned', async () => {
    isPremiumUser.mockResolvedValue(false)
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 60 }, (_, i) => i + 1))
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'ticket', ticketNumber: 2 }, language: 'uz',
    })
    expect(result.session.mode).toBe('ticket')
    expect(result.session.total).toBe(20)
    expect(repo.create.mock.calls[0]?.[0].questionIds).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 21),
    )
  })

  it('requires premium for ticket four and later before reading the bank', async () => {
    isPremiumUser.mockResolvedValue(false)

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'ticket', ticketNumber: 4 }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 403, message: 'premium_required' })
    expect(repo.lockBankVersion).not.toHaveBeenCalled()
  })

  it('resolves a topic selector inside its subject bank without accepting master IDs', async () => {
    repo.listQuestionIds.mockResolvedValue([101, 102, 103])
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'topic', topicId: 9 }, language: 'uz',
    })

    expect(repo.listQuestionIds).toHaveBeenCalledWith('traffic_rules_db', TX, 9, 'uz')
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'topic',
      selector: { type: 'topic', topicId: 9, language: 'uz' },
      totalQuestions: 3,
    }), TX)
    expect(result.session).toMatchObject({ mode: 'topic', total: 3 })
    expect(result.questions).toHaveLength(3)
  })

  it('does not leak whether a topic exists in a different bank', async () => {
    repo.listQuestionIds.mockResolvedValue([])

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'topic', topicId: 999 }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'topic_not_found' })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('resolves a curated lesson from the shared server-owned map', async () => {
    const expected = lessonMap['1:0']
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq',
      selector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
      language: 'uz',
    })

    expect(repo.listQuestionIds).not.toHaveBeenCalled()
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'lesson',
      selector: { type: 'lesson', moduleId: 1, lessonIndex: 0, language: 'uz' },
      questionIds: expected,
      totalQuestions: expected.length,
    }), TX)
    expect(result.session).toMatchObject({ mode: 'lesson', total: expected.length })
  })

  it('resolves a module as the unique union of its curated lessons', async () => {
    const map = lessonMap as Record<string, number[]>
    const expected = [...new Set(Object.entries(map)
      .filter(([key]) => key.startsWith('1:'))
      .sort(([left], [right]) => Number(left.slice(2)) - Number(right.slice(2)))
      .flatMap(([, ids]) => ids))]
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'module', moduleId: 1 }, language: 'uz',
    })

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'module',
      questionIds: expected,
      totalQuestions: expected.length,
    }), TX)
    expect(result.session.total).toBe(expected.length)
  })

  it('fails closed for missing or stale curated sets and non-YHQ subjects', async () => {
    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq',
      selector: { type: 'lesson', moduleId: 999, lessonIndex: 0 },
      language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'curated_test_not_found' })

    repo.getQuestions.mockResolvedValue([])
    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq',
      selector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
      language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 409, message: 'curated_test_stale' })

    await expect(testSessionsService.create('user-1', {
      subjectId: 'rustili',
      selector: { type: 'lesson', moduleId: 1, lessonIndex: 0 },
      language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 400, message: 'selector_not_supported' })
  })

  it('derives exam count and duration only from a preset allowed for the subject', async () => {
    repo.listQuestionIds.mockResolvedValue(Array.from({ length: 60 }, (_, index) => index + 1))
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'rustili',
      selector: { type: 'exam', presetId: 'milliy-sertifikat' },
      language: 'ru',
    })

    expect(repo.listQuestionIds).toHaveBeenCalledWith('russian_db', TX, undefined, 'ru')
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'exam',
      totalQuestions: 45,
      selector: { type: 'exam', presetId: 'milliy-sertifikat', language: 'ru' },
    }), TX)
    expect(result.session).toMatchObject({ mode: 'exam', total: 45 })
  })

  it('rejects unknown subjects and selectors that do not belong to the subject', async () => {
    await expect(testSessionsService.create('user-1', {
      subjectId: 'unknown', selector: { type: 'random', count: 20 }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'subject_not_found' })

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'exam', presetId: 'attestatsiya' }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 400, message: 'exam_preset_not_supported' })

    await expect(testSessionsService.create('user-1', {
      subjectId: 'rustili', selector: { type: 'mock' }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 400, message: 'selector_not_supported' })
  })

  it('builds saved practice only from the authenticated owner and current subject bank', async () => {
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'saved' }, language: 'uz',
    })

    expect(repo.listSavedQuestionIds).toHaveBeenCalledWith(
      'user-1', 'yhq', 'traffic_rules_db', TX,
    )
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'saved', totalQuestions: 2, questionIds: expect.arrayContaining([101, 102]),
    }), TX)
    expect(result.session).toMatchObject({ mode: 'saved', total: 2 })
  })

  it('does not fall back to another user or bank when saved practice is empty', async () => {
    repo.listSavedQuestionIds.mockResolvedValue([])

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'saved' }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'saved_questions_empty' })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('builds mistake practice from unresolved server progress only', async () => {
    repo.create.mockImplementation(async (value: Record<string, unknown>) => ({
      ...value, createdAt: new Date(), lastActiveAt: new Date(),
    }))

    const result = await testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'mistakes' }, language: 'uz',
    })

    expect(repo.listMistakeQuestionIds).toHaveBeenCalledWith(
      'user-1', 'yhq', 'traffic_rules_db', TX,
    )
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'mistakes', totalQuestions: 2, questionIds: expect.arrayContaining([103, 104]),
    }), TX)
    expect(result.session).toMatchObject({ mode: 'mistakes', total: 2 })
  })

  it('returns an explicit empty state instead of widening mistake selection', async () => {
    repo.listMistakeQuestionIds.mockResolvedValue([])

    await expect(testSessionsService.create('user-1', {
      subjectId: 'yhq', selector: { type: 'mistakes' }, language: 'uz',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'mistakes_empty' })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('binds scoring to the delivered session position and commits canonical result once', async () => {
    const result = await testSessionsService.answer('user-1', SESSION_ID, validAnswer())

    expect(recordAnswer).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      subjectId: 'yhq',
      questionId: 101,
      correct: true,
      clientToken: `ts:${SESSION_ID}:client-token-123`,
      txOrDb: TX,
    }))
    expect(repo.completeAttempt).toHaveBeenCalledTimes(1)
    expect(result.attempt).toMatchObject({ correct: true, correctOptionId: 'F2', xpEarned: 10, coinsEarned: 1 })
    expect(result.append).toHaveLength(1)
    expect(result.append[0]).not.toHaveProperty('correctAnswer')
  })

  it('returns the stored canonical response for an exact retry without side effects', async () => {
    const canonical = { attempt: { position: 0, correct: true }, append: [], session: { id: SESSION_ID } }
    repo.findAttempt.mockResolvedValue({
      sessionId: SESSION_ID,
      userId: 'user-1',
      position: 0,
      clientToken: 'client-token-123',
      selectedOptionId: 'F2',
      resultPayload: canonical,
    })

    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer())).resolves.toEqual(canonical)
    expect(repo.insertAttempt).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(repo.updateProgress).not.toHaveBeenCalled()
  })

  it('returns an exact final-answer retry after the session became completed', async () => {
    const canonical = { attempt: { position: 0, correct: true }, append: [], session: { id: SESSION_ID, status: 'completed' } }
    repo.lockOwned.mockResolvedValue(session({ status: 'completed', answeredCount: 20, issuedThrough: 19 }))
    repo.findAttempt.mockResolvedValue({
      sessionId: SESSION_ID,
      userId: 'user-1',
      position: 0,
      clientToken: 'client-token-123',
      selectedOptionId: 'F2',
      resultPayload: canonical,
    })

    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer())).resolves.toEqual(canonical)
    expect(recordAnswer).not.toHaveBeenCalled()
  })

  it('rejects proof tampering and idempotency payload changes', async () => {
    await expect(testSessionsService.answer('user-1', SESSION_ID, {
      ...validAnswer(), deliveryToken: 'v1.tampered-token-value',
    })).rejects.toMatchObject<AppError>({ statusCode: 403, message: 'invalid_delivery_proof' })
    expect(recordAnswer).not.toHaveBeenCalled()

    repo.findAttempt.mockResolvedValue({
      sessionId: SESSION_ID,
      userId: 'user-1',
      position: 0,
      clientToken: 'client-token-123',
      selectedOptionId: 'F1',
      resultPayload: {},
    })
    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer()))
      .rejects.toMatchObject<AppError>({ statusCode: 409, message: 'answer_idempotency_conflict' })
  })

  it('rejects a new answer after the server-owned deadline', async () => {
    const expiredAt = new Date(Date.now() - 1000)
    repo.lockOwned.mockResolvedValue(session({ expiresAt: expiredAt }))

    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer(expiredAt)))
      .rejects.toMatchObject<AppError>({ statusCode: 410, message: 'test_session_expired' })
    expect(repo.insertAttempt).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
  })

  it('validates the option against the language-specific map that was delivered', async () => {
    repo.lockOwned.mockResolvedValue(session({
      selector: { type: 'random', count: 20, language: 'ru' },
    }))
    repo.getQuestions.mockResolvedValue([{
      ...QUESTION,
      optionsUz: { F1: 'Faqat o‘zbekcha' },
      optionsRu: { R1: 'Первый', R2: 'Второй' },
      correctAnswer: 'R2',
    }])

    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer()))
      .rejects.toMatchObject<AppError>({ statusCode: 400, message: 'invalid_option' })
    expect(repo.insertAttempt).not.toHaveBeenCalled()
  })

  it('fails closed when the question bank changed after session creation', async () => {
    repo.lockBankVersion.mockResolvedValue(2)
    await expect(testSessionsService.answer('user-1', SESSION_ID, validAnswer()))
      .rejects.toMatchObject<AppError>({ statusCode: 409, message: 'test_session_bank_changed' })
    expect(repo.insertAttempt).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
  })

  it('does not disclose a session owned by another user', async () => {
    repo.lockOwned.mockResolvedValue(null)
    await expect(testSessionsService.answer('user-2', SESSION_ID, {
      ...validAnswer(),
      deliveryToken: 'v1.any-valid-looking-token',
    })).rejects.toMatchObject<AppError>({ statusCode: 404, message: 'test_session_not_found' })
  })

  it('serializes finish through the owned session lock', async () => {
    const result = await testSessionsService.finish('user-1', SESSION_ID, 'abandoned')

    expect(repo.lockOwned).toHaveBeenCalledWith(SESSION_ID, 'user-1', TX)
    expect(repo.setStatus).toHaveBeenCalledWith(SESSION_ID, 'user-1', 'abandoned', TX)
    expect(result.status).toBe('abandoned')
  })
})
