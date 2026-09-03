import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import achievementsRouter from '../../../server/modules/achievements/achievements.router'
import { achievementsService } from '../../../server/modules/achievements/achievements.service'
import { errorHandler } from '../../../server/middleware/error-handler'

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

  it('calls achievementsService and returns stats for matching userId', async () => {
    vi.spyOn(achievementsService, 'getUserStats').mockResolvedValue({
      totalCorrect: 10,
      totalAnswered: 15,
      octagonWins: 2,
      bestStreak: 4,
      totalFixed: 1,
      subjectAccuracy: [{ subjectId: 'yhq', answered: 15, accuracy: 67 }],
      allPassed80: false,
    })

    const res = await request(app)
      .get('/api/achievements/12345')
      .set('x-test-user-id', '12345')
      .expect(200)

    expect(achievementsService.getUserStats).toHaveBeenCalledWith('12345')
    expect(res.body.stats).toBeDefined()
    expect(res.body.stats.totalCorrect).toBe(10)
    expect(res.body.stats.totalAnswered).toBe(15)
    expect(res.body.stats.bestStreak).toBe(4)
    expect(res.body.stats.allPassed80).toBe(false)
  })
})
