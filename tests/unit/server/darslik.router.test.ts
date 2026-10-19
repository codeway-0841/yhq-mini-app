import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = vi.hoisted(() => ({
  passed: vi.fn(),
  check: vi.fn(),
  checkRecord: vi.fn(),
  findCheck: vi.fn(),
  ensureCurated: vi.fn(),
  saveCheck: vi.fn(),
  invalidate: vi.fn(),
  passWithXp: vi.fn(),
}))
const daily = vi.hoisted(() => ({ touchActivity: vi.fn() }))
const meta = vi.hoisted(() => ({ callMetaJson: vi.fn() }))

vi.mock('../../../server/modules/darslik/darslik.repository', () => ({
  darslikRepository: repo,
}))
vi.mock('../../../server/modules/daily/daily.repository', () => ({
  dailyRepository: daily,
}))
vi.mock('../../../server/middleware/db-rate-limiter', () => ({
  dbRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../../../server/modules/ai-courses/meta-generator', () => ({
  callMetaJson: meta.callMetaJson,
}))

import darslikRouter from '../../../server/modules/darslik/darslik.router'
import { errorHandler } from '../../../server/middleware/error-handler'
import { firstTopicCheck } from '../../../server/modules/darslik/first-topic'
import { block01Checks } from '../../../server/modules/darslik/curated/block-01'
import {
  DARSLIK_CHECK_VERSION,
  DarslikCheckSchema,
  gradeDarslikCheck,
  type DarslikAnswers,
  type DarslikCheck,
} from '../../../shared/darslik-mastery'

function makeApp(userId?: string) {
  const app = express()
  app.use(express.json())
  if (userId) {
    app.use((req, _res, next) => {
      ;(req as unknown as { userId: string }).userId = userId
      next()
    })
  }
  app.use('/api', darslikRouter)
  app.use(errorHandler)
  return app
}

const topicPath = (topicId: string) => encodeURIComponent(topicId)
const BLOCK_1_PASSED = Array.from({ length: 12 }, (_, index) => '1:' + index)

function answersFor(check: DarslikCheck): DarslikAnswers {
  return Object.fromEntries(check.questions.map(question => {
    switch (question.kind) {
      case 'mcq':
      case 'listening':
        return [question.id, String(question.correctIndex)]
      case 'input':
        return [question.id, question.answers[0]]
      case 'word_bank':
        return [question.id, question.answer]
      case 'match':
        return [question.id, question.pairs.map(pair => pair.right)]
    }
  }))
}

beforeEach(() => {
  repo.passed.mockReset().mockResolvedValue([])
  repo.check.mockReset().mockResolvedValue(null)
  repo.checkRecord.mockReset().mockResolvedValue(null)
  repo.findCheck.mockReset().mockResolvedValue(null)
  repo.ensureCurated.mockReset().mockImplementation(async (_topicId: string, payload: unknown) => payload)
  repo.saveCheck.mockReset().mockImplementation(async (_topicId: string, payload: unknown) => payload)
  repo.passWithXp.mockReset().mockResolvedValue({ passedNow: true, xp: 132, xpEarned: 32 })
  daily.touchActivity.mockReset().mockResolvedValue({ dailyStreak: 4, coinSaved: false })
  meta.callMetaJson.mockReset()
})

describe('darslik router — auth va qulf', () => {
  it('credentials’siz 401 qaytaradi', async () => {
    const res = await request(makeApp()).get('/api/darslik/progress')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('UNAUTHORIZED')
  })

  it('progress faqat shu foydalanuvchiniki va no-store', async () => {
    repo.passed.mockResolvedValue(['1:0', '1:1'])
    const res = await request(makeApp('u1')).get('/api/darslik/progress')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ passed: ['1:0', '1:1'] })
    expect(res.headers['cache-control']).toContain('no-store')
    expect(repo.passed).toHaveBeenCalledWith('u1')
  })

  it('oldingi mavzu o‘tilmagan bo‘lsa check 403', async () => {
    const res = await request(makeApp('u1')).post('/api/darslik/' + topicPath('1:1') + '/check')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('TOPIC_LOCKED')
    expect(repo.saveCheck).not.toHaveBeenCalled()
  })

  it('mavjud bo‘lmagan mavzu 404', async () => {
    const res = await request(makeApp('u1')).post('/api/darslik/99:0/check')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TOPIC_NOT_FOUND')
  })
})

describe('darslik router — curated pilot darsi', () => {
  it('1:0 uchun 5–7 mashqli, 4+ turdagi darsni AI’siz qaytaradi', async () => {
    const res = await request(makeApp('u1')).post('/api/darslik/' + topicPath('1:0') + '/check')
    expect(res.status).toBe(200)
    expect(res.body.format).toBe('lesson')
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5)
    expect(res.body.questions.length).toBeLessThanOrEqual(7)
    const kinds = new Set(res.body.questions.map((question: { kind: string }) => question.kind))
    expect(kinds.size).toBeGreaterThanOrEqual(4)
    expect(kinds.has('listening')).toBe(true)
    expect(JSON.stringify(res.body)).not.toContain('correctIndex')
    expect(JSON.stringify(res.body)).not.toContain('"explanation"')
    expect(JSON.stringify(res.body)).not.toContain('"correctAnswer"')
    expect(repo.ensureCurated).toHaveBeenCalledWith('1:0', block01Checks['1:0'])
    expect(repo.saveCheck).not.toHaveBeenCalled()
    expect(meta.callMetaJson).not.toHaveBeenCalled()
  })

  it('barcha javoblar to‘g‘ri bo‘lsa XP, streak va mastery qaytaradi', async () => {
    const check = block01Checks['1:0']
    repo.findCheck.mockResolvedValue({ version: 2, payload: check })
    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers: answersFor(check) })

    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    expect(res.body.correct).toBe(6)
    expect(res.body.accuracy).toBe(100)
    expect(res.body.xpEarned).toBe(32)
    expect(res.body.xp).toBe(132)
    expect(res.body.dailyStreak).toBe(4)
    expect(res.body.alreadyPassed).toBe(false)
    expect(repo.passWithXp).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      topicId: '1:0',
      xp: 32,
    }))
    expect(daily.touchActivity).toHaveBeenCalledWith('u1', expect.any(String), 'rustili', 6, 6)
  })

  it('takroriy pass kunlik faollik/streakni qayta yozmaydi', async () => {
    const check = block01Checks['1:0']
    repo.findCheck.mockResolvedValue({ version: 2, payload: check })
    repo.passed.mockResolvedValue(['1:0'])
    repo.passWithXp.mockResolvedValue({ passedNow: false, xp: 132, xpEarned: 0 })

    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers: answersFor(check) })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ passed: true, alreadyPassed: true, xpEarned: 0, xp: 132 })
    expect(daily.touchActivity).not.toHaveBeenCalled()
  })

  it('bitta xato bo‘lsa mastery yozilmaydi va XP berilmaydi', async () => {
    const check = block01Checks['1:0']
    repo.findCheck.mockResolvedValue({ version: 2, payload: check })
    const answers = answersFor(check)
    const first = check.questions[0]
    answers[first.id] = first.kind === 'listening' || first.kind === 'mcq' ? '3' : 'x'

    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers })

    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(false)
    expect(res.body.correct).toBe(5)
    expect(res.body.xpEarned).toBe(0)
    expect(repo.passWithXp).not.toHaveBeenCalled()
    expect(daily.touchActivity).not.toHaveBeenCalled()
  })

  it('javob to‘liq bo‘lmasa 400 PRACTICE_INCOMPLETE', async () => {
    repo.findCheck.mockResolvedValue({ version: 2, payload: block01Checks['1:0'] })
    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers: { '1:0:1': '1' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('PRACTICE_INCOMPLETE')
  })

  it('bitta mashqni darhol baholaydi va to‘g‘ri javobni qaytaradi', async () => {
    repo.findCheck.mockResolvedValue({ version: 2, payload: block01Checks['1:0'] })
    const app = makeApp('u1')

    const correct = await request(app)
      .post('/api/darslik/' + topicPath('1:0') + '/answer')
      .send({ exerciseId: '1:0:1', answer: '1' })
    expect(correct.status).toBe(200)
    expect(correct.body.correct).toBe(true)
    expect(correct.body.correctAnswer).toBe('Звуки')
    expect(correct.body.explanation).toContain('Звуки мы произносим')

    const wrong = await request(app)
      .post('/api/darslik/' + topicPath('1:0') + '/answer')
      .send({ exerciseId: '1:0:1', answer: '0' })
    expect(wrong.status).toBe(200)
    expect(wrong.body.correct).toBe(false)
    expect(wrong.body.correctAnswer).toBe('Звуки')
  })

  it('noma’lum mashq uchun 404', async () => {
    repo.findCheck.mockResolvedValue({ version: 2, payload: block01Checks['1:0'] })
    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/answer')
      .send({ exerciseId: 'nope', answer: '0' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('EXERCISE_NOT_FOUND')
  })
})

describe('darslik router — v1 moslik va fallback', () => {
  it('deploy paytida yuklangan v1 darsni ham baholaydi', async () => {
    repo.findCheck.mockResolvedValue({ version: 1, payload: firstTopicCheck })
    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers: { sound: '1', horse: '2', count: '3' } })

    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    expect(repo.passWithXp).toHaveBeenCalled()
  })

  it('v2 test hali yaratilmagan bo‘lsa submit 409', async () => {
    const res = await request(makeApp('u1'))
      .post('/api/darslik/' + topicPath('1:0') + '/submit')
      .send({ answers: { sound: '1', horse: '2', count: '3' } })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('PRACTICE_NOT_STARTED')
  })

  it('AI xato bersa ham manbadan fallback test yasaydi', async () => {
    repo.passed.mockResolvedValue(BLOCK_1_PASSED)
    meta.callMetaJson.mockRejectedValue(new Error('402 billing_not_configured'))
    const res = await request(makeApp('u1')).post('/api/darslik/' + topicPath('2:0') + '/check')

    expect(res.status).toBe(200)
    expect(res.body.format).toBe('legacy')
    expect(res.body.questions).toHaveLength(3)
    expect(res.body.questions.filter((question: { kind: string }) => question.kind === 'mcq')).toHaveLength(2)
    expect(res.body.questions.filter((question: { kind: string }) => question.kind === 'input')).toHaveLength(1)
    expect(repo.saveCheck).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { source: 'fallback' })

    const payload = repo.saveCheck.mock.calls[repo.saveCheck.mock.calls.length - 1]?.[1]
    expect(DarslikCheckSchema.safeParse(payload).success).toBe(true)
  })

  it('AI javobi valid bo‘lsa source ai bilan keshlanadi', async () => {
    repo.passed.mockResolvedValue(BLOCK_1_PASSED)
    meta.callMetaJson.mockResolvedValue(block01Checks['1:0'])

    const res = await request(makeApp('u1')).post('/api/darslik/' + topicPath('2:0') + '/check')

    expect(res.status).toBe(200)
    expect(res.body.format).toBe('lesson')
    expect(repo.saveCheck).toHaveBeenCalledWith('2:0', block01Checks['1:0'], { source: 'ai' })
  })

  it('curated dars javob kalitlari bilan ham o‘z-o‘zidan o‘tadi', () => {
    const check = block01Checks['1:0']
    const parsed = DarslikCheckSchema.safeParse(check)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(gradeDarslikCheck(parsed.data, answersFor(parsed.data)).passed).toBe(true)
    expect(DARSLIK_CHECK_VERSION).toBe(2)
  })
})
