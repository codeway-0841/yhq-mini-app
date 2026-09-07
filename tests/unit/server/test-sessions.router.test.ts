import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const service = vi.hoisted(() => ({
  create: vi.fn(),
  resume: vi.fn(),
  answer: vi.fn(),
  finish: vi.fn(),
}))
vi.mock('../../../server/modules/test-sessions/test-sessions.service', () => ({
  testSessionsService: service,
}))

import router from '../../../server/modules/test-sessions/test-sessions.router'
import { errorHandler } from '../../../server/middleware/error-handler'

const SESSION_ID = '7fb4fc6e-26a3-4d41-a6b4-21266ef5c9aa'

function app(userId?: string) {
  const instance = express()
  instance.use(express.json())
  if (userId) instance.use((req, _res, next) => { (req as { userId?: string }).userId = userId; next() })
  instance.use('/api', router)
  instance.use(errorHandler)
  return instance
}

describe('test-sessions v2 router contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires an authenticated owner even outside production', async () => {
    await request(app()).post('/api/test-sessions').send({
      subjectId: 'yhq', selector: { type: 'random', count: 20 }, language: 'uz',
    }).expect(401)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('validates create input and returns private no-store content', async () => {
    service.create.mockResolvedValue({
      session: { id: SESSION_ID, subjectId: 'yhq', mode: 'random', status: 'active', answered: 0, total: 20, expiresAt: '2026-09-07T12:00:00.000Z' },
      questions: [{ position: 0, deliveryToken: 'v1.token', expiresAt: '2026-09-07T12:00:00.000Z', text: 'Q', options: [], media: null, topic: null }],
      review: [],
    })

    const response = await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'yhq', selector: { type: 'random', count: 20 }, language: 'uz', ignored: 'stripped',
    }).expect(201)

    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(service.create).toHaveBeenCalledWith('user-1', {
      subjectId: 'yhq', selector: { type: 'random', count: 20 }, language: 'uz',
    })
    expect(response.body.questions[0]).not.toHaveProperty('correctAnswer')
    expect(response.body.questions[0]).not.toHaveProperty('masterQuestionId')
  })

  it('rejects unsupported counts and malformed session IDs before service', async () => {
    await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'yhq', selector: { type: 'random', count: 21 }, language: 'uz',
    }).expect(400)
    await request(app('user-1')).get('/api/test-sessions/not-a-uuid').expect(400)
    expect(service.create).not.toHaveBeenCalled()
    expect(service.resume).not.toHaveBeenCalled()
  })

  it('accepts only a positive bank-scoped topic selector', async () => {
    service.create.mockResolvedValue({ session: {}, questions: [], review: [] })
    await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'yhq', selector: { type: 'topic', topicId: 9 }, language: 'ru',
    }).expect(201)
    expect(service.create).toHaveBeenCalledWith('user-1', {
      subjectId: 'yhq', selector: { type: 'topic', topicId: 9 }, language: 'ru',
    })

    service.create.mockClear()
    await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'yhq', selector: { type: 'topic', topicId: 0 }, language: 'uz',
    }).expect(400)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('accepts only exam preset IDs from the shared registry', async () => {
    service.create.mockResolvedValue({ session: {}, questions: [], review: [] })
    await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'rustili',
      selector: { type: 'exam', presetId: 'milliy-sertifikat' },
      language: 'uz',
    }).expect(201)

    service.create.mockClear()
    await request(app('user-1')).post('/api/test-sessions').send({
      subjectId: 'rustili', selector: { type: 'exam', presetId: 'custom' }, language: 'uz',
    }).expect(400)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('passes only proof-bound answer fields to the service', async () => {
    service.answer.mockResolvedValue({ attempt: {}, append: [], session: {} })
    const body = {
      position: 3,
      deliveryToken: 'v1.abcdefghijklmnopqrstuvwxyz',
      expiresAt: '2026-09-07T12:00:00.000Z',
      selectedOptionId: 'F2',
      clientToken: 'client-token-123',
      elapsedMs: 1200,
      questionId: 999,
    }
    await request(app('user-1')).post(`/api/test-sessions/${SESSION_ID}/answers`).send(body).expect(200)
    expect(service.answer).toHaveBeenCalledWith('user-1', SESSION_ID, {
      position: 3,
      deliveryToken: body.deliveryToken,
      expiresAt: body.expiresAt,
      selectedOptionId: 'F2',
      clientToken: 'client-token-123',
      elapsedMs: 1200,
    })
  })
})
