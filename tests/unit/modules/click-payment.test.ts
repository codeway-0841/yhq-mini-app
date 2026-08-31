import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateClickSignature,
  buildClickPaymentUrl,
  handleClickPrepare,
  handleClickComplete,
  CLICK_ERRORS,
} from '../../../server/modules/payments/click.service'
import { db } from '../../../server/db/connection'
import { config } from '../../../server/config'
import { formatUzs, getPlan } from '../../../shared/premium-plans'

describe('Click Payment Gateway — Unit Tests', () => {
  const sampleSecretKey = 'test_click_secret_key_12345'
  let originalSecret: string

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
    beforeEach(() => {
      ;(config.click as { serviceId: string }).serviceId = '32876'
      ;(config.click as { merchantId: string }).merchantId = '24567'
    })

    it('to\'g\'ri parametrlar bilan Click checkout URL hosil qiladi', () => {
      const url = buildClickPaymentUrl({
        orderId: 'ord_test_999',
        amount: 79000,
        returnUrl: 'https://yhq-mini-app.vercel.app/premium',
      })

      expect(url).toContain('https://my.click.uz/services/pay')
      expect(url).toContain('service_id=32876')
      expect(url).toContain('merchant_id=24567')
      expect(url).toContain('amount=79000')
      expect(url).toContain('transaction_param=ord_test_999')
      expect(url).toContain('return_url=')
    })

    // L-4 (audit 2026-08-31): hardcode fallback O'CHIRILDI — env unutilsa pul
    // eski/default merchant'ga ketardi. Endi fail-closed (throw).
    it('merchant ID\'lar sozlanmagan bo\'lsa — THROW (fail-closed, hardcode fallback YO\'Q)', () => {
      ;(config.click as { serviceId: string }).serviceId = ''
      expect(() => buildClickPaymentUrl({ orderId: 'ord_x', amount: 1000 }))
        .toThrow(/CLICK_SERVICE_ID/)
    })
  })

  describe('formatUzs', () => {
    it('o\'zbek va rus tillarida so\'m narxini formatlaydi', () => {
      expect(formatUzs(29000, 'uz')).toBe("29 000 so'm")
      expect(formatUzs(79000, 'ru')).toBe('79 000 сум')
      expect(formatUzs(149000, 'uz')).toBe("149 000 so'm")
    })
  })

  describe('Webhook signature — fail-closed (audit fix)', () => {
    const basePrepare = {
      click_trans_id: '1001',
      service_id: '32876',
      merchant_trans_id: 'ord_12345',
      amount: '29000',
      action: 0 as const,
      error: 0,
      sign_time: '2026-08-15 12:00:00',
    }

    beforeEach(() => {
      // Signature'dan keyingi DB lookup'gacha yetib bormasligi uchun spy:
      // agar yetiborsa ham bo'sh natija → ORDER_NOT_FOUND (SIGN_CHECK_FAILED emas).
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      } as any)
      originalSecret = config.click.secretKey
    })
    afterEach(() => {
      vi.restoreAllMocks()
      // config startup snapshot'i — test valuesini qaytaramiz
      ;(config.click as { secretKey: string }).secretKey = originalSecret
    })

    it("secret sozlanmagan bo'lsa prepare FAIL-CLOSED — to'lov o'tmaydi", async () => {
      ;(config.click as { secretKey: string }).secretKey = ''
      const res = await handleClickPrepare({ ...basePrepare, sign_string: 'deadbeef' })
      expect(res.error).toBe(CLICK_ERRORS.SIGN_CHECK_FAILED)
      expect(db.select).not.toHaveBeenCalled()
    })

    it("secret sozlanmagan bo'lsa complete FAIL-CLOSED — premium berilmaydi", async () => {
      ;(config.click as { secretKey: string }).secretKey = ''
      const res = await handleClickComplete({
        ...basePrepare, action: 1 as const, merchant_prepare_id: 42, sign_string: 'deadbeef',
      })
      expect(res.error).toBe(CLICK_ERRORS.SIGN_CHECK_FAILED)
      expect(db.select).not.toHaveBeenCalled()
    })

    it("noto'g'ri imzo rad etiladi (timing-safe compare ishlaydi)", async () => {
      ;(config.click as { secretKey: string }).secretKey = sampleSecretKey
      const res = await handleClickPrepare({ ...basePrepare, sign_string: '0'.repeat(32) })
      expect(res.error).toBe(CLICK_ERRORS.SIGN_CHECK_FAILED)
      expect(db.select).not.toHaveBeenCalled()
    })

    it("to'g'ri imzo signature bosqichidan o'tadi (ORDER_NOT_FOUND — DB lookup yetib bordi)", async () => {
      ;(config.click as { secretKey: string }).secretKey = sampleSecretKey
      const sign = generateClickSignature({
        click_trans_id: '1001', service_id: '32876', secret_key: sampleSecretKey,
        merchant_trans_id: 'ord_12345', amount: '29000', action: 0,
        sign_time: '2026-08-15 12:00:00',
      })
      const res = await handleClickPrepare({ ...basePrepare, sign_string: sign })
      expect(res.error).toBe(CLICK_ERRORS.ORDER_NOT_FOUND)
      expect(db.select).toHaveBeenCalled()
    })
  })

  describe('Complete — status guard error<0 downgrade\'dan OLDIN (audit #8)', () => {
    let savedSecret: string

    beforeEach(() => {
      savedSecret = config.click.secretKey
    })
    afterEach(() => {
      vi.restoreAllMocks()
      ;(config.click as { secretKey: string }).secretKey = savedSecret
    })

    it('allaqachon COMPLETED buyurtmaga eskirgan error<0 webhook kelsa — ALREADY_PAID, status BUZILMAYDI', async () => {
      ;(config.click as { secretKey: string }).secretKey = sampleSecretKey
      const order = {
        id: 42, orderId: 'ord_12345', userId: '1', plan: 'month',
        amountUzs: 29000, provider: 'click', status: 'completed',
        providerTransId: 'old_trans_id', rawDetails: {},
      }
      // 1-select: buyurtma lookup (completed, BOSHQA trans_id bilan yozilgan);
      // 2-select: atomik claim (pending→completed) mos kelmagach — replay
      // tekshiruvi uchun qayta o'qish (6-bosqich, mavjud "fresh" mantiqi).
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([order]) }),
      } as any)
      // Atomik claim: WHERE status='pending' — order 'completed' bo'lgani
      // uchun HECH QANDAY qator mos kelmaydi (real DB xulqi bilan bir xil).
      const updateSpy = vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      } as any)

      const sign = generateClickSignature({
        click_trans_id: '9999', service_id: '32876', secret_key: sampleSecretKey,
        merchant_trans_id: 'ord_12345', merchant_prepare_id: 42, amount: '29000',
        action: 1, sign_time: '2026-08-15 12:00:00',
      })
      const res = await handleClickComplete({
        click_trans_id: '9999', service_id: '32876', merchant_trans_id: 'ord_12345',
        merchant_prepare_id: 42, amount: '29000', action: 1, error: -9,
        error_note: 'cancelled by user', sign_time: '2026-08-15 12:00:00', sign_string: sign,
      })

      expect(res.error).toBe(CLICK_ERRORS.ALREADY_PAID)
      // db.update FAQAT BITTA marta chaqirilishi shart — atomik claim (6-bosqich).
      // Downgrade (status='cancelled'ga tushiruvchi qo'shimcha UPDATE) YO'Q —
      // aks holda bu son 2 bo'lardi (avvalgi bug aynan shu edi).
      expect(updateSpy).toHaveBeenCalledTimes(1)
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
