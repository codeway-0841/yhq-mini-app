/**
 * /api/tutor/graph-analyze — anonim so'rovlar 401 (auth talab).
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('API: /api/tutor/graph-analyze auth gating', () => {
  it('credentialsiz 401', async () => {
    const res = await request(app)
      .post('/api/tutor/graph-analyze')
      .send({ image: 'data:image/png;base64,' + 'a'.repeat(100), language: 'uz' })
    expect(res.status).toBe(401)
  })
})
