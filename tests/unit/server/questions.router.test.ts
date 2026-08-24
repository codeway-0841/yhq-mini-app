import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import * as providers from '../../../server/providers'
import { questionsRepository } from '../../../server/modules/questions/questions.repository'

const app = createApp()

describe('server/modules/questions/questions.router.ts - Questions Router Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/questions', () => {
    it('returns questions without correctAnswer (scoring trust boundary)', async () => {
      const mockQuestions = [
        {
          id: 1,
          questionUz: 'Savol 1',
          questionRu: 'Вопрос 1',
          optionsUz: { a: '1', b: '2' },
          optionsRu: { a: '1', b: '2' },
          correctAnswer: 'a',
          topicId: 1,
        },
      ]

      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn().mockResolvedValue(mockQuestions),
        getQuestionsByTopic: vi.fn().mockResolvedValue(mockQuestions),
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn().mockResolvedValue(mockQuestions[0]),
      } as any)

      const res = await request(app).get('/api/questions').expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].correctAnswer).toBeUndefined()
      expect(res.body[0].questionUz).toBe('Savol 1')
    })

    it('returns 400 for invalid query parameters', async () => {
      const res = await request(app).get('/api/questions?topicId=invalid_id').expect(400)
      expect(res.body.error).toBe("Noto'g'ri so'rov parametrlari")
    })
  })

  describe('GET /api/topics', () => {
    it('returns list of topics', async () => {
      const mockTopics = [
        { id: 1, nameUz: 'Mavzu 1', nameRu: 'Тема 1', slug: 'mavzu-1', count: 10 },
      ]

      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn().mockResolvedValue([]),
        getQuestionsByTopic: vi.fn().mockResolvedValue([]),
        getTopics: vi.fn().mockResolvedValue(mockTopics),
        getQuestionById: vi.fn().mockResolvedValue(null),
      } as any)

      const res = await request(app).get('/api/topics?subject=yhq').expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].nameUz).toBe('Mavzu 1')
    })
  })

  describe('GET /api/questions/:questionId/explanation', () => {
    it('returns 400 for invalid questionId', async () => {
      const res = await request(app).get('/api/questions/not_a_number/explanation').expect(400)
      expect(res.body.error).toBe("Noto'g'ri questionId")
    })

    it('returns 400 for invalid lang', async () => {
      const res = await request(app).get('/api/questions/10/explanation?lang=fr').expect(400)
      expect(res.body.error).toBe("Noto'g'ri lang (uz|ru)")
    })

    it('returns 404 when explanation does not exist', async () => {
      vi.spyOn(questionsRepository, 'findExplanation').mockResolvedValue(null)

      const res = await request(app).get('/api/questions/999/explanation?lang=uz').expect(404)
      expect(res.body.error).toBe('explanation_not_found')
    })

    it('returns uzbek explanation text on success', async () => {
      vi.spyOn(questionsRepository, 'findExplanation').mockResolvedValue({
        explanationUz: 'Bu qoidaga muvofiq...',
        explanationRu: 'Согласно правилам...',
      })

      const res = await request(app).get('/api/questions/10/explanation?lang=uz').expect(200)
      expect(res.body.questionId).toBe(10)
      expect(res.body.text).toBe('Bu qoidaga muvofiq...')
    })

    it('returns russian explanation text when requested', async () => {
      vi.spyOn(questionsRepository, 'findExplanation').mockResolvedValue({
        explanationUz: 'Bu qoidaga muvofiq...',
        explanationRu: 'Согласно правилам...',
      })

      const res = await request(app).get('/api/questions/10/explanation?lang=ru').expect(200)
      expect(res.body.questionId).toBe(10)
      expect(res.body.text).toBe('Согласно правилам...')
    })
  })

  describe('GET /api/offline-package', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/offline-package?subject=yhq').expect(401)
      expect(res.body.error).toBeDefined()
    })

    it('returns questions WITH correctAnswer for authenticated requests', async () => {
      const mockQuestions = [
        {
          id: 1,
          questionUz: 'Savol 1',
          questionRu: 'Вопрос 1',
          optionsUz: { a: '1', b: '2' },
          optionsRu: { a: '1', b: '2' },
          correctAnswer: 'a',
          image: null,
          topicId: 1,
        },
      ]
      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn().mockResolvedValue(mockQuestions),
        getQuestionsByTopic: vi.fn().mockResolvedValue(mockQuestions),
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn().mockResolvedValue(mockQuestions[0]),
      } as any)

      // Dev/test muhitida imzosiz initData fallback qabul qilinadi
      // (server/middleware/auth.ts — devUnverifiedTelegramId, isAuthEnforced()===false).
      const FAKE_INIT_DATA =
        'query_id=DEV&user=%7B%22id%22%3A999999999%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1723000000&hash=dev'

      const res = await request(app)
        .get('/api/offline-package?subject=yhq')
        .set('x-telegram-init-data', FAKE_INIT_DATA)
        .expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].correctAnswer).toBe('a')
      expect(res.body[0].questionUz).toBe('Savol 1')
    })

    it('returns 400 for invalid query parameters', async () => {
      const FAKE_INIT_DATA =
        'query_id=DEV&user=%7B%22id%22%3A999999999%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1723000000&hash=dev'
      const res = await request(app)
        .get('/api/offline-package?subject=' + 'x'.repeat(40))
        .set('x-telegram-init-data', FAKE_INIT_DATA)
        .expect(400)
      expect(res.body.error).toBe("Noto'g'ri so'rov parametrlari")
    })
  })
})
