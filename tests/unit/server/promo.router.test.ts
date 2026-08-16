import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { promoRepository } from '../../../server/modules/promo/promo.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()

describe('server/modules/promo/promo.router.ts - Real Router Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(authRepository, 'resolveSession').mockImplementation(async (token) => {
      if (token.startsWith('user_session_')) {
        return {
          userId: token.replace('user_session_', ''),
          provider: 'phone',
          expiresAt: new Date(Date.now() + 1000000),
        } as any
      }
      return null
    })
  })

  describe('POST /api/promo/redeem', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/promo/redeem')
        .send({ code: 'BONUS2026' })
        .expect(401)

      expect(res.body.error).toBe('Avval tizimga kiring')
    })

    it('returns 404 when promo code not found', async () => {
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue(null)

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_101')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ code: 'NOT_FOUND_CODE' })
        .expect(404)

      expect(res.body.error).toBe('Promokod topilmadi')
    })

    it('returns 400 when promo code is inactive', async () => {
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({
        id: 1,
        code: 'INACTIVE',
        type: 'premium_days',
        value: 7,
        maxUses: null,
        usedCount: 0,
        isActive: false,
        expiresAt: null,
        createdAt: new Date(),
      })

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_102')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ code: 'INACTIVE' })
        .expect(400)

      expect(res.body.error).toBe('Promokod faol emas')
    })

    it('returns 400 when promo code is expired', async () => {
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({
        id: 2,
        code: 'EXPIRED',
        type: 'premium_days',
        value: 7,
        maxUses: null,
        usedCount: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 100000),
        createdAt: new Date(),
      })

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_103')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({ code: 'EXPIRED' })
        .expect(400)

      expect(res.body.error).toBe('Promokodning amal qilish muddati tugagan')
    })

    it('returns 400 when promo code max uses reached', async () => {
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({
        id: 3,
        code: 'MAXED',
        type: 'premium_days',
        value: 7,
        maxUses: 10,
        usedCount: 10,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
      })

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_104')
        .set('X-Forwarded-For', '10.0.0.4')
        .send({ code: 'MAXED' })
        .expect(400)

      expect(res.body.error).toBe('Promokoddan foydalanish limiti tugagan')
    })

    it('returns 400 when user already redeemed this promo', async () => {
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({
        id: 4,
        code: 'USED_BEFORE',
        type: 'premium_days',
        value: 7,
        maxUses: null,
        usedCount: 1,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
      })
      vi.spyOn(promoRepository, 'isRedeemedByUser').mockResolvedValue(true)

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_105')
        .set('X-Forwarded-For', '10.0.0.5')
        .send({ code: 'USED_BEFORE' })
        .expect(400)

      expect(res.body.error).toBe('Siz ushbu promokodni avval ishlatgansiz')
    })

    it('successfully redeems valid promo code and returns premium status', async () => {
      const now = new Date()
      vi.spyOn(promoRepository, 'findByCode').mockResolvedValue({
        id: 5,
        code: 'VALID7DAYS',
        type: 'premium_days',
        value: 7,
        maxUses: 100,
        usedCount: 5,
        isActive: true,
        expiresAt: new Date(Date.now() + 10000000),
        createdAt: now,
      })
      vi.spyOn(promoRepository, 'isRedeemedByUser').mockResolvedValue(false)
      vi.spyOn(promoRepository, 'redeem').mockResolvedValue({
        success: true,
        premiumUntil: new Date(Date.now() + 7 * 86400000),
        tariff: 'premium',
      })

      const res = await request(app)
        .post('/api/promo/redeem')
        .set('Authorization', 'Bearer user_session_106')
        .set('X-Forwarded-For', '10.0.0.6')
        .send({ code: 'VALID7DAYS' })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.value).toBe(7)
      expect(res.body.tariff).toBe('premium')
    })
  })
})
