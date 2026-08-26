/**
 * Audit B4 regression: body-parser (express.json) xatolari CLIENT 4xx bo'lishi
 * kerak — avval ular 500 + Sentry captureException bilan VIP spam yaratardi
 * (har buzilgan JSON/oversize body = alert shovqini).
 */

import { describe, it, expect, vi } from 'vitest'
import { errorHandler, AppError } from '../../../server/middleware/error-handler'
import type { Request, Response, NextFunction } from 'express'

// Sentry SDK export'lari ESM namespace — spyOn ISHLAMAYDI, to'liq mock kerak.
const h = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock('../../../server/utils/sentry', () => ({ Sentry: { captureException: h.capture } }))

function mockRes() {
  const state = { status: 0, body: undefined as unknown }
  const res = {
    status(code: number) { state.status = code; return this },
    json(body: unknown) { state.body = body; return this },
  } as unknown as Response
  return { res, state }
}

const req = {} as Request
const next = (() => {}) as NextFunction

describe('errorHandler — client xatosining klassifikatsiyasi (audit B4)', () => {
  it("entity.too.large → 413 (Sentry'siz)", () => {
    h.capture.mockClear()
    const { res, state } = mockRes()
    errorHandler({ type: 'entity.too.large', message: 'request entity too large' }, req, res, next)
    expect(state.status).toBe(413)
    expect(h.capture).not.toHaveBeenCalled()
  })

  it("entity.parse.failed → 400 (Sentry'siz)", () => {
    h.capture.mockClear()
    const { res, state } = mockRes()
    errorHandler({ type: 'entity.parse.failed', message: 'Unexpected token' }, req, res, next)
    expect(state.status).toBe(400)
    expect(h.capture).not.toHaveBeenCalled()
  })

  it('noma\'lum xato → 500 + Sentry capture (eski himoya saqlanadi)', () => {
    h.capture.mockClear()
    const { res, state } = mockRes()
    errorHandler(new Error('db connection lost'), req, res, next)
    expect(state.status).toBe(500)
    expect(state.body).toEqual({ error: 'Internal server error' })
    expect(h.capture).toHaveBeenCalled()
  })

  it('AppError o\'z status/message/details bilan qaytadi', () => {
    const { res, state } = mockRes()
    errorHandler(new AppError(422, 'weak_password', '8+ belgi kiritilsin'), req, res, next)
    expect(state.status).toBe(422)
    expect(state.body).toEqual({ error: 'weak_password', details: '8+ belgi kiritilsin' })
  })
})
