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
import { users, progress, userSettings, referrals, questions } from '../../../server/schema'
import { eq, inArray, sql } from 'drizzle-orm'

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
 * MB-5 (v3): referal — SPLIT mukofot + TELEFON TRIGGER.
 * Referee: WELCOME sovg'a (+3 kun) ro'yxatdan o'tganda DARHOL (yangi o'quvchi
 * test yechishga majbur emas). Referrer: referee TELEFONINI ULAGANDA
 * (updatePhone → rewardIfPhoneLinked — atomik CTE, anti-farming + marketing:
 * verified raqam). Savol yechish mukofot BERMAYDI (regression bilan qat'iy).
 */
describe('Referal tizimi (MB-5, v3 — split mukofot + telefon trigger)', () => {
  const REFERRER = '999000111200'
  const REF_IDS = ['999000111201', '999000111202']
  const P_REFERRER = 'p_999000111299'
  const ALL = [REFERRER, ...REF_IDS, P_REFERRER]

  beforeAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL))   // cascade: referrals ham
    await request(app).post('/api/init').send({
      id: REFERRER, first_name: 'Referrer', last_name: '', username: 'r_test', photo_url: '',
    }).expect(200)
    // p_ (telefon akkaunt) referrer — bevosita DB insert (register flow'ni test qilmaymiz)
    await db.insert(users).values({
      id: P_REFERRER, firstName: 'Phone', lastName: 'Referrer', username: 'p_ref', photoUrl: '',
    }).onConflictDoNothing()
  })
  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, ALL))
  })

  it("yangi user ref_<id> bilan kirsa — PENDING qayd + WELCOME sovg'a referee'ga DARHOL, referrerga YO'Q", async () => {
    await request(app).post('/api/init').send({
      id: REF_IDS[0], first_name: 'Ref1', last_name: '', username: 'ref1', photo_url: '',
      start_param: `ref_${REFERRER}`,
    }).expect(200)

    const [r] = await db.select().from(referrals).where(eq(referrals.referrerId, REFERRER))
    expect(r?.status).toBe('pending')
    // Yangi o'quvchi test yechishga majbur EMAS — sovg'asi ro'yxatdan o'tishdayoq
    const [referee] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REF_IDS[0]))
    expect(referee?.premiumUntil).not.toBeNull()
    expect(referee!.premiumUntil!.getTime()).toBeGreaterThan(Date.now())
    // Referrer mukofoti hali YO'Q (telefon ulash kutilmoqda)
    const [referrer] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REFERRER))
    expect(referrer?.premiumUntil).toBeNull()
  })

  it("mavjud user qayta init — referral takrorlanmaydi (faqat yangi user)", async () => {
    await request(app).post('/api/init').send({
      id: REF_IDS[0], first_name: 'Ref1', last_name: '', username: 'ref1', photo_url: '',
      start_param: `ref_${REFERRER}`,
    }).expect(200)
    const [cnt] = await db.select({ n: sql`COUNT(*)::int` })
      .from(referrals).where(eq(referrals.referrerId, REFERRER))
    expect(Number(cnt.n)).toBe(1)
  })

  it("o'z-o'zini referal qilish qayd etilmaydi", async () => {
    await request(app).post('/api/init').send({
      id: '999000111203', first_name: 'Self', last_name: '', username: 'selfref', photo_url: '',
      start_param: 'ref_999000111203',
    }).expect(200)
    const rows = await db.select().from(referrals).where(eq(referrals.refereeId, '999000111203'))
    expect(rows).toHaveLength(0)
    await db.delete(users).where(eq(users.id, '999000111203'))
  })

  it("p_ (telefon) referrer havolasi endi QAYD ETILADI (regex fix)", async () => {
    await request(app).post('/api/init').send({
      id: REF_IDS[1], first_name: 'Ref2', last_name: '', username: 'ref2', photo_url: '',
      start_param: `ref_${P_REFERRER}`,
    }).expect(200)
    const rows = await db.select().from(referrals).where(eq(referrals.referrerId, P_REFERRER))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })

  it("savol yechish mukofot BERMAYDI (trigger faqat telefon ulash)", async () => {
    const qs = await db.select({ id: questions.id }).from(questions).limit(3)
    for (let i = 0; i < qs.length; i++) {
      await request(app)
        .post(`/api/progress/${REF_IDS[0]}/result`)
        .send({ questionId: qs[i].id, selectedAnswer: null, subjectId: 'yhq', clientToken: `nov3-trigger-${i}` })
        .expect(200)
    }
    const [r] = await db.select().from(referrals).where(eq(referrals.refereeId, REF_IDS[0]))
    expect(r?.status).toBe('pending')
    const [referrer] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REFERRER))
    expect(referrer?.premiumUntil).toBeNull()
  })

  it("referee TELEFON ULADI — referrer mukofoti; referee qayta mukofotlanmaydi; raqam almashuvi qayta mukofot bermaydi", async () => {
    // Referee welcome premium'i (init'da olgan) — keyin solishtiramiz
    const [referee0] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REF_IDS[0]))
    const refereeWelcomeUntil = referee0!.premiumUntil!.getTime()

    await request(app)
      .patch(`/api/users/${REF_IDS[0]}/phone`)
      .send({ phone: '+998901234567' })
      .expect(200)

    let [r] = await db.select().from(referrals).where(eq(referrals.refereeId, REF_IDS[0]))
    expect(r?.status).toBe('rewarded')
    expect(r?.rewardedAt).not.toBeNull()

    // Referrer mukofoti
    const [referrer] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REFERRER))
    expect(referrer!.premiumUntil).not.toBeNull()
    expect(referrer!.premiumUntil!.getTime()).toBeGreaterThan(Date.now())

    // Referee welcome'dan keyin QO'SHIMCHA mukofot OLMADI (split — faqat referrer)
    const [referee1] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REF_IDS[0]))
    expect(referee1!.premiumUntil!.getTime()).toBe(refereeWelcomeUntil)

    const referrerAfter = referrer!.premiumUntil!.getTime()

    // Raqamni almashtirish — qayta mukofot YO'Q (status rewarded)
    await request(app)
      .patch(`/api/users/${REF_IDS[0]}/phone`)
      .send({ phone: '+998909876543' })
      .expect(200)
    ;[r] = await db.select().from(referrals).where(eq(referrals.refereeId, REF_IDS[0]))
    expect(r?.status).toBe('rewarded')
    const [referrer2] = await db.select({ premiumUntil: users.premiumUntil }).from(users).where(eq(users.id, REFERRER))
    expect(referrer2!.premiumUntil!.getTime()).toBe(referrerAfter)
  })

  it('GET /api/referrals/:userId — statistika (invited/rewarded/pending)', async () => {
    const res = await request(app).get(`/api/referrals/${REFERRER}`).expect(200)
    expect(res.body.invited).toBe(1)
    expect(res.body.rewarded).toBe(1)
    expect(res.body.pending).toBe(0)
    expect(res.body.rewardDays).toBe(3)
    expect(res.body.cap).toBe(50)
  })
})
