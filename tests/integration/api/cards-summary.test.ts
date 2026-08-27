/**
 * Integration test — GET /api/progress/:userId/cards/summary (FIXPLAN #46).
 *
 * SR dashboard aggregate: total / dueNow / dueNext24h / dueNext7d chegaralari
 * real Postgres `now()` + FILTER orqali tekshiriladi.
 *
 * DETERMINISTIK: test o'z bank + 4 savolini yaratadi (CI DB minimal seeded —
 * traffic_rules_db'da 4 savol bo'lmasligi mumkin). FK zanjiri:
 * question_banks → questions → card_progress (cascade).
 *
 * Requires real DATABASE_URL (tests/setup.ts .env yuklaydi).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { cardProgress, questionBanks, questions, users } from '../../../server/schema'
import { eq, inArray } from 'drizzle-orm'
import { usersRepository } from '../../../server/modules/users/users.repository'

const app = createApp()
const UID = '777000111001'
const EMPTY_UID = '777000111002'
const SUBJECT = 'yhq'
const OTHER_SUBJECT = 'rustili' // SUBJECT_IDS ro'yxatidagi haqiqiy subject (subjects test sinxronli)
const BANK = 'srsummary_test_bank'
const EXT_IDS = ['sr_summary_1', 'sr_summary_2', 'sr_summary_3', 'sr_summary_4']

async function cleanup() {
  await db.delete(cardProgress).where(eq(cardProgress.userId, UID))
  await db.delete(users).where(inArray(users.id, [UID, EMPTY_UID]))
  await db.delete(questions).where(inArray(questions.externalId, EXT_IDS)) // cascade: card_progress
  await db.delete(questionBanks).where(eq(questionBanks.id, BANK))
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID, firstName: 'SR', lastName: 'T', username: UID, photoUrl: '' })

  // Deterministik fixture: o'z bank + 4 savol (CI seed holatidan mustaqil).
  // questions.id SERIAL EMAS — qat'iy yuqori id'lar (security-critical pattern):
  // mavjud real savollar ~minglab id'da, 888_111_xxx boshqa testlarniki (999111)
  // bilan to'qnashmaydi.
  await db.insert(questionBanks).values({ id: BANK, name: 'SR summary test bank' })
  const inserted = await db.insert(questions).values(
    EXT_IDS.map((externalId, i) => ({
      id: 888_111_001 + i,
      bankId: BANK,
      externalId,
      questionUz: 'SR summary test savol',
      questionRu: 'SR summary test vopros',
      optionsUz: { A: 'a', B: 'b' },
      optionsRu: { A: 'a', B: 'b' },
      correctAnswer: 'A',
    })),
  ).returning({ id: questions.id })
  expect(inserted.length).toBe(4)
  const [qa, qb, qc, qd] = inserted.map((r) => r.id)

  const now = Date.now()
  await db.insert(cardProgress).values([
    { userId: UID, subjectId: SUBJECT, questionId: qa, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now - 60_000) },          // due NOW
    { userId: UID, subjectId: SUBJECT, questionId: qb, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 12 * 3_600_000) }, // +12h → 24h oyna
    { userId: UID, subjectId: SUBJECT, questionId: qc, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 3 * 86_400_000) }, // +3d → 7d oyna
    { userId: UID, subjectId: SUBJECT, questionId: qd, ef: 2.5, interval: 1, reps: 1, dueAt: new Date(now + 30 * 86_400_000) }, // +30d → hech qaysi oyna
  ])
})

afterAll(cleanup)

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
    await usersRepository.initAtomic({ id: EMPTY_UID, firstName: 'E', lastName: '', username: EMPTY_UID, photoUrl: '' })
    const res = await request(app).get(`/api/progress/${EMPTY_UID}/cards/summary?subjectId=${SUBJECT}`)
    expect(res.status).toBe(200)
    expect(res.body.summary).toMatchObject({ total: 0, dueNow: 0, dueNext24h: 0, dueNext7d: 0 })
    await db.delete(users).where(eq(users.id, EMPTY_UID))
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
