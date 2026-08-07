import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../../../server/config'
import { requireCronSecret } from '../../../server/middleware/cron-auth'

function request(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as Request
}

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(payload: unknown) { this.body = payload; return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

const originalSecret = config.cron.secret

afterEach(() => {
  // @ts-expect-error testda immutable config snapshot tiklanadi
  config.cron.secret = originalSecret
})

describe('requireCronSecret', () => {
  it('secret sozlanmagan bo‘lsa fail-closed 503 qaytaradi', () => {
    // @ts-expect-error test holati
    config.cron.secret = undefined
    const res = response(); const next = vi.fn() as NextFunction
    requireCronSecret(request(), res, next)
    expect(res.statusCode).toBe(503)
    expect(next).not.toHaveBeenCalled()
  })

  it('noto‘g‘ri secretni 401 bilan rad etadi', () => {
    // @ts-expect-error test holati
    config.cron.secret = 'correct-secret'
    const res = response(); const next = vi.fn() as NextFunction
    requireCronSecret(request('Bearer wrong-secret'), res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('to‘g‘ri secret bilan requestni o‘tkazadi', () => {
    // @ts-expect-error test holati
    config.cron.secret = 'correct-secret'
    const res = response(); const next = vi.fn() as NextFunction
    requireCronSecret(request('Bearer correct-secret'), res, next)
    expect(next).toHaveBeenCalledOnce()
  })
})
