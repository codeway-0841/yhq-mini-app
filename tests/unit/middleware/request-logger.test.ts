import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import {
  normalizePath, requestLogger, resolveRequestId,
} from '../../../server/middleware/request-logger'

function response() {
  let finishCb: (() => void) | null = null
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value },
    on(event: string, cb: () => void) { if (event === 'finish') finishCb = cb; return this },
    finish() { finishCb?.() },
    headers,
  }
  return res as unknown as Response & { finish(): void; headers: Record<string, string> }
}

function request(path: string, reqId?: string): Request {
  return {
    method: 'GET',
    path,
    headers: reqId ? { 'x-request-id': reqId } : {},
  } as unknown as Request
}

afterEach(() => { vi.restoreAllMocks() })

describe('normalizePath', () => {
  it('Telegram user id segmentini :id ga almashtiradi (PII himoyasi)', () => {
    expect(normalizePath('/api/progress/123456789/result')).toBe('/api/progress/:id/result')
  })

  it('qisqa raqamlarni (savol/topic id) tegmaydi', () => {
    expect(normalizePath('/api/admin/questions/42')).toBe('/api/admin/questions/42')
  })
})

describe('resolveRequestId', () => {
  it('xavfsiz formatdagi kiruvchi id’ni echo qiladi', () => {
    expect(resolveRequestId('trace-abc_12345')).toBe('trace-abc_12345')
  })

  it('xavfsiz bo‘lmagan yoki yo‘q id uchun yangi UUID generatsiya qiladi', () => {
    expect(resolveRequestId('a"; DROP TABLE')).not.toBe('a"; DROP TABLE')
    expect(resolveRequestId('short')).toMatch(/^[0-9a-f-]{36}$/)
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('requestLogger', () => {
  it('X-Request-Id header’ini qo‘yadi va JSON qator loglaydi', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = response()
    const next = vi.fn() as NextFunction
    requestLogger(request('/api/progress/123456789/result', 'client-trace-1'), res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.headers['x-request-id']).toBe('client-trace-1')

    res.finish()
    expect(log).toHaveBeenCalledOnce()
    const entry = JSON.parse(log.mock.calls[0]![0] as string)
    expect(entry).toMatchObject({
      level: 'info',
      requestId: 'client-trace-1',
      method: 'GET',
      path: '/api/progress/:id/result',
      status: 200,
    })
    expect(typeof entry.ms).toBe('number')
  })

  it('5xx javoblarni error sifatida belgilaydi', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = response()
    res.statusCode = 500
    requestLogger(request('/api/questions'), res, vi.fn() as NextFunction)
    res.finish()
    expect(JSON.parse(log.mock.calls[0]![0] as string).level).toBe('error')
  })

  it('health/readiness endpointlarini loglamaydi (monitor shovqini)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    for (const path of ['/api/health', '/api/ready']) {
      const res = response()
      requestLogger(request(path), res, vi.fn() as NextFunction)
      res.finish()
    }
    expect(log).not.toHaveBeenCalled()
  })
})
