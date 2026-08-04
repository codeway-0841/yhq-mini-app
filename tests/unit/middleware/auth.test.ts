/**
 * telegramAuth middleware unit tests — anti-spoofing (xavfsizlik chegarasi).
 * verifyInitData mock qilinadi; HMAC'ning o'zi alohida (utils/telegram) testda.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// verifyInitData'ni mock — middleware mantiqini izolyatsiyada tekshiramiz
vi.mock('../../../server/utils/telegram', () => ({
  verifyInitData: vi.fn(),
}))

import { telegramAuth } from '../../../server/middleware/auth'
import { verifyInitData } from '../../../server/utils/telegram'
import { config } from '../../../server/config'

const mockedVerify = vi.mocked(verifyInitData)

function mockReq(path: string, method = 'GET', body: unknown = {}, initData?: string) {
  return {
    path, method, body,
    headers: initData ? { 'x-telegram-init-data': initData } : {},
  } as unknown as Request
}

function mockRes() {
  const res = {
    statusCode: 200,
    body:       undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(payload: unknown) { this.body = payload; return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

const wasProd = process.env['NODE_ENV']

beforeEach(() => {
  vi.resetAllMocks()
  process.env['NODE_ENV'] = 'production'
  // @ts-expect-error — testda config'ni vaqtincha o'zgartiramiz
  config.telegram.botToken = 'TEST_TOKEN'
})

afterEach(() => {
  process.env['NODE_ENV'] = wasProd
})

describe('telegramAuth — production (auth MAJBURIY)', () => {
  it("PUBLIC GET (questions) authsiz o'tadi", () => {
    const next = vi.fn() as NextFunction
    telegramAuth(mockReq('/questions'), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('initData header yo\'q → 401', () => {
    const res = mockRes(); const next = vi.fn()
    telegramAuth(mockReq('/progress/111/result', 'POST'), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('yaroqsiz imzo → 401', () => {
    mockedVerify.mockReturnValue(null)
    const res = mockRes(); const next = vi.fn()
    telegramAuth(mockReq('/progress/111/result', 'POST', {}, 'fake-sig'), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
  })

  it('ANTI-SPOOF: /progress/:userId boshqa foydalanuvchiniki → 403', () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    telegramAuth(mockReq('/progress/999/result', 'POST', {}, 'sig'), res, next as NextFunction)
    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('o\'z userId\'si → o\'tadi va telegramUserId yoziladi', () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const req = mockReq('/progress/111/result', 'POST', {}, 'sig')
    const res = mockRes(); const next = vi.fn()
    telegramAuth(req, res, next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
    expect((req as { telegramUserId?: string }).telegramUserId).toBe('111')
  })

  it('/init: body id boshqaniki → 403', () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    telegramAuth(mockReq('/init', 'POST', { id: '999' }, 'sig'), res, next as NextFunction)
    expect(res.statusCode).toBe(403)
  })

  it('/init: o\'z id → o\'tadi', () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    telegramAuth(mockReq('/init', 'POST', { id: '111' }, 'sig'), res, next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('telegramAuth — dev rejim (auth o\'chiq)', () => {
  it('header\'siz o\'tadi', () => {
    process.env['NODE_ENV'] = 'development'
    const next = vi.fn()
    telegramAuth(mockReq('/progress/111/result', 'POST'), mockRes(), next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })
})
