import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import progressRouter from '../../../server/modules/progress/progress.router'
import { progressRepository } from '../../../server/modules/progress/progress.repository'
import { errorHandler } from '../../../server/middleware/error-handler'
import { config } from '../../../server/config'

function overviewApp(userId?: string) {
  const instance = express()
  if (userId) {
    instance.use((req, _res, next) => { (req as { userId?: string }).userId = userId; next() })
  }
  instance.use('/api', progressRouter)
  instance.use(errorHandler)
  return instance
}

describe('GET /api/progress/mistakes/overview (v2 Top-10 safe launch)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires authentication', async () => {
    const spy = vi.spyOn(progressRepository, 'getMistakesOverview')
    await request(overviewApp())
      .get('/api/progress/mistakes/overview?subjectId=yhq&language=uz')
      .expect(401)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns private no-store overview without master IDs or answers', async () => {
    vi.spyOn(progressRepository, 'getMistakesOverview').mockResolvedValue({
      total: 2,
      byTopic: [{ topicId: 9, count: 2 }],
      top: [{
        text: 'Qiyin savol',
        count: 3,
        topicId: 9,
        launchToken: 'lt1.fake.token.value',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      }],
    })
    const res = await request(overviewApp('user-1'))
      .get('/api/progress/mistakes/overview?subjectId=yhq&language=uz')
      .expect(200)

    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.body.total).toBe(2)
    expect(res.body.byTopic).toEqual([{ topicId: 9, count: 2 }])
    expect(res.body.top).toHaveLength(1)
    expect(res.body.top[0]).not.toHaveProperty('id')
    expect(res.body.top[0]).not.toHaveProperty('questionId')
    expect(res.body.top[0]).not.toHaveProperty('correctAnswer')
    expect(typeof res.body.top[0].launchToken).toBe('string')
  })

  it('fails closed without a proof secret', async () => {
    const spy = vi.spyOn(progressRepository, 'getMistakesOverview')
    const holder = config.testSessions as { proofSecret?: string }
    const orig = holder.proofSecret
    holder.proofSecret = undefined
    try {
      await request(overviewApp('user-1'))
        .get('/api/progress/mistakes/overview?subjectId=yhq&language=uz')
        .expect(503)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      holder.proofSecret = orig
    }
  })
})

describe('GET /api/progress/:userId/topic-progress (v2 aggregate)', () => {
  beforeEach(() => vi.restoreAllMocks())

  function topicApp(userId?: string) {
    const instance = express()
    if (userId) {
      instance.use((req, _res, next) => { (req as { userId?: string }).userId = userId; next() })
    }
    instance.use('/api', progressRouter)
    instance.use(errorHandler)
    return instance
  }

  it('returns per-topic solved counts without question IDs or answers', async () => {
    vi.spyOn(progressRepository, 'getTopicSolvedCounts').mockResolvedValue([
      { topicId: 10, solved: 4 },
      { topicId: 20, solved: 1 },
    ])

    const res = await request(topicApp('12345'))
      .get('/api/progress/12345/topic-progress?subjectId=yhq')
      .expect(200)

    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.body).toEqual({
      subjectId: 'yhq',
      topics: [
        { topicId: 10, solved: 4 },
        { topicId: 20, solved: 1 },
      ],
    })
  })

  it('rejects unknown subjects before touching the bank', async () => {
    const spy = vi.spyOn(progressRepository, 'getTopicSolvedCounts')
    await request(topicApp('user-1'))
      .get('/api/progress/user-1/topic-progress?subjectId=nope')
      .expect(400)
    expect(spy).not.toHaveBeenCalled()
  })
})
