/**
 * Payme (Paycom) Merchant API — JSON-RPC metodlar:
 *  - AUTH FAIL-CLOSED (secret'siz hamma narsa rad etiladi)
 *  - Summa FAQAT DB order bilan (TIYIN = UZS × 100)
 *  - PerformTransaction atomik claim — replay idempotent, parallel ALREADY
 *  - Promo redemption completion'da (redeemOrderPromo)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  selectWhere: vi.fn(),      // db.select().from().where(...) → rows
  updateSet: vi.fn(),        // db.update().set(values) — capture
  updateReturning: vi.fn(),  // ... .where(...).returning() → rows
}))
vi.mock('../../../server/db/connection', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: h.selectWhere })) })),
    update: vi.fn(() => ({
      set: vi.fn((v: unknown) => {
        h.updateSet(v)
        return { where: vi.fn(() => ({ returning: h.updateReturning })) }
      }),
    })),
  },
}))
vi.mock('../../../server/modules/payments/order-promo', () => ({
  redeemOrderPromo: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../../server/utils/sentry', () => ({
  Sentry: { captureException: vi.fn(), captureMessage: vi.fn() },
}))

import { paymentRepository } from '../../../server/modules/payments/payment.repository'
import { redeemOrderPromo } from '../../../server/modules/payments/order-promo'
import { Sentry } from '../../../server/utils/sentry'
import { config } from '../../../server/config'
import {
  verifyPaymeAuth,
  buildPaymePaymentUrl,
  handlePaymeRpc,
} from '../../../server/modules/payments/payme.service'

const ORDER = {
  id: 7,
  orderId: 'ord_1_abc',
  userId: 'u1',
  plan: 'month',
  amountUzs: 29_000,
  provider: 'payme',
  status: 'pending',
  providerTransId: null as string | null,
  rawDetails: {} as Record<string, unknown>,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const AMOUNT_TIYIN = ORDER.amountUzs * 100

const rpc = (method: string, params: Record<string, unknown>) =>
  handlePaymeRpc({ id: 1, method, params })
const authHeader = (secret: string) =>
  'Basic ' + Buffer.from(`Paycom:${secret}`, 'utf8').toString('base64')

beforeEach(() => {
  vi.clearAllMocks()
  ;(config.payme as { secretKey: string }).secretKey = 'test_secret'
  ;(config.payme as { merchantId: string }).merchantId = 'merchant_1'
  h.selectWhere.mockResolvedValue([{ ...ORDER }])
  h.updateReturning.mockResolvedValue([{ ...ORDER, status: 'completed', providerTransId: 'ptx_1' }])
})

describe('verifyPaymeAuth — FAIL-CLOSED', () => {
  it("to'g'ri Basic auth → true", () => {
    expect(verifyPaymeAuth(authHeader('test_secret'))).toBe(true)
  })
  it("secret YO'Q → har qanday header rad etiladi (soxta webhook himoyasi)", () => {
    ;(config.payme as { secretKey: string }).secretKey = ''
    expect(verifyPaymeAuth(authHeader('anything'))).toBe(false)
    expect(verifyPaymeAuth(undefined)).toBe(false)
  })
  it("noto'g'ri parol / format → false", () => {
    expect(verifyPaymeAuth(authHeader('wrong'))).toBe(false)
    expect(verifyPaymeAuth('Bearer abc')).toBe(false)
  })
})

describe('buildPaymePaymentUrl — checkout havolasi (tiyin)', () => {
  it('base64 payload: merchant, order_id, summa × 100', () => {
    const url = buildPaymePaymentUrl({ orderId: 'ord_1_abc', amountUzs: 29_000, returnUrl: 'https://x.uz/back' })
    expect(url.startsWith('https://checkout.paycom.uz/')).toBe(true)
    const decoded = Buffer.from(url.slice('https://checkout.paycom.uz/'.length), 'base64').toString('utf8')
    expect(decoded).toBe('m=merchant_1;ac.order_id=ord_1_abc;a=2900000;c=https://x.uz/back')
  })
})

describe('CheckPerformTransaction', () => {
  it('happy path → allow: true', async () => {
    const res = await rpc('CheckPerformTransaction', { account: { order_id: ORDER.orderId }, amount: AMOUNT_TIYIN })
    expect(res).toEqual({ id: 1, result: { allow: true } })
  })
  it("order yo'q → -31050", async () => {
    h.selectWhere.mockResolvedValue([])
    const res = await rpc('CheckPerformTransaction', { account: { order_id: ORDER.orderId }, amount: AMOUNT_TIYIN })
    expect(res.error?.code).toBe(-31050)
  })
  it("summa mos emas → -31001", async () => {
    const res = await rpc('CheckPerformTransaction', { account: { order_id: ORDER.orderId }, amount: 100 })
    expect(res.error?.code).toBe(-31001)
  })
  it('cancelled/completed order → -31008', async () => {
    h.selectWhere.mockResolvedValue([{ ...ORDER, status: 'cancelled' }])
    expect((await rpc('CheckPerformTransaction', { account: { order_id: ORDER.orderId }, amount: AMOUNT_TIYIN })).error?.code).toBe(-31008)
    h.selectWhere.mockResolvedValue([{ ...ORDER, status: 'completed' }])
    expect((await rpc('CheckPerformTransaction', { account: { order_id: ORDER.orderId }, amount: AMOUNT_TIYIN })).error?.code).toBe(-31008)
  })
})

describe('CreateTransaction', () => {
  const params = { id: 'ptx_1', time: 1725000000000, amount: AMOUNT_TIYIN, account: { order_id: ORDER.orderId } }

  it('yangi tranzaksiya — providerTransId yoziladi, state 1', async () => {
    h.updateReturning.mockResolvedValue([{ ...ORDER, providerTransId: 'ptx_1', rawDetails: { paymeState: 1, createTime: params.time } }])
    const res = await rpc('CreateTransaction', params)
    expect(res.result).toMatchObject({ transaction: ORDER.orderId, state: 1, create_time: params.time })
    expect(h.updateSet).toHaveBeenCalledWith(expect.objectContaining({ providerTransId: 'ptx_1' }))
  })

  it('xuddi shu tx id qayta → idempotent, UPDATE CHAQIRILMAYDI', async () => {
    h.selectWhere.mockResolvedValue([{ ...ORDER, providerTransId: 'ptx_1', rawDetails: { paymeState: 1, createTime: params.time } }])
    const res = await rpc('CreateTransaction', params)
    expect(res.result).toMatchObject({ state: 1 })
    expect(h.updateSet).not.toHaveBeenCalled()
  })

  it('boshqa tx band qilgan → -31008', async () => {
    h.selectWhere.mockResolvedValue([{ ...ORDER, providerTransId: 'other_tx' }])
    expect((await rpc('CreateTransaction', params)).error?.code).toBe(-31008)
  })

  it("summa xato → -31001", async () => {
    expect((await rpc('CreateTransaction', { ...params, amount: 5 })).error?.code).toBe(-31001)
  })
})

describe('PerformTransaction — atomik claim + grant', () => {
  const bound = { ...ORDER, providerTransId: 'ptx_1', rawDetails: { paymeState: 1, createTime: 1 } }

  it('pending → completed, premium grant + promo redemption', async () => {
    h.selectWhere.mockResolvedValue([{ ...bound }])
    const completeSpy = vi.spyOn(paymentRepository, 'completeProviderOrder').mockResolvedValue({
      status: 'activated',
      order: { id: bound.id, orderId: bound.orderId, status: 'completed', providerTransId: 'ptx_1', rawDetails: { paymeState: 2, performTime: 999 } },
    })

    const res = await rpc('PerformTransaction', { id: 'ptx_1' })

    expect(res.result).toMatchObject({ transaction: ORDER.orderId, state: 2 })
    expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({
      telegramChargeId: 'payme_ptx_1',
      providerTransId: 'ptx_1',
      userId: 'u1',
      amount: 29_000,
      currency: 'UZS',
    }))
    expect(vi.mocked(redeemOrderPromo)).toHaveBeenCalled()
  })

  it('REPLAY: allaqachon completed → idempotent SUCCESS, qayta grant YO`Q', async () => {
    h.selectWhere.mockResolvedValue([{ ...bound, status: 'completed', rawDetails: { paymeState: 2, performTime: 999 } }])
    const completeSpy = vi.spyOn(paymentRepository, 'completeProviderOrder').mockResolvedValue({
      status: 'duplicate',
      order: { id: bound.id, orderId: bound.orderId, status: 'completed', providerTransId: 'ptx_1', rawDetails: { paymeState: 2, performTime: 999 } },
    })

    const res = await rpc('PerformTransaction', { id: 'ptx_1' })

    expect(res.result).toMatchObject({ state: 2 })
    expect(completeSpy).not.toHaveBeenCalled()
    expect(vi.mocked(redeemOrderPromo)).not.toHaveBeenCalled()
  })

  it('cancelled tx → -31008', async () => {
    h.selectWhere.mockResolvedValue([{ ...bound, status: 'cancelled' }])
    expect((await rpc('PerformTransaction', { id: 'ptx_1' })).error?.code).toBe(-31008)
  })

  it("tx topilmadi → -31003", async () => {
    h.selectWhere.mockResolvedValue([])
    expect((await rpc('PerformTransaction', { id: 'nope' })).error?.code).toBe(-31003)
  })
})

describe('CancelTransaction / CheckTransaction', () => {
  it('pending tx bekor → state -1', async () => {
    const bound = { ...ORDER, providerTransId: 'ptx_1', status: 'pending' }
    h.selectWhere.mockResolvedValue([{ ...bound, status: 'cancelled', rawDetails: { paymeState: -1, cancelTime: 5, cancelReason: 1 } }])
    const res = await rpc('CancelTransaction', { id: 'ptx_1', reason: 1 })
    expect(res.result).toMatchObject({ state: -1, cancel_time: 5 })
  })

  it('COMPLETED tx bekor → state -2 + Sentry signal (refund — premium revoke MANUAL)', async () => {
    const bound = { ...ORDER, providerTransId: 'ptx_1', status: 'completed' }
    h.selectWhere
      .mockResolvedValueOnce([{ ...bound }])                                     // dastlabki o'qish
      .mockResolvedValue([{ ...bound, status: 'cancelled', rawDetails: { paymeState: -2, cancelTime: 5, cancelReason: 4 } }])  // fresh
    const res = await rpc('CancelTransaction', { id: 'ptx_1', reason: 4 })
    expect(res.result).toMatchObject({ state: -2 })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalled()
  })

  it('RACE CONDITION (ID 06): pending tx cancel paytida boshqa worker completed qilsa → xavfsiz holatda qayta tekshirib -2 ga o\'tadi', async () => {
    const bound = { ...ORDER, providerTransId: 'ptx_1', status: 'pending', rawDetails: { paymeState: 1 } }
    // 1-o'qish: pending deb topadi
    // update: status='pending' sharti bilan yangilamoqchi bo'ladi, lekin parallel worker completed qilgani uchun returning [] bo'sh qaytadi
    // 2-o'qish (re-read): completed holatida topadi
    h.selectWhere
      .mockResolvedValueOnce([{ ...bound }])
      .mockResolvedValueOnce([{ ...bound, status: 'completed', rawDetails: { paymeState: 2 } }])
      .mockResolvedValue([{ ...bound, status: 'cancelled', rawDetails: { paymeState: -2, cancelTime: 10, cancelReason: 2 } }])
    h.updateReturning.mockResolvedValueOnce([]) // concurrency miss

    const res = await rpc('CancelTransaction', { id: 'ptx_1', reason: 2 })
    expect(res.result).toMatchObject({ state: -2 })
  })

  it('CheckTransaction — holatni qaytaradi', async () => {
    h.selectWhere.mockResolvedValue([{ ...ORDER, providerTransId: 'ptx_1', status: 'completed', rawDetails: { paymeState: 2, performTime: 42 } }])
    const res = await rpc('CheckTransaction', { id: 'ptx_1' })
    expect(res.result).toMatchObject({ state: 2, perform_time: 42 })
  })
})

describe('RPC dispatcher', () => {
  it("noma'lum metod → -32601", async () => {
    expect((await rpc('DeleteEverything', {})).error?.code).toBe(-32601)
  })
})
