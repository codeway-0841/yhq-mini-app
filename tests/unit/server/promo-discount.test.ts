/**
 * Chegirma promokodi (discount_percent):
 *  - POST /payments/create-order {promoCode} — server QAYTA tekshiradi va
 *    order summasini chegirmali yozadi (client narxiga Ishonib bo'lmasligi —
 *    scoring trust boundary bilan bir xil model)
 *  - POST /api/promo/check — to'lov sheet'i uchun tekshiruv (redeem EMAS)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const h = vi.hoisted(() => ({ insertValues: vi.fn() }))

vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as { userId?: string }).userId = 'u1'
    next()
  },
}))
vi.mock('../../../server/middleware/db-rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/db-rate-limiter')>()),
  dbRateLimit: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))
vi.mock('../../../server/db/connection', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        h.insertValues(v)
        return {
          returning: vi.fn().mockResolvedValue([{
            id: 1, providerTransId: null, createdAt: new Date(), updatedAt: new Date(), ...v,
          }]),
        }
      }),
    })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}))

import { paymentRouter } from '../../../server/modules/payments/payment.router'
import promoRouter from '../../../server/modules/promo/promo.router'
import { promoRepository } from '../../../server/modules/promo/promo.repository'
import { errorHandler } from '../../../server/middleware/error-handler'
import { config } from '../../../server/config'

function makeApp() {
  const app = express()
  app.use(express.json())
  // Global telegramAuth simulyatsiyasi — promo/check req.userId'ni shundan o'qiydi
  app.use((req, _res, next) => { (req as { userId?: string }).userId = 'u1'; next() })
  app.use('/api/payments', paymentRouter)
  app.use('/api', promoRouter)
  app.use(errorHandler)
  return app
}

const DISCOUNT_PROMO = {
  id: 5, code: 'SALE25', type: 'discount_percent', value: 25,
  maxUses: null, usedCount: 0, expiresAt: null, isActive: true, createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(config.payme as { merchantId: string }).merchantId = 'merchant_x'
  // L-4 (audit): buildClickPaymentUrl endi fail-closed — test'da Click config shart
  ;(config.click as { serviceId: string }).serviceId = 'svc_test'
  ;(config.click as { merchantId: string }).merchantId = 'merch_test'
})

describe('POST /payments/create-order — promokod chegirmasi', () => {
  it('promokodsiz: asl narx, discountPercent 0', async () => {
    const res = await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', provider: 'click' })
      .expect(201)

    expect(res.body.amountUzs).toBe(29_000)
    expect(res.body.discountPercent).toBe(0)
    expect(res.body.paymentUrl).toContain('my.click.uz')
    expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({ amountUzs: 29_000, rawDetails: {} }))
  })

  it('discount_percent promokod: summa chegirmali + order meta saqlanadi (payme URL)', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(DISCOUNT_PROMO)
    vi.spyOn(promoRepository, 'isRedeemedByUser').mockResolvedValue(false)

    const res = await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', provider: 'payme', promoCode: 'SALE25' })
      .expect(201)

    expect(res.body.amountUzs).toBe(21_750)                       // 29000 × 0.75
    expect(res.body.discountPercent).toBe(25)
    expect(res.body.paymentUrl).toContain('checkout.paycom.uz')
    expect(h.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'payme',
      amountUzs: 21_750,
      rawDetails: { promoCode: 'SALE25', discountPercent: 25 },
    }))
  })

  it("premium_days promokodi to'lovda ishlamaydi → 400 PROMO_NOT_DISCOUNT", async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({ ...DISCOUNT_PROMO, type: 'premium_days' })

    const res = await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', promoCode: 'SALE25' })
      .expect(400)

    expect(res.body.error).toBe('Bu promokod chegirma kodi emas')
    expect(h.insertValues).not.toHaveBeenCalled()
  })

  it('avval ishlatilgan promokod → 400 PROMO_ALREADY_USED, order yaratilmaydi', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(DISCOUNT_PROMO)
    vi.spyOn(promoRepository, 'isRedeemedByUser').mockResolvedValue(true)

    await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', promoCode: 'SALE25' })
      .expect(400)
    expect(h.insertValues).not.toHaveBeenCalled()
  })

  it("mavjud bo'lmagan kod → 404", async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(null)

    await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', promoCode: 'NOPE' })
      .expect(404)
  })

  it("limit tugagan kod → 400 PROMO_LIMIT_REACHED", async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({ ...DISCOUNT_PROMO, maxUses: 3, usedCount: 3 })

    await request(makeApp())
      .post('/api/payments/create-order')
      .send({ plan: 'month', promoCode: 'SALE25' })
      .expect(400)
    expect(h.insertValues).not.toHaveBeenCalled()
  })
})

describe('POST /api/promo/check — to’lov sheet’i tekshiruvi (redeem EMAS)', () => {
  it('valid discount_percent → discountPercent qaytaradi', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(DISCOUNT_PROMO)
    vi.spyOn(promoRepository, 'isRedeemedByUser').mockResolvedValue(false)

    const res = await request(makeApp())
      .post('/api/promo/check')
      .send({ code: 'SALE25' })
      .expect(200)

    expect(res.body).toMatchObject({ ok: true, type: 'discount_percent', code: 'SALE25', discountPercent: 25 })
  })

  it('premium_days kodi → 400 PROMO_NOT_DISCOUNT (u Profil\'da faollashadi)', async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({ ...DISCOUNT_PROMO, type: 'premium_days' })

    const res = await request(makeApp())
      .post('/api/promo/check')
      .send({ code: 'SALE25' })
      .expect(400)
    expect(res.body.error).toBe('Bu promokod chegirma kodi emas')
  })

  it("kod yo'q → 404", async () => {
    vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(null)
    await request(makeApp()).post('/api/promo/check').send({ code: 'NOPE' }).expect(404)
  })
})
