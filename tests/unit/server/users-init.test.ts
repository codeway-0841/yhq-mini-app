/**
 * POST /api/init — initData→Bearer exchange (v2, 2026-08-27).
 *
 * Qoida: Bearer sessiyasi YO'Q (initData bootstrap — req.sessionToken undefined)
 * bo'lsa server 30-kunlik opaque token chiqaradi (javobda `sessionToken`);
 * Bearer valid kelgan init'da yangi sessiya YARATILMAYDI (sessions jadvali
 * shishmasligi uchun) va javobda maydon yo'q.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const { issueSessionMock } = vi.hoisted(() => ({ issueSessionMock: vi.fn() }))
vi.mock('../../../server/modules/auth/session-issuer', () => ({ issueSession: issueSessionMock }))

import usersRouter from '../../../server/modules/users/users.router'
import { usersService } from '../../../server/modules/users/users.service'
import { errorHandler } from '../../../server/middleware/error-handler'

const FAKE_PROFILE = {
  user: { id: '12345', firstName: 'Test', tariff: 'free' },
  progress: { totalCorrect: 0, totalWrong: 0, totalAnswered: 0, streak: 0, wrongByTicket: {} },
  settings: { language: 'uz' },
  savedQuestions: [],
}

function makeApp(withSessionToken: boolean) {
  const app = express()
  app.use(express.json())
  if (withSessionToken) {
    // Global telegramAuth middleware'ining Bearer-resolve natijasini simulyatsiya
    app.use((req, _res, next) => { (req as { sessionToken?: string }).sessionToken = 'tok_valid'; next() })
  }
  app.use('/api', usersRouter)
  app.use(errorHandler)
  return app
}

describe('POST /api/init — sessiya issuance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(usersService, 'init').mockResolvedValue(FAKE_PROFILE as never)
    issueSessionMock.mockResolvedValue('new_opaque_token_64hex')
  })

  it('Bearer sessiya YO\'Q (initData bootstrap) → yangi token chiqariladi + javobda sessionToken', async () => {
    const res = await request(makeApp(false))
      .post('/api/init')
      .send({ id: '12345', first_name: 'Test' })
      .expect(200)

    expect(issueSessionMock).toHaveBeenCalledWith('12345', 'telegram')
    expect(res.body.sessionToken).toBe('new_opaque_token_64hex')
    expect(res.body.user.id).toBe('12345')
  })

  it('Bearer valid (req.sessionToken bor) → yangi sessiya YARATILMAYDI, javobda maydon yo\'q', async () => {
    const res = await request(makeApp(true))
      .post('/api/init')
      .send({ id: '12345', first_name: 'Test' })
      .expect(200)

    expect(issueSessionMock).not.toHaveBeenCalled()
    expect(res.body.sessionToken).toBeUndefined()
    expect(res.body.user.id).toBe('12345')
  })
})
