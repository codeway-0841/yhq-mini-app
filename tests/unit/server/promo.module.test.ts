import { describe, it, expect } from 'vitest'
import { promoRepository } from '../../../server/modules/promo/promo.repository'

describe('server/modules/promo - REAL Module Tests', () => {
  it('promoRepository defines required methods', () => {
    expect(typeof promoRepository.findByCode).toBe('function')
    expect(typeof promoRepository.isRedeemedByUser).toBe('function')
    expect(typeof promoRepository.redeem).toBe('function')
    expect(typeof promoRepository.getAllCodes).toBe('function')
    expect(typeof promoRepository.createCode).toBe('function')
    expect(typeof promoRepository.toggleActive).toBe('function')
    expect(typeof promoRepository.deleteCode).toBe('function')
  })
})
