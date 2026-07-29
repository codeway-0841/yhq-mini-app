/**
 * Integration tests for /api/users endpoints.
 *
 * Requires a real DATABASE_URL in the environment (uses test DB or a transaction rollback).
 * Run with: DATABASE_URL=... npx vitest tests/integration/api/users.test.ts
 *
 * Each test suite rolls back via a transaction wrapping the test:
 *   - beforeAll: BEGIN
 *   - afterAll:  ROLLBACK
 * The db connection inside the app under test must share the same connection for
 * rollback to work; with neon-http that is per-request so tests instead just
 * delete inserted rows in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, userProgress, userSettings } from '../../../server/schema'
import { eq } from 'drizzle-orm'

const app = createApp()

const SEED_USER = {
  telegramId: BigInt('999888777666'),
  username:   'test_user_integration',
  firstName:  'Test',
  lastName:   'User',
  photoUrl:   null,
  lang:       'uz' as const,
}

describe('POST /api/users/init', () => {
  afterAll(async () => {
    // Clean up test rows
    await db.delete(userProgress).where(eq(userProgress.userId, SEED_USER.telegramId))
    await db.delete(userSettings).where(eq(userSettings.userId, SEED_USER.telegramId))
    await db.delete(users).where(eq(users.id, SEED_USER.telegramId))
  })

  it('creates user, progress, settings and returns all three', async () => {
    const res = await request(app)
      .post('/api/users/init')
      .send({ ...SEED_USER, telegramId: SEED_USER.telegramId.toString() })
      .expect(200)

    expect(res.body).toHaveProperty('user')
    expect(res.body).toHaveProperty('progress')
    expect(res.body).toHaveProperty('settings')
    expect(res.body.user.username).toBe(SEED_USER.username)
  })

  it('is idempotent — second init returns same user', async () => {
    const res = await request(app)
      .post('/api/users/init')
      .send({ ...SEED_USER, telegramId: SEED_USER.telegramId.toString() })
      .expect(200)

    expect(res.body.user.id).toBe(SEED_USER.telegramId.toString())
  })

  it('rejects missing telegramId with 400', async () => {
    const res = await request(app)
      .post('/api/users/init')
      .send({ username: 'no_id' })
      .expect(400)

    expect(res.body.error).toBe('Validation failed')
  })
})

describe('PATCH /api/users/:userId/phone', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/users/init')
      .send({ ...SEED_USER, telegramId: SEED_USER.telegramId.toString() })
  })

  afterAll(async () => {
    await db.delete(userProgress).where(eq(userProgress.userId, SEED_USER.telegramId))
    await db.delete(userSettings).where(eq(userSettings.userId, SEED_USER.telegramId))
    await db.delete(users).where(eq(users.id, SEED_USER.telegramId))
  })

  it('updates phone successfully', async () => {
    const res = await request(app)
      .patch(`/api/users/${SEED_USER.telegramId}/phone`)
      .send({ phone: '+998901234567' })
      .expect(200)

    expect(res.body.ok).toBe(true)
  })

  it('rejects invalid phone format', async () => {
    const res = await request(app)
      .patch(`/api/users/${SEED_USER.telegramId}/phone`)
      .send({ phone: '998901234567' })   // missing leading +
      .expect(400)

    expect(res.body.error).toBe('Validation failed')
  })
})
