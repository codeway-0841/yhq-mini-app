import { describe, expect, it } from 'vitest'
import { validatePremiumPayment } from '../../../server/modules/payments/payment.service'

describe('validatePremiumPayment', () => {
  it('valid invoice qiymatlarini qabul qiladi', () => {
    const result = validatePremiumPayment({
      payerId: '12345',
      payload: 'premium_month_12345',
      currency: 'XTR',
      totalAmount: 99,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe(12345n)
      expect(result.plan.key).toBe('month')
    }
  })

  it('invalid payloadni rad etadi', () => {
    expect(validatePremiumPayment({
      payerId: '12345', payload: 'broken', currency: 'XTR', totalAmount: 99,
    })).toEqual({ ok: false, reason: 'invalid_payload' })
  })

  it('boshqa payer invoiceini rad etadi', () => {
    expect(validatePremiumPayment({
      payerId: '999', payload: 'premium_month_12345', currency: 'XTR', totalAmount: 99,
    })).toEqual({ ok: false, reason: 'payer_mismatch' })
  })

  it('noto‘g‘ri currency va summani rad etadi', () => {
    expect(validatePremiumPayment({
      payerId: '12345', payload: 'premium_year_12345', currency: 'USD', totalAmount: 250,
    })).toEqual({ ok: false, reason: 'invalid_currency' })
    expect(validatePremiumPayment({
      payerId: '12345', payload: 'premium_year_12345', currency: 'XTR', totalAmount: 99,
    })).toEqual({ ok: false, reason: 'invalid_amount' })
  })

  it('eski payloadni faqat lifetime narxi bilan qabul qiladi', () => {
    const valid = validatePremiumPayment({
      payerId: '12345', payload: 'premium_12345', currency: 'XTR', totalAmount: 500,
    })
    expect(valid.ok && valid.plan.key).toBe('lifetime')
  })
})
