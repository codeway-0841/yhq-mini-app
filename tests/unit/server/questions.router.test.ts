import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createApp } from '../../../server/app'
import * as providers from '../../../server/providers'
import { questionsRepository, escapeLikePattern } from '../../../server/modules/questions/questions.repository'
import questionsRouter from '../../../server/modules/questions/questions.router'
import { testSessionsRepository } from '../../../server/modules/test-sessions/test-sessions.repository'
import { errorHandler } from '../../../server/middleware/error-handler'
import { verifyLaunchToken } from '../../../server/modules/test-sessions/launch-token'
import { config } from '../../../server/config'

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
        getPublicQuestions: vi.fn().mockResolvedValue(mockQuestions),
        getQuestionsByTopic: vi.fn().mockResolvedValue(mockQuestions),
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn().mockResolvedValue(mockQuestions[0]),
      } as any)

      const res = await request(app).get('/api/questions').expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].correctAnswer).toBeUndefined()
      expect(res.body[0].questionUz).toBe('Savol 1')
    })

    it('EGRESS (2026-09-24): full-bank yo\'li getPublicQuestions ishlatadi — getAllQuestions EMAS', async () => {
      const publicRows = [
        {
          id: 1,
          questionUz: 'Savol 1',
          questionRu: 'Вопрос 1',
          optionsUz: { a: '1', b: '2' },
          optionsRu: { a: '1', b: '2' },
          topicId: 1,
        },
      ]
      const getAllQuestions = vi.fn()
      const getPublicQuestions = vi.fn().mockResolvedValue(publicRows)
      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions,
        getPublicQuestions,
        getQuestionsByTopic: vi.fn(),
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn(),
      } as any)

      const res = await request(app).get('/api/questions').expect(200)

      // correct_answer Neon'dan umuman tortilmaydi — faqat public proyeksiya:
      expect(getPublicQuestions).toHaveBeenCalledTimes(1)
      expect(getAllQuestions).not.toHaveBeenCalled()
      expect(res.body[0]).not.toHaveProperty('correctAnswer')
    })

    it('topicId yo\'li getQuestionsByTopic\'da qoladi (o\'zgarishsiz)', async () => {
      const getQuestionsByTopic = vi.fn().mockResolvedValue([
        { id: 9, questionUz: 'T', questionRu: 'T', optionsUz: {}, optionsRu: {}, correctAnswer: 'a', topicId: 5 },
      ])
      const getPublicQuestions = vi.fn()
      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn(),
        getPublicQuestions,
        getQuestionsByTopic,
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn(),
      } as any)

      const res = await request(app).get('/api/questions?topicId=5').expect(200)

      expect(getQuestionsByTopic).toHaveBeenCalledWith(5)
      expect(getPublicQuestions).not.toHaveBeenCalled()
      // topicId yo'li hali to'liq qator — toPublic() defense-in-depth kesadi:
      expect(res.body[0]).not.toHaveProperty('correctAnswer')
    })

    it('returns 400 for invalid query parameters', async () => {
      const res = await request(app).get('/api/questions?topicId=invalid_id').expect(400)
      expect(res.body.error).toBe("Noto'g'ri so'rov parametrlari")
    })

    it('returns 410 without touching the bank when the legacy bank is contracted', async () => {
      const spy = vi.spyOn(providers, 'getProvider')
      const holder = config.legacy as { questionBankEnabled: boolean }
      const orig = holder.questionBankEnabled
      holder.questionBankEnabled = false
      try {
        const res = await request(app).get('/api/questions').expect(410)
        expect(res.body.error).toBe('legacy_question_bank_disabled')
        expect(spy).not.toHaveBeenCalled()
      } finally {
        holder.questionBankEnabled = orig
      }
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
      vi.spyOn(questionsRepository, 'countByTopic').mockResolvedValue(new Map([[1, 10]]))

      const res = await request(app).get('/api/topics?subject=yhq').expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].nameUz).toBe('Mavzu 1')
      // Katalog metadata — full-bank'siz UI uchun son, javob kalitsiz
      expect(res.body[0].questionCount).toBe(10)
      expect(res.body[0]).not.toHaveProperty('correctAnswer')
    })

  it('still returns the catalog when counts fail (fail-open metadata)', async () => {
      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn().mockResolvedValue([]),
        getQuestionsByTopic: vi.fn().mockResolvedValue([]),
        getTopics: vi.fn().mockResolvedValue([{ id: 2, nameUz: 'M2', nameRu: 'T2', slug: 'm2' }]),
        getQuestionById: vi.fn().mockResolvedValue(null),
      } as any)
      vi.spyOn(questionsRepository, 'countByTopic').mockRejectedValue(new Error('db down'))

      const res = await request(app).get('/api/topics?subject=yhq').expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].questionCount).toBe(0)
    })
  })
})

describe('GET /api/ticket-catalog (v2 ticket manifest)', () => {
  it('returns counts only — no question text, options, IDs or answers', async () => {
    vi.spyOn(testSessionsRepository, 'listQuestionIds').mockResolvedValue(
      Array.from({ length: 45 }, (_, i) => i + 1),
    )

    const res = await request(app).get('/api/ticket-catalog?subject=yhq&language=uz').expect(200)

    expect(res.body).toEqual({
      subjectId: 'yhq',
      ticketSize: 20,
      ticketCount: 2,
      totalQuestions: 45,
    })
    expect(res.headers['cache-control']).toContain('public')
  })

  it('returns 400 for invalid query parameters', async () => {
    await request(app).get('/api/ticket-catalog?language=fr').expect(400)
  })

  it('returns an empty catalog for an empty bank', async () => {
    vi.spyOn(testSessionsRepository, 'listQuestionIds').mockResolvedValue([])

    const res = await request(app).get('/api/ticket-catalog?subject=yhq').expect(200)
    expect(res.body.ticketCount).toBe(0)
    expect(res.body.totalQuestions).toBe(0)
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

describe('GET /api/questions/search (v2 safe launch)', () => {
  // Izolyatsiya mount: global auth/CDN middleware'siz, req.userId to'g'ridan-to'g'ri inject.
  function searchApp(userId?: string) {
    const instance = express()
    if (userId) {
      instance.use((req, _res, next) => { (req as { userId?: string }).userId = userId; next() })
    }
    instance.use('/api', questionsRouter)
    instance.use(errorHandler)
    return instance
  }

  it('requires authentication even outside production', async () => {
    const spy = vi.spyOn(questionsRepository, 'search')
    await request(searchApp())
      .get('/api/questions/search?subjectId=yhq&query=toxtash&language=uz')
      .expect(401)
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects short queries before touching the bank', async () => {
    const spy = vi.spyOn(questionsRepository, 'search')
    await request(searchApp('user-1'))
      .get('/api/questions/search?subjectId=yhq&query=a&language=uz')
      .expect(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns launch-token hits without master IDs or answers', async () => {
    vi.spyOn(questionsRepository, 'search').mockResolvedValue([
      { id: 101, text: 'Savol matni', topicId: 9 },
    ])
    const res = await request(searchApp('user-1'))
      .get('/api/questions/search?subjectId=yhq&query=savol&language=uz')
      .expect(200)

    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.body.hits).toHaveLength(1)
    const hit = res.body.hits[0]
    expect(hit.text).toBe('Savol matni')
    expect(hit.topicId).toBe(9)
    expect(typeof hit.launchToken).toBe('string')
    expect(hit).not.toHaveProperty('id')
    expect(hit).not.toHaveProperty('questionId')
    expect(hit).not.toHaveProperty('correctAnswer')

    // Token o'sha user+fan'ga bound — begona user ishlatolmaydi
    const secret = config.testSessions.proofSecret
    expect(secret).toBeTruthy()
    expect(verifyLaunchToken(secret!, { userId: 'user-1', subjectId: 'yhq' }, hit.launchToken)?.questionId).toBe(101)
    expect(verifyLaunchToken(secret!, { userId: 'user-2', subjectId: 'yhq' }, hit.launchToken)).toBeNull()
  })

  it('fails closed without a proof secret', async () => {
    vi.spyOn(questionsRepository, 'search').mockResolvedValue([
      { id: 1, text: 'Q', topicId: null },
    ])
    const holder = config.testSessions as { proofSecret?: string }
    const orig = holder.proofSecret
    holder.proofSecret = undefined
    try {
      await request(searchApp('user-1'))
        .get('/api/questions/search?subjectId=yhq&query=savol&language=uz')
        .expect(503)
    } finally {
      holder.proofSecret = orig
    }
  })
})

describe('escapeLikePattern', () => {
  it('escapes SQL LIKE wildcards so "%%" cannot enumerate the bank', () => {
    expect(escapeLikePattern('%%')).toBe('\\%\\%')
    expect(escapeLikePattern('a_b\\c')).toBe('a\\_b\\\\c')
    expect(escapeLikePattern("to'xtash")).toBe("to'xtash")
  })
})
