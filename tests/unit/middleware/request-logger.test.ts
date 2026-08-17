import { describe, it, expect, vi } from 'vitest'
import { normalizePath, resolveRequestId, requestLogger } from '../../../server/middleware/request-logger'

describe('requestLogger middleware', () => {
  describe('normalizePath', () => {
    it('normalizes 5+ digit user IDs in paths to :id (PII protection)', () => {
      expect(normalizePath('/api/users/123456789/profile')).toBe('/api/users/:id/profile')
      expect(normalizePath('/api/progress/987654321/result')).toBe('/api/progress/:id/result')
    })

    it('normalizes telegram login codes', () => {
      expect(normalizePath('/auth/telegram-login/code_abc123_xyz')).toBe('/auth/telegram-login/:code')
    })

    it('leaves standard paths unchanged', () => {
      expect(normalizePath('/api/questions')).toBe('/api/questions')
      expect(normalizePath('/api/payments/create-order')).toBe('/api/payments/create-order')
    })
  })

  describe('resolveRequestId', () => {
    it('returns provided valid request ID', () => {
      const validId = 'req-1234-abcd-5678'
      expect(resolveRequestId(validId)).toBe(validId)
    })

    it('generates a new UUID if header is missing or unsafe', () => {
      const id1 = resolveRequestId(undefined)
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(10)

      const unsafe = resolveRequestId('invalid <script>')
      expect(unsafe).not.toBe('invalid <script>')
    })
  })

  describe('requestLogger middleware execution', () => {
    it('attaches X-Request-Id header and calls next()', () => {
      const req = { headers: {}, method: 'GET', path: '/api/test' } as any
      const setHeaderMock = vi.fn()
      const onMock = vi.fn()
      const res = {
        setHeader: setHeaderMock,
        on: onMock,
      } as any
      const next = vi.fn()

      requestLogger(req, res, next)

      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', expect.any(String))
      expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function))
      expect(next).toHaveBeenCalledTimes(1)
    })
  })
})
