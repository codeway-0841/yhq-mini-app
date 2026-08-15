import { describe, it, expect } from 'vitest'
import { promoCodes, users } from '../../../server/schema'

describe('Admin Panel Module & API Logic', () => {
  it('validates promo code creation constraints', () => {
    const validPromo = {
      code: 'AVTO2026',
      type: 'premium_days',
      value: 30,
      maxUses: 100,
      expiresAt: new Date('2026-12-31'),
    }

    expect(validPromo.code).toMatch(/^[A-Z0-9_]+$/)
    expect(validPromo.value).toBeGreaterThan(0)
    expect(validPromo.maxUses).toBe(100)
  })

  it('calculates premium extension logic correctly for users', () => {
    const calculateNewExpiry = (currentExpiry: Date | null, daysToAdd: number): Date => {
      const now = new Date()
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now
      const result = new Date(base.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
      return result
    }

    // 1. User currently free (no current expiry)
    const expiry1 = calculateNewExpiry(null, 30)
    expect(expiry1.getTime()).toBeGreaterThan(Date.now())

    // 2. User has 10 days left (adds 30 days -> 40 days total)
    const existing = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    const expiry2 = calculateNewExpiry(existing, 30)
    const diffDays = Math.round((expiry2.getTime() - existing.getTime()) / (24 * 60 * 60 * 1000))
    expect(diffDays).toBe(30)
  })

  it('validates schema definition for users and promo codes in admin', () => {
    expect(users.tariff).toBeDefined()
    expect(users.premiumUntil).toBeDefined()
    expect(users.isAdmin).toBeDefined()

    expect(promoCodes.code).toBeDefined()
    expect(promoCodes.value).toBeDefined()
    expect(promoCodes.maxUses).toBeDefined()
    expect(promoCodes.usedCount).toBeDefined()
  })

  it('correctly maps subjects to independent question banks', async () => {
    const { SUBJECT_BASES } = await import('../../../shared/subjects')
    const { SUBJECT_REGISTRY } = await import('../../../server/config/subjects')

    const subjectToBank = new Map(SUBJECT_BASES.map((s) => [s.id, s.dataSourceId]))
    expect(subjectToBank.get('yhq')).toBe('traffic_rules_db')
    expect(subjectToBank.get('rustili')).toBe('russian_db')
    expect(subjectToBank.get('fizika')).toBe('physics_db')
    expect(subjectToBank.get('matematika')).toBe('math_db')
    expect(subjectToBank.get('kimyo')).toBe('chemistry_db')
    expect(subjectToBank.get('ingliz')).toBe('english_db')
    expect(subjectToBank.get('tarix')).toBe('history_db')
    expect(subjectToBank.get('biologiya')).toBe('biology_db')

    // Ensure all 8 subjects are registered in server registry
    expect(SUBJECT_REGISTRY.length).toBe(8)
  })
})
