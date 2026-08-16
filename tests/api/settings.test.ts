import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('Settings API Endpoints', () => {
  it('PATCH /api/settings/:userId rejects invalid payload with 400', async () => {
    const res = await request(app)
      .patch('/api/settings/123456789')
      .send({ language: 'invalid_lang_code' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('PATCH /api/settings/:userId rejects invalid userId with 400', async () => {
    const res = await request(app)
      .patch('/api/settings/invalid!user@id')
      .send({ sound: true })
    expect(res.status).toBe(400)
  })
})
