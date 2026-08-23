/**
 * Integration testlar — ikkita kichik, lekin testsiz qolgan router:
 *  - GET  /api/dashboard  (public GET): subject resolve + provider statistikasi
 *  - POST /api/analytics  (KPI event): zod validatsiya + userId FAQAT auth'dan
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { desc, eq, inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, analyticsEvents } from '../../../server/schema'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()
const UID = '777000240001'
let sessionToken: string

async function cleanup() {
  await db.delete(analyticsEvents).where(eq(analyticsEvents.userId, UID))
  await db.delete(users).where(inArray(users.id, [UID]))   // cascade: sessions
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID, firstName: 'Kpi', lastName: '', username: UID, photoUrl: '' })
  sessionToken = `analytics_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await authRepository.createSession({
    token: sessionToken, userId: UID, provider: 'telegram',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
})

afterAll(cleanup)

describe('GET /api/dashboard', () => {
  it('auth\'siz ochiq (public GET) va default fanni qaytaradi', async () => {
    const res = await request(app).get('/api/dashboard')

    expect(res.status).toBe(200)
    expect(res.body.subject.id).toBe('yhq')
    expect(typeof res.body.subject.name).toBe('string')
    expect(typeof res.body.stats.totalQuestions).toBe('number')
    expect(typeof res.body.stats.totalTopics).toBe('number')
    expect(Array.isArray(res.body.availableSubjects)).toBe(true)
    expect(res.body.availableSubjects).toContain('yhq')
  })

  it('?subject= bilan so\'ralgan fanni resolve qiladi', async () => {
    const res = await request(app).get('/api/dashboard?subject=fizika')

    expect(res.status).toBe(200)
    expect(res.body.subject.id).toBe('fizika')
    expect(res.body.subject.nameRu).toBeTruthy()
  })

  it('noma\'lum fan → default fanga tushadi (500 emas)', async () => {
    const res = await request(app).get('/api/dashboard?subject=yoq-bunday-fan')

    expect(res.status).toBe(200)
    expect(res.body.subject.id).toBe('yhq')
  })
})

describe('POST /api/analytics', () => {
  it('to\'g\'ri event → 204 va DB\'ga auth\'dagi userId bilan yoziladi', async () => {
    const res = await request(app).post('/api/analytics')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ event: 'duel_started', props: { subject: 'yhq' } })

    expect(res.status).toBe(204)

    const rows = await db.select().from(analyticsEvents)
      .where(eq(analyticsEvents.userId, UID))
      .orderBy(desc(analyticsEvents.id))
      .limit(1)

    expect(rows[0]?.event).toBe('duel_started')
    expect(rows[0]?.props).toEqual({ subject: 'yhq' })
  })

  it('client yuborgan userId E\'TIBORGA OLINMAYDI — faqat sessiya egasi yoziladi', async () => {
    // Event nomi shu yurish uchun noyob (regex faqat harf/pastki chiziq beradi) —
    // parallel testlar bir xil nomni yozib qo'yishi mumkin emas
    const event = `spoof_attempt_${Math.random().toString(36).replace(/[^a-z]/g, '') || 'x'}`
    const res = await request(app).post('/api/analytics')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ event, props: {}, userId: '111111111' })

    expect(res.status).toBe(204)

    const rows = await db.select().from(analyticsEvents).where(eq(analyticsEvents.event, event))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.userId).toBe(UID)   // client yuborgan '111111111' EMAS
  })

  it('snake_case bo\'lmagan event nomi → 400', async () => {
    const res = await request(app).post('/api/analytics')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ event: 'DuelStarted' })

    expect(res.status).toBe(400)
  })

  it('4KB dan katta props → 400', async () => {
    const res = await request(app).post('/api/analytics')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ event: 'big_payload', props: { blob: 'x'.repeat(5000) } })

    expect(res.status).toBe(400)
  })
})
