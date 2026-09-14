/**
 * Grafik quruvchi API — anonim so'rovlar requireAuth bilan 401 olishi.
 * (Test muhitida telegramAuth permissive, lekin router-level requireAuth
 * DOIM ishlaydi — test-sessions pattern'i.)
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('API: /api/graphs auth gating', () => {
  it('GET /api/graphs — credentialsiz 401', async () => {
    const res = await request(app).get('/api/graphs')
    expect(res.status).toBe(401)
  })

  it('POST /api/graphs — credentialsiz 401', async () => {
    const res = await request(app)
      .post('/api/graphs')
      .send({ title: 'Test', payload: { expressions: [], xVar: 'x', vars: {}, viewport: {} } })
    expect(res.status).toBe(401)
  })

  it('GET /api/graphs/share/:code — credentialsiz 401', async () => {
    const res = await request(app).get('/api/graphs/share/AbCdEf123')
    expect(res.status).toBe(401)
  })
})
