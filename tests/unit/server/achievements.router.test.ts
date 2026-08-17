import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import achievementsRouter from '../../../server/modules/achievements/achievements.router'
import { errorHandler } from '../../../server/middleware/error-handler'
import { db } from '../../../server/db/connection'

const app = express()
app.use(express.json())
// Mock auth middleware injects req.userId
app.use((req: any, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.userId = req.headers['x-test-user-id']
  }
  next()
})
app.use('/api', achievementsRouter)
app.use(errorHandler)

describe('achievements.router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects access with 403 when req.userId does not match target userId (requireSelf in production)', async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const res = await request(app)
        .get('/api/achievements/12345')
        .set('x-test-user-id', '99999')
        .expect(403)

      expect(res.body.error).toContain('Forbidden')
    } finally {
      process.env.NODE_ENV = prevEnv
    }
  })

  it('returns default zero stats for new user with matching userId', async () => {
    vi.spyOn(db, 'select').mockImplementation((() => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        groupBy: () => [],
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      }
      return chain
    }) as any)

    const res = await request(app)
      .get('/api/achievements/12345')
      .set('x-test-user-id', '12345')
      .expect(200)

    expect(res.body.stats).toBeDefined()
    expect(res.body.stats.totalCorrect).toBe(0)
    expect(res.body.stats.totalAnswered).toBe(0)
    expect(res.body.stats.bestStreak).toBe(0)
    expect(res.body.stats.allPassed80).toBe(false)
  })
})
