import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('Auth API Endpoints', () => {
  it('POST /api/auth/phone/register rejects empty payload with 400', async () => {
    const res = await request(app).post('/api/auth/phone/register').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('POST /api/auth/phone/login rejects invalid phone with 400', async () => {
    const res = await request(app).post('/api/auth/phone/login').send({
      phone: '123',
      password: 'short',
    })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('POST /api/auth/telegram rejects invalid hash with 400', async () => {
    const res = await request(app).post('/api/auth/telegram').send({
      id: 123456,
      first_name: 'Test',
      auth_date: Math.floor(Date.now() / 1000),
      hash: '',
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/auth/me requires authentication (401)', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/email/login rejects malformed email with 400', async () => {
    const res = await request(app).post('/api/auth/email/login').send({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(res.status).toBe(400)
  })
})
