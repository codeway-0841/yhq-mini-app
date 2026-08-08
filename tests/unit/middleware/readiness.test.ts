import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { createReadinessHandler } from '../../../server/middleware/readiness'

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(payload: unknown) { this.body = payload; return this },
  }
  return res as unknown as Response & { statusCode: number; body: unknown }
}

const req = {} as Request

describe('createReadinessHandler', () => {
  it('DB ping muvaffaqiyatli bo‘lsa 200 + ready qaytaradi', async () => {
    const res = response()
    await createReadinessHandler(() => Promise.resolve())(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'ready' })
  })

  it('DB ping xato bo‘lsa 503 + db_error qaytaradi', async () => {
    const res = response()
    await createReadinessHandler(() => Promise.reject(new Error('down')))(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ status: 'not_ready', reason: 'db_error' })
  })

  it('DB ping timeout bo‘lsa 503 + db_timeout qaytaradi', async () => {
    vi.useFakeTimers()
    try {
      const res = response()
      const pending = createReadinessHandler(
        () => new Promise(() => { /* hech qachon resolve bo'lmaydi */ }),
        100,
      )(req, res)
      await vi.advanceTimersByTimeAsync(150)
      await pending
      expect(res.statusCode).toBe(503)
      expect(res.body).toEqual({ status: 'not_ready', reason: 'db_timeout' })
    } finally {
      vi.useRealTimers()
    }
  })
})
