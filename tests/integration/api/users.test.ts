/**
 * Integration tests for /api/users endpoints.
 *
 * Requires a real DATABASE_URL in the environment (.env is loaded via tests/setup.ts).
 * Run with: npx vitest tests/integration/api/users.test.ts
 *
 * neon-http is per-request so there is no shared transaction; tests instead
 * delete inserted rows in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, progress, userSettings } from '../../../server/schema'
import { eq } from 'drizzle-orm'

const app = createApp()

const SEED_ID = '999888777666'
const SEED_USER = {
  id:         SEED_ID,
  first_name: 'Test',
  last_name:  'User',
  username:   'test_user_integration',
  photo_url:  '',
}

async function cleanup() {
  const uid = BigInt(SEED_ID)
  await db.delete(progress).where(eq(progress.userId, uid))
  await db.delete(userSettings).where(eq(userSettings.userId, uid))
  await db.delete(users).where(eq(users.id, uid))
}

describe('POST /api/init', () => {
  afterAll(cleanup)

  it('creates user, progress, settings and returns all three', async () => {
    const res = await request(app)
      .post('/api/init')
      .send(SEED_USER)
      .expect(200)

    expect(res.body).toHaveProperty('user')
    expect(res.body).toHaveProperty('progress')
    expect(res.body).toHaveProperty('settings')
    expect(res.body.user.username).toBe(SEED_USER.username)
  })

  it('is idempotent — second init returns same user', async () => {
    const res = await request(app)
      .post('/api/init')
      .send(SEED_USER)
      .expect(200)

    expect(res.body.user.id).toBe(SEED_ID)
  })

  it('rejects missing id with 400', async () => {
    const res = await request(app)
      .post('/api/init')
      .send({ first_name: 'no_id' })
      .expect(400)

    expect(res.body.error).toBe('Validation failed')
  })
})

describe('PATCH /api/users/:userId/phone', () => {
  beforeAll(async () => {
    await request(app).post('/api/init').send(SEED_USER)
  })

  afterAll(cleanup)

  it('updates phone successfully', async () => {
    const res = await request(app)
      .patch(`/api/users/${SEED_ID}/phone`)
      .send({ phone: '+998901234567' })
      .expect(200)

    expect(res.body.ok).toBe(true)
  })

  it('rejects invalid phone format', async () => {
    const res = await request(app)
      .patch(`/api/users/${SEED_ID}/phone`)
      .send({ phone: '998901234567' })   // missing leading +
      .expect(400)

    expect(res.body.error).toBe('Validation failed')
  })
})

describe('GET /api/health', () => {
  it('returns ok without auth or DB user', async () => {
    const res = await request(app).get('/api/health').expect(200)
    expect(res.body.status).toBe('ok')
  })
})
