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
import { users, progress, userSettings, referrals } from '../../../server/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { referralsRepository } from '../../../server/modules/users/users.repository'

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
  const uid = SEED_ID
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

/**
 * MB-5: referal mukofoti — atomik qayd + reward, bir martalik, referrer CAP.
 */
describe('Referal tizimi (MB-5)', () => {
  const REFERRER = '999000111200'
  const REF_IDS = ['999000111201', '999000111202', '999000111203']
  const ALL = [REFERRER, ...REF_IDS]

  beforeAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL))   // cascade: referrals ham
    await request(app).post('/api/init').send({
      id: REFERRER, first_name: 'Referrer', last_name: '', username: 'r_test', photo_url: '',
    }).expect(200)
  })
  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL))
  })

  it('yangi user ref_<id> bilan kirsa — referrer premium oladi (atomik)', async () => {
    const res = await request(app).post('/api/init').send({
      id: REF_IDS[0], first_name: 'Ref1', last_name: '', username: 'ref1', photo_url: '',
      start_param: `ref_${REFERRER}`,
    }).expect(200)
    expect(res.body.user.id).toBe(REF_IDS[0])

    const [r] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REFERRER))
    expect(r?.premiumUntil).not.toBeNull()
    expect(r!.premiumUntil!.getTime()).toBeGreaterThan(Date.now())
    const [cnt] = await db.select({ n: sql`COUNT(*)::int` })
      .from(referrals).where(eq(referrals.referrerId, REFERRER))
    expect(Number(cnt.n)).toBe(1)
  })

  it('mavjud user qayta init — referral takrorlanmaydi (faqat yangi user)', async () => {
    await request(app).post('/api/init').send({
      id: REF_IDS[0], first_name: 'Ref1', last_name: '', username: 'ref1', photo_url: '',
      start_param: `ref_${REFERRER}`,
    }).expect(200)
    const [cnt] = await db.select({ n: sql`COUNT(*)::int` })
      .from(referrals).where(eq(referrals.referrerId, REFERRER))
    expect(Number(cnt.n)).toBe(1)
  })

  it('ikki martalik referee qayd + reward; referrer CAP — maxRewarded dan keyin reward YO\'Q', async () => {
    // cap=2 bilan to'g'ridan-to'g'ri repo darajasida (prod konstantasi 50)
    await request(app).post('/api/init').send({ id: REF_IDS[1], first_name: 'R2', last_name: '', username: 'r2', photo_url: '' }).expect(200)
    await request(app).post('/api/init').send({ id: REF_IDS[2], first_name: 'R3', last_name: '', username: 'r3', photo_url: '' }).expect(200)

    // 1-chi (yuqoridagi API orqali bo'lgan) + 2-chi: ikkalasi reward
    const second = await referralsRepository.tryCreateWithReward(REFERRER, REF_IDS[1], 3, 2)
    expect(second).toBe(true)
    // Dublikat referee: UNIQUE conflict → qayta reward YO'Q
    const dup = await referralsRepository.tryCreateWithReward(REFERRER, REF_IDS[1], 3, 2)
    expect(dup).toBe(false)
    // 3-chi referee: cap (2) oshdi → QAYD ETILADI lekin reward YO'Q
    const third = await referralsRepository.tryCreateWithReward(REFERRER, REF_IDS[2], 3, 2)
    expect(third).toBe(false)
    const [cnt] = await db.select({ n: sql`COUNT(*)::int` })
      .from(referrals).where(eq(referrals.referrerId, REFERRER))
    expect(Number(cnt.n)).toBe(3)   // qayd bor, reward yo'q
  })
})
