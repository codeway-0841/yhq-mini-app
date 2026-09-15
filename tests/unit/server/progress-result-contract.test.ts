import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import progressRouter from '../../../server/modules/progress/progress.router'
import { errorHandler } from '../../../server/middleware/error-handler'
import { config } from '../../../server/config'
import * as providers from '../../../server/providers'

function resultApp(userId?: string) {
  const instance = express()
  instance.use(express.json())
  if (userId) {
    instance.use((req, _res, next) => { (req as { userId?: string }).userId = userId; next() })
  }
  instance.use('/api', progressRouter)
  instance.use(errorHandler)
  return instance
}

describe('POST /api/progress/:userId/result legacy contraction (v2 Phase 4)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns 410 without touching the bank when legacy result is disabled', async () => {
    const spy = vi.spyOn(providers, 'getProvider')
    const holder = config.legacy as { resultEnabled: boolean }
    const orig = holder.resultEnabled
    holder.resultEnabled = false
    try {
      const res = await request(resultApp('user-1'))
        .post('/api/progress/user-1/result')
        .send({ questionId: 1, selectedAnswer: 'F1', subjectId: 'yhq', clientToken: 'tok-12345' })
        .expect(410)
      expect(res.body.error).toBe('legacy_result_disabled')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      holder.resultEnabled = orig
    }
  })

  it('keeps the legacy path while the flag is on (default)', async () => {
    // Invalid body → zod validate 400 (contraction emas) — flag ON ekanini isbotlaydi
    await request(resultApp('user-1'))
      .post('/api/progress/user-1/result')
      .send({ questionId: -5, selectedAnswer: 'F1', subjectId: 'yhq' })
      .expect(400)
  })
})
