import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import savedRouter from '../../../server/modules/saved/saved.router'
import { savedRepository } from '../../../server/modules/saved/saved.repository'
import { errorHandler } from '../../../server/middleware/error-handler'

const app = express()
app.use(express.json())
app.use('/api', savedRouter)
app.use(errorHandler)

describe('saved.router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/saved/:userId', () => {
    it('returns saved questions list for a valid userId', async () => {
      vi.spyOn(savedRepository, 'findByUserId').mockResolvedValue(['yhq:1', 'yhq:5'])

      const res = await request(app).get('/api/saved/12345').expect(200)
      expect(res.body).toEqual(['yhq:1', 'yhq:5'])
      expect(savedRepository.findByUserId).toHaveBeenCalledWith('12345')
    })
  })

  describe('POST /api/saved/:userId', () => {
    it('saves a question successfully', async () => {
      vi.spyOn(savedRepository, 'add').mockResolvedValue(undefined as any)

      const res = await request(app)
        .post('/api/saved/12345')
        .send({ questionId: 42, subjectId: 'yhq' })
        .expect(200)

      expect(res.body).toEqual({ ok: true })
      expect(savedRepository.add).toHaveBeenCalledWith('12345', 42, 'yhq')
    })

    it('rejects invalid questionId', async () => {
      await request(app)
        .post('/api/saved/12345')
        .send({ questionId: -1, subjectId: 'yhq' })
        .expect(400)
    })
  })

  describe('DELETE /api/saved/:userId/:questionId', () => {
    it('removes a saved question successfully', async () => {
      vi.spyOn(savedRepository, 'remove').mockResolvedValue(undefined as any)

      const res = await request(app)
        .delete('/api/saved/12345/42?subject=yhq')
        .expect(200)

      expect(res.body).toEqual({ ok: true })
      expect(savedRepository.remove).toHaveBeenCalledWith('12345', 42, 'yhq')
    })
  })
})
