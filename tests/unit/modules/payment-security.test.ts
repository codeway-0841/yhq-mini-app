import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateClickSignature,
  handleClickPrepare,
  handleClickComplete,
  CLICK_ERRORS,
} from '../../../server/modules/payments/click.service'
import { config } from '../../../server/config'
import { paymentRepository } from '../../../server/modules/payments/payment.repository'

// Mock database connection
const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../../../server/db/connection', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => mockSelect(),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => mockUpdate(),
        }),
      }),
    }),
  },
}))

vi.mock('../../../server/modules/payments/payment.repository', () => ({
  paymentRepository: {
    complete: vi.fn().mockResolvedValue('activated'),
  },
}))

describe('Payment Protocol Security & State Machine', () => {
  const SECRET_KEY = 'test_secret_key_888'

  beforeEach(() => {
    vi.clearAllMocks()
    // Configure secret key in mockable config
    ;(config.click as { secretKey: string }).secretKey = SECRET_KEY
  })

  describe('Signature Cryptographic Rigidity', () => {
    it('is highly sensitive to payload alterations (avalanche effect in MD5)', () => {
      const baseParams = {
        click_trans_id: 100,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_sec_1',
        amount: 29000,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      }

      const validSign = generateClickSignature(baseParams)

      // Tamper amount by 1 UZS
      const tamperedAmountSign = generateClickSignature({ ...baseParams, amount: 29001 })
      expect(tamperedAmountSign).not.toBe(validSign)

      // Tamper merchant_trans_id
      const tamperedOrderIdSign = generateClickSignature({ ...baseParams, merchant_trans_id: 'ord_sec_2' })
      expect(tamperedOrderIdSign).not.toBe(validSign)

      // Tamper secret key
      const tamperedKeySign = generateClickSignature({ ...baseParams, secret_key: 'wrong_key' })
      expect(tamperedKeySign).not.toBe(validSign)
    })
  })

  describe('handleClickPrepare — Attack & Edge Case Defense', () => {
    it('rejects forged signature with SIGN_CHECK_FAILED (-1)', async () => {
      const result = await handleClickPrepare({
        click_trans_id: 12345,
        service_id: 32876,
        merchant_trans_id: 'ord_99',
        amount: 29000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: 'invalid_md5_signature_here',
      })

      expect(result.error).toBe(CLICK_ERRORS.SIGN_CHECK_FAILED)
      expect(result.error_note).toBe('SIGN CHECK FAILED')
      expect(mockSelect).not.toHaveBeenCalled() // Aborts before touching DB
    })

    it('returns ORDER_NOT_FOUND (-5) when merchant_trans_id does not exist', async () => {
      const sign = generateClickSignature({
        click_trans_id: 101,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_unknown',
        amount: 29000,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([]) // DB returns empty

      const result = await handleClickPrepare({
        click_trans_id: 101,
        service_id: 32876,
        merchant_trans_id: 'ord_unknown',
        amount: 29000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.ORDER_NOT_FOUND)
    })

    it('rejects amount tampering with INCORRECT_AMOUNT (-2)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 102,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_102',
        amount: 1000, // Attacker tries to pay 1,000 instead of 29,000
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 42, orderId: 'ord_102', amountUzs: 29000, status: 'pending' },
      ])

      const result = await handleClickPrepare({
        click_trans_id: 102,
        service_id: 32876,
        merchant_trans_id: 'ord_102',
        amount: 1000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.INCORRECT_AMOUNT)
      expect(result.merchant_prepare_id).toBeUndefined()
    })

    it('returns ALREADY_PAID (-4) when attempting to prepare an already completed order', async () => {
      const sign = generateClickSignature({
        click_trans_id: 103,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_103',
        amount: 29000,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 77, orderId: 'ord_103', amountUzs: 29000, status: 'completed' },
      ])

      const result = await handleClickPrepare({
        click_trans_id: 103,
        service_id: 32876,
        merchant_trans_id: 'ord_103',
        amount: 29000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.ALREADY_PAID)
    })

    it('returns SUCCESS (0) and merchant_prepare_id on legitimate prepare request', async () => {
      const sign = generateClickSignature({
        click_trans_id: 104,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_104',
        amount: 29000,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 88, orderId: 'ord_104', amountUzs: 29000, status: 'pending' },
      ])

      const result = await handleClickPrepare({
        click_trans_id: 104,
        service_id: 32876,
        merchant_trans_id: 'ord_104',
        amount: 29000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.SUCCESS)
      expect(result.merchant_prepare_id).toBe(88)
    })

    it('Prepare\'da amount NaN/yo\'q → INCORRECT_AMOUNT (audit P1-5 NaN guard)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 105,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_105',
        amount: undefined as unknown as number,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 89, orderId: 'ord_105', amountUzs: 29000, status: 'pending' },
      ])

      const result = await handleClickPrepare({
        click_trans_id: 105,
        service_id: 32876,
        merchant_trans_id: 'ord_105',
        amount: undefined as unknown as number,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.INCORRECT_AMOUNT)
    })

    it('Prepare\'da cancelled buyurtma → TRANSACTION_CANCELLED (qayta ochilmaydi)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 106,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_106',
        amount: 29000,
        action: 0,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 90, orderId: 'ord_106', amountUzs: 29000, status: 'cancelled' },
      ])

      const result = await handleClickPrepare({
        click_trans_id: 106,
        service_id: 32876,
        merchant_trans_id: 'ord_106',
        amount: 29000,
        action: 0,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.TRANSACTION_CANCELLED)
    })
  })

  describe('handleClickComplete — Completion & Idempotency', () => {
    it('handles Click-reported errors (< 0) by transitioning order to cancelled', async () => {
      const sign = generateClickSignature({
        click_trans_id: 201,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_201',
        merchant_prepare_id: 55,
        amount: 29000,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 55, orderId: 'ord_201', amountUzs: 29000, status: 'pending' },
      ])
      mockUpdate.mockResolvedValueOnce([])

      const result = await handleClickComplete({
        click_trans_id: 201,
        service_id: 32876,
        merchant_trans_id: 'ord_201',
        merchant_prepare_id: 55,
        amount: 29000,
        action: 1,
        error: -100, // Click error code
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.TRANSACTION_CANCELLED)
    })

    it('is idempotent on duplicate complete requests (returns success without double-granting)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 202,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_202',
        merchant_prepare_id: 66,
        amount: 29000,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      // 1-select: buyurtma lookup (completed); 2-select: claim yutqazgach —
      // xuddi shu click_trans_id replay ekanini tekshirish uchun qayta o'qish
      mockSelect.mockResolvedValueOnce([
        { id: 66, orderId: 'ord_202', amountUzs: 29000, status: 'completed', providerTransId: '202' },
      ])
      mockSelect.mockResolvedValueOnce([
        { id: 66, orderId: 'ord_202', amountUzs: 29000, status: 'completed', providerTransId: '202' },
      ])
      // Atomik claim (pending→completed) 0 qator qaytaradi — allaqachon o'tgan
      mockUpdate.mockResolvedValueOnce([])

      const result = await handleClickComplete({
        click_trans_id: 202,
        service_id: 32876,
        merchant_trans_id: 'ord_202',
        merchant_prepare_id: 66,
        amount: 29000,
        action: 1,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.SUCCESS)
      expect(result.merchant_confirm_id).toBe(66)
      // paymentRepository.complete chaqirilMASligi shart (replay — qayta grant yo'q)
      expect(paymentRepository.complete).not.toHaveBeenCalled()
    })

    it('BOSHQA click_trans_id bilan tugallangan buyurtmaga → ALREADY_PAID (grant yo\'q)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 999,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_203',
        merchant_prepare_id: 67,
        amount: 29000,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 67, orderId: 'ord_203', amountUzs: 29000, status: 'completed', providerTransId: '202' },
      ])
      mockSelect.mockResolvedValueOnce([
        { id: 67, orderId: 'ord_203', amountUzs: 29000, status: 'completed', providerTransId: '202' },
      ])
      mockUpdate.mockResolvedValueOnce([])

      const result = await handleClickComplete({
        click_trans_id: 999,
        service_id: 32876,
        merchant_trans_id: 'ord_203',
        merchant_prepare_id: 67,
        amount: 29000,
        action: 1,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.ALREADY_PAID)
      expect(paymentRepository.complete).not.toHaveBeenCalled()
    })

    it('muvaffaqiyatli Complete: atomik claim yutadi → entitlement bir marta beriladi', async () => {
      const sign = generateClickSignature({
        click_trans_id: 300,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_300',
        merchant_prepare_id: 80,
        amount: 29000,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 80, orderId: 'ord_300', userId: '12345', plan: 'month', amountUzs: 29000, status: 'pending' },
      ])
      mockUpdate.mockResolvedValueOnce([
        { id: 80, orderId: 'ord_300', userId: '12345', plan: 'month', amountUzs: 29000, status: 'completed' },
      ])

      const result = await handleClickComplete({
        click_trans_id: 300,
        service_id: 32876,
        merchant_trans_id: 'ord_300',
        merchant_prepare_id: 80,
        amount: 29000,
        action: 1,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.SUCCESS)
      expect(result.merchant_confirm_id).toBe(80)
      expect(paymentRepository.complete).toHaveBeenCalledTimes(1)
    })

    it('Complete\'da amount NaN/noto\'g\'ri → INCORRECT_AMOUNT (audit P1-5: NaN guard)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 301,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_301',
        merchant_prepare_id: 81,
        amount: undefined as unknown as number,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 81, orderId: 'ord_301', amountUzs: 29000, status: 'pending' },
      ])

      const result = await handleClickComplete({
        click_trans_id: 301,
        service_id: 32876,
        merchant_trans_id: 'ord_301',
        merchant_prepare_id: 81,
        amount: undefined as unknown as number,
        action: 1,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.INCORRECT_AMOUNT)
      expect(paymentRepository.complete).not.toHaveBeenCalled()
    })

    it('cancelled buyurtmaga Complete → TRANSACTION_CANCELLED (qayta aktivatsiya yo\'q)', async () => {
      const sign = generateClickSignature({
        click_trans_id: 302,
        service_id: 32876,
        secret_key: SECRET_KEY,
        merchant_trans_id: 'ord_302',
        merchant_prepare_id: 82,
        amount: 29000,
        action: 1,
        sign_time: '2026-08-16 12:00:00',
      })

      mockSelect.mockResolvedValueOnce([
        { id: 82, orderId: 'ord_302', amountUzs: 29000, status: 'cancelled' },
      ])

      const result = await handleClickComplete({
        click_trans_id: 302,
        service_id: 32876,
        merchant_trans_id: 'ord_302',
        merchant_prepare_id: 82,
        amount: 29000,
        action: 1,
        error: 0,
        sign_time: '2026-08-16 12:00:00',
        sign_string: sign,
      })

      expect(result.error).toBe(CLICK_ERRORS.TRANSACTION_CANCELLED)
      expect(paymentRepository.complete).not.toHaveBeenCalled()
    })
  })
})
