import { describe, it, expect, vi } from 'vitest'
import { requireAdmin } from '../../../server/middleware/admin'
import type { Request, Response, NextFunction } from 'express'

describe('server/modules/admin & requireAdmin middleware - REAL Module Tests', () => {
  it('rejects request without any userId with 401 telegram_user_not_identified', async () => {
    const req = {
      body: {},
      query: {},
    } as unknown as Request

    let statusCode: number | null = null
    let responseBody: any = null

    const res = {
      status(code: number) {
        statusCode = code
        return this
      },
      json(data: any) {
        responseBody = data
        return this
      },
    } as unknown as Response

    const next = vi.fn() as NextFunction

    await requireAdmin(req, res, next)

    expect(statusCode).toBe(401)
    expect(responseBody).toEqual({ error: 'telegram_user_not_identified' })
    expect(next).not.toHaveBeenCalled()
  })
})
