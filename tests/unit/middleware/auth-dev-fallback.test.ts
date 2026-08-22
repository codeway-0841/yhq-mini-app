/**
 * telegramAuth — dev-mock initData fallback (audit fix).
 *
 * index.html'dagi dev-mock Telegram user doim soxta `hash=dev` yuboradi —
 * haqiqiy BOT_TOKEN bilan HECH QACHON HMAC tekshiruvidan o'tolmaydi.
 * Shuning uchun `!isAuthEnforced()` (dev/test) holatida imzosiz user id
 * fallback orqali qabul qilinadi (server/utils/telegram.ts:
 * parseInitDataUserUnsafe).
 *
 * SECURITY-CRITICAL: bu fallback production'da (`isAuthEnforced()===true`)
 * HECH QACHON ishlamasligi shart — aks holda istalgan client o'zini istalgan
 * userId sifatida ko'rsata oladi (auth bypass). Shu invariantni ushbu test
 * qulflab qo'yadi.
 *
 * DIQQAT: `config` (demak `config.telegram.botToken`) MODUL YUKLANGANDA bir
 * marta parse qilinadi (server/config/index.ts: `const env = envSchema.parse
 * (process.env)`) — oddiy `process.env['BOT_TOKEN'] = ...` mutatsiyasi bunga
 * ta'sir qilmaydi (faqat `config.isProd` kabi live getter'lar dinamik).
 * Shuning uchun har bir test `vi.resetModules()` + dinamik import bilan
 * `server/middleware/auth`ni QAYTA yuklaydi (prod-config.test.ts'dagi bilan
 * bir xil pattern) — aks holda CI'da (BOT_TOKEN ambient env'da yo'q) 503
 * qaytadi, 401 emas (bu xato birinchi versiyada aynan shunday sodir bo'lgan).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

const originalNodeEnv = process.env['NODE_ENV']
const originalBotToken = process.env['BOT_TOKEN']

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalNodeEnv
  if (originalBotToken === undefined) delete process.env['BOT_TOKEN']
  else process.env['BOT_TOKEN'] = originalBotToken
  vi.resetModules()
})

async function loadTelegramAuth() {
  const mod = await import('../../../server/middleware/auth')
  return mod.telegramAuth
}

/** index.html dev-mock bilan bir xil shakl — imzosi (`hash=dev`) HAR DOIM soxta. */
const FAKE_INIT_DATA =
  'query_id=DEV&user=%7B%22id%22%3A999999999%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1723000000&hash=dev'

function mockReq(): Request {
  return {
    method: 'GET',
    path: '/profile/999999999',
    headers: { 'x-telegram-init-data': FAKE_INIT_DATA },
    body: {},
  } as unknown as Request
}

function mockRes(): Response {
  const res: Partial<Response> = {}
  res.status = ((_code: number) => res as Response) as Response['status']
  res.json = ((_body: unknown) => res as Response) as Response['json']
  return res as Response
}

describe('telegramAuth — dev-mock fallback xavfsizlik chegarasi', () => {
  it('production: soxta hash bilan initData → 401 (fallback ISHLAMAYDI)', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['BOT_TOKEN'] = 'real-bot-token-not-matching-fake-hash'
    const telegramAuth = await loadTelegramAuth()

    const req = mockReq()
    const res = mockRes()
    let statusCode: number | undefined
    res.status = ((code: number) => { statusCode = code; return res }) as Response['status']
    let nextCalled = false
    const next: NextFunction = () => { nextCalled = true }

    await telegramAuth(req, res, next)

    expect(statusCode).toBe(401)
    expect(nextCalled).toBe(false)
    expect((req as { userId?: string }).userId).toBeUndefined()
  })

  it("dev/test: soxta hash bilan initData → fallback ORQALI userId o'rnatiladi", async () => {
    process.env['NODE_ENV'] = 'test'
    process.env['BOT_TOKEN'] = 'irrelevant-in-dev'
    const telegramAuth = await loadTelegramAuth()

    const req = mockReq()
    const res = mockRes()
    let nextCalled = false
    const next: NextFunction = () => { nextCalled = true }

    await telegramAuth(req, res, next)

    expect(nextCalled).toBe(true)
    expect((req as { userId?: string }).userId).toBe('999999999')
  })
})
