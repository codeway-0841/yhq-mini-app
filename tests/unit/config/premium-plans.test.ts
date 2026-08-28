/**
 * Premium tarif rejalari — data integrity + payload format sinxronligi.
 * Frontend kartalar va bot invoicelar shu konfigdan o'qiydi.
 */
import { describe, it, expect } from 'vitest'
import {
  PREMIUM_PLANS,
  HIGHLIGHT_PLAN,
  getPlan,
  parseStartParam,
  parsePaymentPayload,
  applyDiscount,
} from '../../../shared/premium-plans'

describe('shared/premium-plans — data integrity', () => {
  it("barcha key'lar unikal", () => {
    const keys = PREMIUM_PLANS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('HIGHLIGHT_PLAN roʻyxatda mavjud', () => {
    expect(PREMIUM_PLANS.some((p) => p.key === HIGHLIGHT_PLAN)).toBe(true)
  })

  it('narxlar musbat va oylik < yillik < umrbod tartibida (Stars & UZS)', () => {
    const starsPrice = (k: string) => getPlan(k)!.stars
    const uzsPrice = (k: string) => getPlan(k)!.priceUzs
    for (const p of PREMIUM_PLANS) {
      expect(p.stars).toBeGreaterThan(0)
      expect(p.priceUzs).toBeGreaterThan(0)
    }
    expect(starsPrice('month')).toBeLessThan(starsPrice('year'))
    expect(starsPrice('year')).toBeLessThan(starsPrice('lifetime'))
    expect(uzsPrice('month')).toBeLessThan(uzsPrice('year'))
    expect(uzsPrice('year')).toBeLessThan(uzsPrice('lifetime'))
  })

  it("faqat lifetime'da days = null", () => {
    for (const p of PREMIUM_PLANS) {
      if (p.key === 'lifetime') expect(p.days).toBeNull()
      else expect(p.days).toBeGreaterThan(0)
    }
  })

  it('i18n matnlar bosh emas', () => {
    for (const p of PREMIUM_PLANS) {
      expect(p.titleUz.trim()).not.toBe('')
      expect(p.titleRu.trim()).not.toBe('')
    }
  })
})

describe('parseStartParam', () => {
  it("umumiy 'premium' → chooser", () => expect(parseStartParam('premium')).toBe('chooser'))
  it("'premium_month' → month", () => expect(parseStartParam('premium_month')).toBe('month'))
  it("'premium_year' → year", () => expect(parseStartParam('premium_year')).toBe('year'))
  it("'premium_lifetime' → lifetime", () => expect(parseStartParam('premium_lifetime')).toBe('lifetime'))
  it("boshqa param → null", () => {
    expect(parseStartParam('duel-abc123')).toBeNull()
    expect(parseStartParam('premium_xxx')).toBeNull()
    expect(parseStartParam('')).toBeNull()
  })
})

describe('parsePaymentPayload', () => {
  it("yangi format: 'premium_month_123'", () => {
    expect(parsePaymentPayload('premium_month_123')).toEqual({ plan: getPlan('month'), userId: '123' })
  })
  it("ESKI format backward-compat: 'premium_456' → lifetime", () => {
    expect(parsePaymentPayload('premium_456')).toEqual({ plan: getPlan('lifetime'), userId: '456' })
  })
  it('notoʻgʻri payload → null', () => {
    expect(parsePaymentPayload('premium_')).toBeNull()
    expect(parsePaymentPayload('random')).toBeNull()
    expect(parsePaymentPayload('premium_month_')).toBeNull()
  })
})

describe('applyDiscount — promokod chegirmasi (client↔server umumiy)', () => {
  it('25%: 29000 → 21750', () => expect(applyDiscount(29_000, 25)).toBe(21_750))
  it('10%: 149000 → 134100', () => expect(applyDiscount(149_000, 10)).toBe(134_100))
  it('0/NaN/manfiy → asl narx', () => {
    expect(applyDiscount(29_000, 0)).toBe(29_000)
    expect(applyDiscount(29_000, Number.NaN)).toBe(29_000)
    expect(applyDiscount(29_000, -5)).toBe(29_000)
  })
  it("99% dan oshgan qiymat clamp'lanadi", () => expect(applyDiscount(100_000, 150)).toBe(1_000))
  it('kasr yaxlitlanadi (integer UZS)', () => expect(applyDiscount(10_001, 33)).toBe(Math.round(10_001 * 67 / 100)))
})
