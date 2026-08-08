/**
 * telegramAuth middleware unit tests — anti-spoofing (xavfsizlik chegarasi).
 * verifyInitData + authRepository mock qilinadi; HMAC/scrypt alohida testlarda.
 * Middleware ASYNC — barcha chaqiruvlar await qilinadi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// verifyInitData'ni mock — middleware mantiqini izolyatsiyada tekshiramiz
vi.mock('../../../server/utils/telegram', () => ({
  verifyInitData: vi.fn(),
}))

// Session resolve DB'siz mock qilinadi
vi.mock('../../../server/modules/auth/auth.repository', () => ({
  authRepository: {
    resolveSession: vi.fn(),
  },
}))

import { telegramAuth, requireAuth, requireSelf } from '../../../server/middleware/auth'
import { verifyInitData } from '../../../server/utils/telegram'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { config } from '../../../server/config'

const mockedVerify  = vi.mocked(verifyInitData)
const mockedResolve = vi.mocked(authRepository.resolveSession)

function mockReq(path: string, method = 'GET', body: unknown = {}, headers: { initData?: string; bearer?: string } = {}) {
  return {
    path, method, body,
    headers: {
      ...(headers.initData ? { 'x-telegram-init-data': headers.initData } : {}),
      ...(headers.bearer ? { authorization: `Bearer ${headers.bearer}` } : {}),
    },
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

describe('telegramAuth — production, initData yo\'li (Mini App)', () => {
  it("PUBLIC GET (questions) authsiz o'tadi", async () => {
    const next = vi.fn() as NextFunction
    await telegramAuth(mockReq('/questions'), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('credentials yo\'q → 401', async () => {
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/progress/111/result', 'POST'), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('yaroqsiz imzo → 401', async () => {
    mockedVerify.mockReturnValue(null)
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/progress/111/result', 'POST', {}, { initData: 'fake-sig' }), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
  })

  it.each([
    '/progress/999/result',
    '/daily/999/activity',
    '/achievements/999',
  ])('ANTI-SPOOF: %s boshqa foydalanuvchiniki → 403', async (path) => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq(path, 'POST', {}, { initData: 'sig' }), res, next as NextFunction)
    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('o\'z userId\'si → o\'tadi va req.userId yoziladi', async () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const req = mockReq('/progress/111/result', 'POST', {}, { initData: 'sig' })
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(req, res, next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
    expect((req as { userId?: string }).userId).toBe('111')
  })

  it('/init: body id boshqaniki → 403', async () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/init', 'POST', { id: '999' }, { initData: 'sig' }), res, next as NextFunction)
    expect(res.statusCode).toBe(403)
  })

  it('/init: o\'z id → o\'tadi', async () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/init', 'POST', { id: '111' }, { initData: 'sig' }), res, next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })

  it('PUBLIC auth POST (login) credentials\'siz o\'tadi', async () => {
    for (const p of ['/auth/phone/register', '/auth/phone/login', '/auth/telegram']) {
      const next = vi.fn() as NextFunction
      await telegramAuth(mockReq(p, 'POST'), mockRes(), next)
      expect(next).toHaveBeenCalledOnce()
    }
  })
})

describe('telegramAuth — production, Bearer session yo\'li (telefon/widget)', () => {
  it('valid session → o\'tadi, req.userId + sessionToken yoziladi', async () => {
    mockedResolve.mockResolvedValue({ userId: 'p_998901234567', provider: 'phone' })
    const req = mockReq('/auth/me', 'GET', {}, { bearer: 'tok123' })
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(req, res, next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
    expect((req as { userId?: string }).userId).toBe('p_998901234567')
    expect((req as { sessionToken?: string }).sessionToken).toBe('tok123')
  })

  it('eskirgan/bekor session → 401 invalid_session', async () => {
    mockedResolve.mockResolvedValue(null)
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/auth/me', 'GET', {}, { bearer: 'dead-token' }), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
    expect((res.body as { error?: string })?.error).toBe('invalid_session')
    expect(next).not.toHaveBeenCalled()
  })

  it('ANTI-SPOOF: session userId begona :userId bilan → 403', async () => {
    mockedResolve.mockResolvedValue({ userId: 'p_998901234567', provider: 'phone' })
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/progress/p_998999999999/result', 'POST', {}, { bearer: 'tok' }), res, next as NextFunction)
    expect(res.statusCode).toBe(403)
  })

  it('session userId o\'z :userId\'si bilan → o\'tadi', async () => {
    mockedResolve.mockResolvedValue({ userId: 'p_998901234567', provider: 'phone' })
    const next = vi.fn() as NextFunction
    await telegramAuth(mockReq('/progress/p_998901234567/result', 'POST', {}, { bearer: 'tok' }), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('initData Bearer\'dan USTUVOR (ikkalasi kelsa initData userId)', async () => {
    mockedVerify.mockReturnValue({ id: 111 } as never)
    mockedResolve.mockResolvedValue({ userId: 'p_998901234567', provider: 'phone' })
    const req = mockReq('/progress/111/result', 'POST', {}, { initData: 'sig', bearer: 'tok' })
    const next = vi.fn() as NextFunction
    await telegramAuth(req, mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
    expect((req as { userId?: string }).userId).toBe('111')
    expect(mockedResolve).not.toHaveBeenCalled()
  })
})

describe('telegramAuth — dev rejim (auth o\'chiq)', () => {
  it('header\'siz o\'tadi', async () => {
    process.env['NODE_ENV'] = 'development'
    const next = vi.fn()
    await telegramAuth(mockReq('/progress/111/result', 'POST'), mockRes(), next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })

  it('dev + valid bearer → req.userId resolve qilinadi', async () => {
    process.env['NODE_ENV'] = 'development'
    mockedResolve.mockResolvedValue({ userId: 'p_998901234567', provider: 'phone' })
    const req = mockReq('/auth/me', 'GET', {}, { bearer: 'tok' })
    await telegramAuth(req, mockRes(), vi.fn() as NextFunction)
    expect((req as { userId?: string }).userId).toBe('p_998901234567')
  })

  it('NODE_ENV yo\'q bo\'lsa fail-closed ishlaydi', async () => {
    delete process.env['NODE_ENV']
    const res = mockRes(); const next = vi.fn()
    await telegramAuth(mockReq('/progress/111/result', 'POST'), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireAuth / requireSelf', () => {
  it('requireAuth: req.userId yo\'q → 401', () => {
    const res = mockRes(); const next = vi.fn()
    requireAuth(mockReq('/auth/me'), res, next as NextFunction)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('requireAuth: req.userId bor → o\'tadi', () => {
    const req = mockReq('/auth/me')
    ;(req as { userId?: string }).userId = 'p_998901234567'
    const next = vi.fn()
    requireAuth(req, mockRes(), next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })

  it('requireSelf: session userId bilan bir xil bo\'lsa o\'tadi (prod)', () => {
    const req = mockReq('/daily/p_998901234567')
    ;(req as { userId?: string }).userId = 'p_998901234567'
    ;(req as { params?: Record<string, string> }).params = { userId: 'p_998901234567' }
    const next = vi.fn()
    requireSelf(req, mockRes(), next as NextFunction)
    expect(next).toHaveBeenCalledOnce()
  })
})
