/**
 * Integration tests for GET /api/questions/:questionId/explanation.
 *
 * Requires a real DATABASE_URL (.env) — Neon DB. The explanations table
 * is seeded via `npm run db:seed:explanations`.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { questions } from '../../../server/schema'

const app = createApp()

describe('GET /api/questions/:questionId/explanation', () => {
  it('uz tilda statik tushuntirish qaytaradi', async () => {
    const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
    expect(q).toBeDefined()

    const res = await request(app).get(`/api/questions/${q.id}/explanation?lang=uz`)
    expect(res.status).toBe(200)
    expect(res.body.questionId).toBe(q.id)
    expect(res.body.text).toBeTruthy()
    expect(typeof res.body.text).toBe('string')
    // Post-answer gate (audit H-4): izoh endi PUBLIC CDN-cache EMAS —
    // per-user 'private, no-store' (prod'da faqat javob bergan user'ga).
    expect(res.headers['cache-control']).toContain('private, no-store')
  })

  it('ru tilda statik tushuntirish qaytaradi', async () => {
    const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
    const res = await request(app).get(`/api/questions/${q.id}/explanation?lang=ru`)
    expect(res.status).toBe(200)
    expect(res.body.text).toBeTruthy()
  })

  it('lang default uz', async () => {
    const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
    const res = await request(app).get(`/api/questions/${q.id}/explanation`)
    expect(res.status).toBe(200)
  })

  it("mavjud bo'lmagan savol → 404", async () => {
    const res = await request(app).get('/api/questions/999999999/explanation')
    expect(res.status).toBe(404)
  })

  it("noto'g'ri questionId → 400", async () => {
    const res = await request(app).get('/api/questions/abc/explanation')
    expect(res.status).toBe(400)
  })

  it("noto'g'ri lang → 400", async () => {
    const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
    const res = await request(app).get(`/api/questions/${q.id}/explanation?lang=en`)
    expect(res.status).toBe(400)
  })
})
