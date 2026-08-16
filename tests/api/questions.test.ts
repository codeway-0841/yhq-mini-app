import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'
import * as providers from '../../server/providers'

const app = createApp()

describe('Questions API Endpoints & Trust Boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(providers, 'getProvider').mockReturnValue({
      getAllQuestions: vi.fn().mockResolvedValue([
        {
          id: 1,
          questionUz: 'Savol 1',
          questionRu: 'Вопрос 1',
          optionsUz: { a: '1', b: '2' },
          optionsRu: { a: '1', b: '2' },
          correctAnswer: 'a',
          topicId: 1,
        },
      ]),
      getQuestionsByTopic: vi.fn().mockResolvedValue([]),
      getTopics: vi.fn().mockResolvedValue([
        { id: 1, nameUz: 'Mavzu 1', nameRu: 'Тема 1', slug: 'mavzu-1', count: 10 },
      ]),
      getQuestionById: vi.fn().mockResolvedValue(null),
    } as any)
  })

  it('GET /api/questions returns question array without correctAnswer exposed', async () => {
    const res = await request(app).get('/api/questions?subject=yhq')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    if (res.body.length > 0) {
      const firstQuestion = res.body[0]
      expect(firstQuestion).toHaveProperty('id')
      expect(firstQuestion).toHaveProperty('questionUz')
      expect(firstQuestion).toHaveProperty('optionsUz')
      // Trust boundary check: client MUST NOT receive correctAnswer
      expect(firstQuestion).not.toHaveProperty('correctAnswer')
    }
  })

  it('GET /api/questions rejects invalid topicId format with 400', async () => {
    const res = await request(app).get('/api/questions?topicId=invalid_topic')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('GET /api/topics returns list of topics', async () => {
    const res = await request(app).get('/api/topics?subject=yhq')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/questions/:id/explanation rejects invalid question ID with 400', async () => {
    const res = await request(app).get('/api/questions/abc/explanation')
    expect(res.status).toBe(400)
  })
})
