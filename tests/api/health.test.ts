import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('API Health & Routing Endpoints', () => {
  it('GET /api/health returns 200 OK with uptime and status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('uptime')
    expect(typeof res.body.uptime).toBe('number')
  })

  it('GET / returns 200 OK (ping/monitor servislar uchun — SPA bu serverda emas)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
  })

  it('GET /api/nonexistent-route returns 404 with error message', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint-xyz')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })
})
