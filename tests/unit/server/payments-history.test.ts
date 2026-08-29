/**
 * GET /api/payments/history — Profil'dagi "To'lovlar tarixi" sheet'i uchun
 * joriy user'ning Click/Payme buyurtmalari (eng yangisi birinchi, 50 tagacha).
 *
 * Kontrakt: faqat o'z buyurtmalari (requireAuth userId), ISO createdAt,
 * Cache-Control: private, no-store (moliyaviy data keshlanmaydi).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const h = vi.hoisted(() => ({ limitFn: vi.fn() }))

vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as { userId?: string }).userId = 'u1'
    next()
  },
}))
vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  dbRateLimit: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))
vi.mock('../../../server/db/connection', () => ({
  db: {
    insert: vi.fn(),
    // select(...).from(...).where(...).orderBy(...).limit(50) zanjiri
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: h.limitFn })),
        })),
      })),
    })),
  },
}))

import { paymentRouter } from '../../../server/modules/payments/payment.router'
import { errorHandler } from '../../../server/middleware/error-handler'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/payments', paymentRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/payments/history', () => {
  it('buyurtmalarni kontrakt formatida qaytaradi (ISO createdAt, no-store)', async () => {
    h.limitFn.mockResolvedValue([
      {
        orderId: 'ord_2', plan: 'year', amountUzs: 79_000,
        provider: 'payme', status: 'completed',
        createdAt: new Date('2026-08-20T10:00:00Z'),
      },
      {
        orderId: 'ord_1', plan: 'month', amountUzs: 29_000,
        provider: 'click', status: 'pending',
        createdAt: new Date('2026-08-10T10:00:00Z'),
      },
    ])

    const res = await request(makeApp()).get('/api/payments/history').expect(200)

    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.body).toEqual({
      ok: true,
      rows: [
        {
          orderId: 'ord_2', plan: 'year', amountUzs: 79_000,
          provider: 'payme', status: 'completed',
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          orderId: 'ord_1', plan: 'month', amountUzs: 29_000,
          provider: 'click', status: 'pending',
          createdAt: '2026-08-10T10:00:00.000Z',
        },
      ],
    })
    // 50 tagacha cheklov
    expect(h.limitFn).toHaveBeenCalledWith(50)
  })

  it("to'lov qilmagan user — bo'sh ro'yxat (empty state kontrakti)", async () => {
    h.limitFn.mockResolvedValue([])

    const res = await request(makeApp()).get('/api/payments/history').expect(200)

    expect(res.body).toEqual({ ok: true, rows: [] })
  })
})
