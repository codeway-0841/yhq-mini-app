/**
 * Integration test — GET /api/progress/:userId/cards/summary (FIXPLAN #46).
 *
 * SR dashboard aggregate: total / dueNow / dueNext24h / dueNext7d chegaralari
 * real Postgres `now()` + FILTER orqali tekshiriladi.
 *
 * Requires real DATABASE_URL (tests/setup.ts .env yuklaydi).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { cardProgress, questions, users } from '../../../server/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { usersRepository } from '../../../server/modules/users/users.repository'

const app = createApp()
const UID = '777000111001'
const SUBJECT = 'yhq'
const OTHER_SUBJECT = 'rustili' // SUBJECT_IDS ro'yxatidagi haqiqiy subject (subjects test sinxronli)

const BANK = 'traffic_rules_db' // subjectId 'yhq' → dataSourceId (shared/subjects.ts)

async function cleanup() {
  await db.delete(cardProgress).where(eq(cardProgress.userId, UID))
  await db.delete(users).where(eq(users.id, UID)) // cascade: progress/qoldiqlar
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID, firstName: 'SR', lastName: 'T', username: UID, photoUrl: '' })

  const now = Date.now()
  // Har karta alohida question kerak (unique user+subject+question) → turli savollar
  const qs = await db.select({ id: questions.id }).from(questions)
    .where(sql`${questions.bankId} = ${BANK}`).limit(4)
  expect(qs.length).toBe(4)
  const [qa, qb, qc, qd] = qs.map((r) => r.id)
  await db.insert(cardProgress).values([
    { userId: UID, subjectId: SUBJECT, questionId: qa, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now - 60_000) },          // due NOW
    { userId: UID, subjectId: SUBJECT, questionId: qb, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 12 * 3_600_000) }, // +12h → 24h oyna
    { userId: UID, subjectId: SUBJECT, questionId: qc, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 3 * 86_400_000) }, // +3d → 7d oyna
    { userId: UID, subjectId: SUBJECT, questionId: qd, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 30 * 86_400_000) }, // +30d → hech qaysi oyna
  ])
})

afterAll(async () => { await cleanup(); await db.delete(cardProgress).where(inArray(cardProgress.userId, [UID])) })

describe('GET /api/progress/:userId/cards/summary (#46)', () => {
  it('aggregate chegaralar to\'g\'ri: total=4, dueNow=1, dueNext24h=1, dueNext7d=1', async () => {
    const res = await request(app).get(`/api/progress/${UID}/cards/summary?subjectId=${SUBJECT}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.summary.total).toBe(4)
    expect(res.body.summary.dueNow).toBe(1)
    expect(res.body.summary.dueNext24h).toBe(1)
    expect(res.body.summary.dueNext7d).toBe(1)
    expect(res.body.summary.avgEf).toBeCloseTo(2.5, 1)
  })

  it('kartasiz user → nol summary (xato emas)', async () => {
    const EMPTY = '777000111002'
    await usersRepository.initAtomic({ id: EMPTY, firstName: 'E', lastName: '', username: EMPTY, photoUrl: '' })
    const res = await request(app).get(`/api/progress/${EMPTY}/cards/summary?subjectId=${SUBJECT}`)
    expect(res.status).toBe(200)
    expect(res.body.summary).toMatchObject({ total: 0, dueNow: 0, dueNext24h: 0, dueNext7d: 0 })
    await db.delete(users).where(eq(users.id, EMPTY))
  })

  it('noma\'lum subjectId → 400 (zod)', async () => {
    const res = await request(app).get(`/api/progress/${UID}/cards/summary?subjectId=no_such_subject`)
    expect(res.status).toBe(400)
  })

  it('boshqa subject kartalari aralashmaydi', async () => {
    const res = await request(app).get(`/api/progress/${UID}/cards/summary?subjectId=${OTHER_SUBJECT}`)
    expect(res.status).toBe(200)
    expect(res.body.summary.total).toBe(0)
  })
})
