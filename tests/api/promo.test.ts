import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../server/app'

const app = createApp()

describe('Promo API Endpoints', () => {
  it('POST /api/promo/redeem rejects invalid payload with 400', async () => {
    const res = await request(app).post('/api/promo/redeem').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('POST /api/promo/redeem without user authentication returns 401', async () => {
    const res = await request(app).post('/api/promo/redeem').send({ code: 'DISCOUNT50' })
    expect(res.status).toBe(401)
  })

  it('GET /api/admin/promo-codes (anonim so‘rov) -> 401 (telegram_user_not_identified)', async () => {
    const res = await request(app).get('/api/admin/promo-codes')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'telegram_user_not_identified' })
  })

  it('GET /api/admin/promo-codes (oddiy foydalanuvchi so‘rovi) -> 403 (admin_required)', async () => {
    const res = await request(app).get('/api/admin/promo-codes?userId=regular_user_999')
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'admin_required' })
  })
})
