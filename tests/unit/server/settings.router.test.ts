import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import settingsRouter from '../../../server/modules/settings/settings.router'
import { settingsRepository } from '../../../server/modules/settings/settings.repository'
import { errorHandler } from '../../../server/middleware/error-handler'

const app = express()
app.use(express.json())
app.use('/api', settingsRouter)
app.use(errorHandler)

describe('settings.router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PATCH /api/settings/:userId', () => {
    it('updates valid settings successfully', async () => {
      vi.spyOn(settingsRepository, 'patch').mockResolvedValue({ userId: '12345' } as any)

      const res = await request(app)
        .patch('/api/settings/12345')
        .send({ theme: 'dark', language: 'uz', fontSize: 'large' })
        .expect(200)

      expect(res.body).toEqual({ ok: true })
      expect(settingsRepository.patch).toHaveBeenCalledWith('12345', {
        theme: 'dark',
        language: 'uz',
        fontSize: 'large',
      })
    })

    it('returns 404 when settings row is not found', async () => {
      vi.spyOn(settingsRepository, 'patch').mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/settings/12345')
        .send({ theme: 'dark' })
        .expect(404)

      expect(res.body.error).toBe('Settings row not found — call /init first')
    })
  })
})
