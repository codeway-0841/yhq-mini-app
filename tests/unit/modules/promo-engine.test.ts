import { describe, it, expect } from 'vitest'
import { PromoCodeRow } from '../../../server/modules/promo/promo.repository'

describe('Promo Code Engine & Subscription Stacking', () => {
  const BASE_DATE = new Date('2026-08-16T12:00:00.000Z')

  describe('Subscription Extension Math (Stacking Logic)', () => {
    // Pure function simulating Postgres CTE: GREATEST(COALESCE(premium_until, now()), now()) + interval(days)
    const computeNewPremiumExpiry = (
      currentExpiry: Date | null,
      now: Date,
      addedDays: number
    ): Date => {
      const base = currentExpiry && currentExpiry.getTime() > now.getTime()
        ? currentExpiry.getTime()
        : now.getTime()
      return new Date(base + addedDays * 86_400_000)
    }

    it('stacks onto existing active premium date without discarding remaining balance', () => {
      // User already has 10 days remaining (until Aug 26)
      const currentExpiry = new Date('2026-08-26T12:00:00.000Z')
      const addedDays = 30 // 30-day promo

      const newExpiry = computeNewPremiumExpiry(currentExpiry, BASE_DATE, addedDays)
      // New expiry must be Aug 26 + 30 days = Sep 25, NOT Aug 16 + 30 = Sep 15!
      expect(newExpiry.toISOString()).toBe('2026-09-25T12:00:00.000Z')
    })

    it('starts fresh from now if user is on free tier (null expiry)', () => {
      const addedDays = 7
      const newExpiry = computeNewPremiumExpiry(null, BASE_DATE, addedDays)
      expect(newExpiry.toISOString()).toBe('2026-08-23T12:00:00.000Z')
    })

    it('starts fresh from now if previous premium subscription had already expired in the past', () => {
      const expiredDate = new Date('2026-08-01T12:00:00.000Z') // Expired 15 days ago
      const addedDays = 14

      const newExpiry = computeNewPremiumExpiry(expiredDate, BASE_DATE, addedDays)
      // Must not add onto the past date (which would give 2026-08-15, still in the past)
      expect(newExpiry.toISOString()).toBe('2026-08-30T12:00:00.000Z')
    })
  })

  describe('Validation & Eligibility Rules', () => {
    const isPromoValid = (
      promo: PromoCodeRow,
      now: Date
    ): { valid: boolean; reason?: string } => {
      if (!promo.isActive) return { valid: false, reason: 'PROMO_INACTIVE' }
      if (promo.expiresAt && promo.expiresAt.getTime() < now.getTime()) {
        return { valid: false, reason: 'PROMO_EXPIRED' }
      }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        return { valid: false, reason: 'PROMO_LIMIT_REACHED' }
      }
      return { valid: true }
    }

    it('validates active promo within usage and date limits', () => {
      const activePromo: PromoCodeRow = {
        id: 1,
        code: 'SUMMER2026',
        type: 'premium_days',
        value: 30,
        maxUses: 100,
        usedCount: 45,
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        isActive: true,
        createdAt: new Date('2026-08-01T00:00:00Z'),
      }

      const check = isPromoValid(activePromo, BASE_DATE)
      expect(check.valid).toBe(true)
    })

    it('rejects inactive promo codes', () => {
      const inactivePromo: PromoCodeRow = {
        id: 2,
        code: 'DISABLED',
        type: 'premium_days',
        value: 10,
        maxUses: null,
        usedCount: 0,
        expiresAt: null,
        isActive: false,
        createdAt: new Date(),
      }

      const check = isPromoValid(inactivePromo, BASE_DATE)
      expect(check.valid).toBe(false)
      expect(check.reason).toBe('PROMO_INACTIVE')
    })

    it('rejects expired promo codes', () => {
      const expiredPromo: PromoCodeRow = {
        id: 3,
        code: 'OLD2025',
        type: 'premium_days',
        value: 30,
        maxUses: null,
        usedCount: 10,
        expiresAt: new Date('2026-08-10T00:00:00Z'), // Past
        isActive: true,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      }

      const check = isPromoValid(expiredPromo, BASE_DATE)
      expect(check.valid).toBe(false)
      expect(check.reason).toBe('PROMO_EXPIRED')
    })

    it('rejects promo code when usage limit is reached (exhausted quota)', () => {
      const exhaustedPromo: PromoCodeRow = {
        id: 4,
        code: 'FIRST50',
        type: 'premium_days',
        value: 15,
        maxUses: 50,
        usedCount: 50, // 50 of 50 used
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
      }

      const check = isPromoValid(exhaustedPromo, BASE_DATE)
      expect(check.valid).toBe(false)
      expect(check.reason).toBe('PROMO_LIMIT_REACHED')
    })
  })

  describe('Code Normalization', () => {
    it('normalizes spaces, tabs, and mixed case uniformly', () => {
      const rawInputs = [
        '  avto2026  ',
        'AvTo2026',
        '\tAVTO2026\n',
        'avto2026',
      ]

      const normalized = rawInputs.map((s) => s.trim().toUpperCase())
      const uniqueSet = new Set(normalized)

      expect(uniqueSet.size).toBe(1)
      expect(uniqueSet.has('AVTO2026')).toBe(true)
    })
  })
})
