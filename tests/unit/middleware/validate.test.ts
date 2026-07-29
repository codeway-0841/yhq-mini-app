/**
 * Unit tests for Zod validation middleware factory.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '../../../server/middleware/validate'

function fakeRes() {
  const json   = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return { status, json }
}

describe('validate({ body })', () => {
  const schema = z.object({ name: z.string().min(1) })
  const middleware = validate({ body: schema })

  it('passes valid body', () => {
    const req  = { body: { name: 'Alice' } } as unknown as Request
    const next: NextFunction = vi.fn()
    middleware(req, fakeRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects invalid body with 400', () => {
    const req  = { body: { name: '' } } as unknown as Request
    const res  = fakeRes()
    const next: NextFunction = vi.fn()
    middleware(req, res as unknown as Response, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    const payload = res.status.mock.results[0]!.value.json.mock.calls[0]?.[0] as { error: string; details: unknown[] }
    expect(payload.error).toBe('Validation failed')
    expect(Array.isArray(payload.details)).toBe(true)
  })
})

describe('validate({ params })', () => {
  const schema = z.object({ id: z.coerce.number().int().positive() })
  const middleware = validate({ params: schema })

  it('coerces string param to number', () => {
    const req  = { params: { id: '42' } } as unknown as Request
    const next: NextFunction = vi.fn()
    middleware(req, fakeRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    expect((req as Record<string, unknown>).params).toEqual({ id: 42 })
  })

  it('rejects non-numeric param', () => {
    const req  = { params: { id: 'abc' } } as unknown as Request
    const res  = fakeRes()
    const next: NextFunction = vi.fn()
    middleware(req, res as unknown as Response, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('validate({ query })', () => {
  const schema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  const middleware = validate({ query: schema })

  it('applies default when query param absent', () => {
    const req  = { query: {} } as unknown as Request
    const next: NextFunction = vi.fn()
    middleware(req, fakeRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    expect((req as Record<string, unknown>).query).toEqual({ limit: 20 })
  })
})
