import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { adminRepository } from '../../../server/modules/admin/admin.repository'

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

  describe('Question bank hardening (v2 §11)', () => {
    beforeEach(() => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ isAdmin: true }]),
        }),
      } as any)
    })

    const adminGet = (path: string) =>
      request(app).get(path).set('Authorization', 'Bearer admin_bearer_token')

    it('GET /api/admin/questions returns a keyless page with total', async () => {
      const listSpy = vi.spyOn(adminRepository, 'listQuestionsPage').mockResolvedValue({
        rows: [{ id: 1, questionUz: 'Savol', questionRu: 'Вопрос', image: null, topicId: 9 }],
        total: 2,
      })

      const res = await adminGet('/api/admin/questions?subject=yhq&limit=1&offset=1').expect(200)

      expect(listSpy).toHaveBeenCalledWith('traffic_rules_db', { limit: 1, offset: 1, search: undefined })
      expect(res.body.total).toBe(2)
      expect(res.body.rows).toHaveLength(1)
      expect(res.body.rows[0]).not.toHaveProperty('correctAnswer')
      expect(res.body.rows[0]).not.toHaveProperty('optionsUz')
      expect(res.headers['cache-control']).toBe('private, no-store')
    })

    it('GET /api/admin/questions caps page size (limit=999 → 400)', async () => {
      const listSpy = vi.spyOn(adminRepository, 'listQuestionsPage')
      await adminGet('/api/admin/questions?limit=999').expect(400)
      expect(listSpy).not.toHaveBeenCalled()
    })

    it('GET /api/admin/questions/:id returns the full row and audits the read', async () => {
      const full = {
        id: 7, questionUz: 'Savol', questionRu: 'Вопрос',
        optionsUz: { F1: 'a' }, optionsRu: { F1: 'а' },
        correctAnswer: 'F1', image: null, topicId: 9,
      }
      vi.spyOn(adminRepository, 'findQuestionById').mockResolvedValue(full as never)
      const auditSpy = vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue(undefined)

      const res = await adminGet('/api/admin/questions/7?subject=yhq').expect(200)

      expect(res.body.correctAnswer).toBe('F1')
      expect(res.headers['cache-control']).toBe('private, no-store')
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
        action: 'admin_question_detail',
        resourceType: 'question',
        resourceId: '7',
      }))
      // Javob matni audit log'ga yozilmaydi
      expect(JSON.stringify(auditSpy.mock.calls)).not.toContain('Вопрос')
    })

    it('GET /api/admin/questions/:id returns 404 for a missing question', async () => {
      vi.spyOn(adminRepository, 'findQuestionById').mockResolvedValue(null)
      const auditSpy = vi.spyOn(authRepository, 'createAuditLog').mockResolvedValue(undefined)

      await adminGet('/api/admin/questions/999999').expect(404)
      expect(auditSpy).not.toHaveBeenCalled()
    })

    it('GET /api/admin/questions/meta still works (route-order guard)', async () => {
      vi.spyOn(adminRepository, 'questionBankMeta').mockResolvedValue({ total: 10, withTopic: 8 })

      const res = await adminGet('/api/admin/questions/meta?subject=yhq').expect(200)
      expect(res.body).toEqual({ total: 10, withTopic: 8 })
    })
  })
})
