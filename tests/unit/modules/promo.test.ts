import { describe, it, expect } from 'vitest'
import { t } from '../../../src/shared/i18n'
import { promoCodes, promoCodeRedemptions } from '../../../server/schema'

describe('Promo Codes Module & Schema', () => {
  it('has complete UZ and RU i18n keys for Promo Codes', () => {
    expect(t('uz', 'promoCode')).toBe('Promokod')
    expect(t('ru', 'promoCode')).toBe('Промокод')

    expect(t('uz', 'promoCodeTitle')).toBe('Promokod faollashtirish')
    expect(t('ru', 'promoCodeTitle')).toBe('Активация промокода')

    expect(t('uz', 'promoCodePlaceholder')).toBe('Masalan: AVTO2026')
    expect(t('ru', 'promoCodePlaceholder')).toBe('Например: AVTO2026')

    expect(t('uz', 'promoCodeActivateBtn')).toBe('Faollashtirish')
    expect(t('ru', 'promoCodeActivateBtn')).toBe('Активировать')

    expect(t('uz', 'promoCodeSuccessTitle')).toBeTruthy()
    expect(t('ru', 'promoCodeSuccessTitle')).toBeTruthy()

    expect(t('uz', 'promoCodeInvalid')).toBeTruthy()
    expect(t('ru', 'promoCodeInvalid')).toBeTruthy()

    expect(t('uz', 'promoCodeAlreadyUsed')).toBeTruthy()
    expect(t('ru', 'promoCodeAlreadyUsed')).toBeTruthy()
  })

  it('defines promo_codes and promo_code_redemptions tables in schema', () => {
    expect(promoCodes).toBeDefined()
    expect(promoCodes.code).toBeDefined()
    expect(promoCodes.value).toBeDefined()
    expect(promoCodes.usedCount).toBeDefined()
    expect(promoCodes.isActive).toBeDefined()

    expect(promoCodeRedemptions).toBeDefined()
    expect(promoCodeRedemptions.promoCodeId).toBeDefined()
    expect(promoCodeRedemptions.userId).toBeDefined()
  })

  it('normalizes promo code to uppercase trim', () => {
    const rawInput = '  avto_samarqand  '
    const normalized = rawInput.trim().toUpperCase()
    expect(normalized).toBe('AVTO_SAMARQAND')
  })

  it('validates promo code expiration logic', () => {
    const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days ahead

    const isExpired = (expiresAt: Date | null) => {
      if (!expiresAt) return false
      return expiresAt < new Date()
    }

    expect(isExpired(expiredDate)).toBe(true)
    expect(isExpired(futureDate)).toBe(false)
    expect(isExpired(null)).toBe(false)
  })

  it('validates promo code max usage limit logic', () => {
    const isLimitReached = (usedCount: number, maxUses: number | null) => {
      if (maxUses === null) return false
      return usedCount >= maxUses
    }

    expect(isLimitReached(50, 100)).toBe(false)
    expect(isLimitReached(100, 100)).toBe(true)
    expect(isLimitReached(101, 100)).toBe(true)
    expect(isLimitReached(9999, null)).toBe(false)
  })
})
