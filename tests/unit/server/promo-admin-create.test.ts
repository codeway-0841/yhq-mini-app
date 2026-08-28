/**
 * Admin chegirma promokodi yaratish (POST /api/admin/promo-codes):
 *  - discount_percent turi server schema'sida qabul qilinadi (value 1..99)
 *  - value > 99 rad etiladi (zod refine)
 *  - admin bo'lmagan user → 403
 *  - dublikat kod → 409 PROMO_EXISTS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const h = vi.hoisted(() => ({ adminUser: { isAdmin: true } as { isAdmin: boolean } | null }))

vi.mock('../../../server/db/connection', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => (h.adminUser ? [h.adminUser] : [])),
      })),
    })),
  },
}))

import promoRouter from '../../../server/modules/promo/promo.router'
import { promoRepository } from '../../../server/modules/promo/promo.repository'
import { errorHandler } from '../../../server/middleware/error-handler'

function makeApp() {
  const app = express()
  app.use(express.json())
  // Global telegramAuth simulyatsiyasi — requireAdmin req.userId'ni shundan o'qiydi
  app.use((req, _res, next) => { (req as { userId?: string }).userId = 'admin1'; next() })
  app.use('/api', promoRouter)
  app.use(errorHandler)
  return app
}

const CREATED = {
  id: 7, code: 'SALE25', type: 'discount_percent', value: 25,
  maxUses: null, usedCount: 0, expiresAt: null, isActive: true, createdAt: new Date(),
}

beforeEach(() => {
  vi.restoreAllMocks()
  h.adminUser = { isAdmin: true }
})

describe('POST /api/admin/promo-codes — chegirma kodi yaratish', () => {
  it('discount_percent: 201, repositoryga type/value to‘g‘ri uzatiladi', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(null)
    const createSpy = vi.spyOn(promoRepository, 'createCode').mockResolvedValue(CREATED)

    const res = await request(makeApp())
      .post('/api/admin/promo-codes')
      .send({ code: 'SALE25', type: 'discount_percent', value: 25, maxUses: null, expiresAt: null })
      .expect(201)

    expect(res.body).toMatchObject({ code: 'SALE25', type: 'discount_percent', value: 25 })
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'discount_percent', value: 25 }))
  })

  it('discount_percent value > 99 → 400 (zod refine)', async () => {
    const createSpy = vi.spyOn(promoRepository, 'createCode')
    const res = await request(makeApp())
      .post('/api/admin/promo-codes')
      .send({ code: 'SALE100', type: 'discount_percent', value: 100 })
      .expect(400)

    expect(res.body.error).toBeTruthy()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('type berilmasa default premium_days (eski oqim buzilmaydi)', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(null)
    const createSpy = vi.spyOn(promoRepository, 'createCode')
      .mockResolvedValue({ ...CREATED, type: 'premium_days', value: 30 })

    await request(makeApp())
      .post('/api/admin/promo-codes')
      .send({ code: 'AVTO2026', value: 30 })
      .expect(201)

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'premium_days', value: 30 }))
  })

  it('dublikat kod → 409 PROMO_EXISTS', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(CREATED)

    const res = await request(makeApp())
      .post('/api/admin/promo-codes')
      .send({ code: 'SALE25', type: 'discount_percent', value: 25 })
      .expect(409)

    expect(res.body.error).toContain('allaqachon mavjud')
  })

  it('admin bo‘lmagan user → 403', async () => {
    h.adminUser = { isAdmin: false }
    await request(makeApp())
      .post('/api/admin/promo-codes')
      .send({ code: 'SALE25', type: 'discount_percent', value: 25 })
      .expect(403)
  })
})
