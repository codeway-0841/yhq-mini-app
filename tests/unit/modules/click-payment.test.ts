import { describe, it, expect } from 'vitest'
import {
  generateClickSignature,
  buildClickPaymentUrl,
  CLICK_ERRORS,
} from '../../../server/modules/payments/click.service'
import { formatUzs, PREMIUM_PLANS, getPlan } from '../../../shared/premium-plans'

describe('Click Payment Gateway — Unit Tests', () => {
  const sampleSecretKey = 'test_click_secret_key_12345'

  describe('generateClickSignature', () => {
    it('action 0 (Prepare) imzosini to\'g\'ri MD5 formatda generatsiya qiladi', () => {
      const sign = generateClickSignature({
        click_trans_id: '1001',
        service_id: '32876',
        secret_key: sampleSecretKey,
        merchant_trans_id: 'ord_12345',
        amount: '29000',
        action: 0,
        sign_time: '2026-08-15 12:00:00',
      })

      expect(typeof sign).toBe('string')
      expect(sign.length).toBe(32) // MD5 hash hex length
    })

    it('action 1 (Complete) imzosida merchant_prepare_id qatnashadi', () => {
      const sign0 = generateClickSignature({
        click_trans_id: '1001',
        service_id: '32876',
        secret_key: sampleSecretKey,
        merchant_trans_id: 'ord_12345',
        amount: '29000',
        action: 0,
        sign_time: '2026-08-15 12:00:00',
      })

      const sign1 = generateClickSignature({
        click_trans_id: '1001',
        service_id: '32876',
        secret_key: sampleSecretKey,
        merchant_trans_id: 'ord_12345',
        merchant_prepare_id: 42,
        amount: '29000',
        action: 1,
        sign_time: '2026-08-15 12:00:00',
      })

      expect(sign0).not.toBe(sign1)
      expect(sign1.length).toBe(32)
    })
  })

  describe('buildClickPaymentUrl', () => {
    it('to\'g\'ri parametrlar bilan Click checkout URL hosil qiladi', () => {
      const url = buildClickPaymentUrl({
        orderId: 'ord_test_999',
        amount: 79000,
        returnUrl: 'https://yhq-mini-app.vercel.app/premium',
      })

      expect(url).toContain('https://my.click.uz/services/pay')
      expect(url).toContain('amount=79000')
      expect(url).toContain('transaction_param=ord_test_999')
      expect(url).toContain('return_url=')
    })
  })

  describe('formatUzs', () => {
    it('o\'zbek va rus tillarida so\'m narxini formatlaydi', () => {
      expect(formatUzs(29000, 'uz')).toBe("29 000 so'm")
      expect(formatUzs(79000, 'ru')).toBe('79 000 сум')
      expect(formatUzs(149000, 'uz')).toBe("149 000 so'm")
    })
  })

  describe('CLICK_ERRORS constants', () => {
    it('Click spetsifikatsiyasi xatolik kodlari to\'g\'ri belgilangan', () => {
      expect(CLICK_ERRORS.SUCCESS).toBe(0)
      expect(CLICK_ERRORS.SIGN_CHECK_FAILED).toBe(-1)
      expect(CLICK_ERRORS.INCORRECT_AMOUNT).toBe(-2)
      expect(CLICK_ERRORS.ACTION_NOT_FOUND).toBe(-3)
      expect(CLICK_ERRORS.ALREADY_PAID).toBe(-4)
      expect(CLICK_ERRORS.ORDER_NOT_FOUND).toBe(-5)
      expect(CLICK_ERRORS.TRANSACTION_CANCELLED).toBe(-9)
    })
  })

  describe('Plan UZS pricing data integrity', () => {
    it('barcha tariflarda UZS narxi to\'g\'ri', () => {
      const month = getPlan('month')!
      const year = getPlan('year')!
      const lifetime = getPlan('lifetime')!

      expect(month.priceUzs).toBe(29000)
      expect(year.priceUzs).toBe(79000)
      expect(lifetime.priceUzs).toBe(149000)
    })
  })
})
