import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()

describe('server/modules/admin/admin.router.ts - Admin Router Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(authRepository, 'resolveSession').mockImplementation(async (token) => {
      if (token === 'admin_bearer_token') {
        return {
          userId: '999999999',
          provider: 'phone',
          expiresAt: new Date(Date.now() + 1000000),
        } as any
      }
      if (token === 'user_bearer_token') {
        return {
          userId: '123456789',
          provider: 'phone',
          expiresAt: new Date(Date.now() + 1000000),
        } as any
      }
      return null
    })
  })

  describe('Security & Authorization Boundaries', () => {
    it('GET /api/admin/stats returns 401 when no auth provided', async () => {
      const res = await request(app).get('/api/admin/stats').expect(401)
      expect(res.body.error).toBe('telegram_user_not_identified')
    })

    it('GET /api/admin/stats returns 403 for non-admin user', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ isAdmin: false }]),
        }),
      } as any)

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer user_bearer_token')
        .expect(403)

      expect(res.body.error).toBe('admin_required')
    })

    it('POST /api/admin/questions validates question payload schema for admin', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ isAdmin: true }]),
        }),
      } as any)

      // Invalid payload (mismatched option keys between UZ and RU)
      const res = await request(app)
        .post('/api/admin/questions')
        .set('Authorization', 'Bearer admin_bearer_token')
        .send({
          questionUz: 'Savol',
          questionRu: 'Вопрос',
          optionsUz: { F1: '1', F2: '2' },
          optionsRu: { F1: '1', F3: '3' },
          correctAnswer: 'F1',
        })
        .expect(400)

      expect(res.body.error).toBeDefined()
    })
  })
})
