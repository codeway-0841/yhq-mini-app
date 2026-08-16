/**
 * Integration tests for /api/admin/questions CRUD.
 *
 * Requires real DATABASE_URL + NODE_ENV=test. Admin/oddiy user uchun HAQIQIY
 * Bearer sessiyalar yaratiladi (authRepository.createSession) — dev body/query
 * userId fallback'i olib tashlangan (audit fix), shuning uchun testlar ham
 * production'dagi kabi Authorization header bilan ishlaydi.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, questions, sessions, questionExplanations, savedQuestions } from '../../../server/schema'
import { eq } from 'drizzle-orm'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()

const ADMIN_ID = '987654321000'
const NONADMIN_ID = '987654321001'
const ADMIN_TOKEN = 'itest_admin_bearer_token_0001'
const USER_TOKEN = 'itest_user_bearer_token_0001'

/** supertest request'ga Bearer header qo'yadi */
function asAdmin(r: request.Test): request.Test {
  return r.set('Authorization', `Bearer ${ADMIN_TOKEN}`)
}
function asUser(r: request.Test): request.Test {
  return r.set('Authorization', `Bearer ${USER_TOKEN}`)
}

async function cleanup() {
  const adminUid = ADMIN_ID
  const plainUid = NONADMIN_ID
  await db.delete(sessions).where(eq(sessions.userId, adminUid))
  await db.delete(sessions).where(eq(sessions.userId, plainUid))
  await db.delete(users).where(eq(users.id, adminUid))
  await db.delete(users).where(eq(users.id, plainUid))
  // Test savollarni ham tozalash (ixtiyoriy nomlar bo'yicha)
  const allQ = await db.select({ id: questions.id, q: questions.questionUz }).from(questions)
  const testIds = allQ.filter((q) => q.q.startsWith('TEST_ADMIN_Q')).map((q) => q.id)
  if (testIds.length > 0) {
    await db.delete(savedQuestions).where(eq(savedQuestions.questionId, testIds[0]))
    await db.delete(questionExplanations).where(eq(questionExplanations.questionId, testIds[0]))
    for (const id of testIds) {
      await db.delete(savedQuestions).where(eq(savedQuestions.questionId, id))
      await db.delete(questionExplanations).where(eq(questionExplanations.questionId, id))
      await db.delete(questions).where(eq(questions.id, id))
    }
  }
}

beforeAll(async () => {
  // 2 user: admin (is_admin=true), oddiy user (is_admin=false) + sessiyalar
  await db.insert(users).values([
    { id: ADMIN_ID, firstName: 'Test', lastName: 'Admin', username: 't_admin', photoUrl: '', isAdmin: true },
    { id: NONADMIN_ID, firstName: 'Test', lastName: 'User', username: 't_user', photoUrl: '', isAdmin: false },
  ]).onConflictDoNothing()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  await authRepository.createSession({ token: ADMIN_TOKEN, userId: ADMIN_ID, provider: 'phone', expiresAt })
  await authRepository.createSession({ token: USER_TOKEN, userId: NONADMIN_ID, provider: 'phone', expiresAt })
})

afterAll(cleanup)

const VALID_QUESTION = {
  questionUz: 'TEST_ADMIN_Q: bu test savoli uz',
  questionRu: 'TEST_ADMIN_Q: это тестовый вопрос ru',
  optionsUz: { F1: 'Birinchi', F2: 'Ikkinchi', F3: 'Uchinchi' },
  optionsRu: { F1: 'Первый', F2: 'Второй', F3: 'Третий' },
  correctAnswer: 'F2',
}

describe('POST /api/admin/questions — yaratish', () => {
  it('admin user yangi savol yarata oladi (201)', async () => {
    const res = await asAdmin(request(app).post('/api/admin/questions')).send(VALID_QUESTION)
    expect(res.status).toBe(201)
    expect(res.body.id).toBeGreaterThan(0)

    // DB'da borligini tekshir
    const [row] = await db.select().from(questions).where(eq(questions.id, res.body.id))
    expect(row.questionUz).toBe(VALID_QUESTION.questionUz)
    expect(row.correctAnswer).toBe('F2')
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await asUser(request(app).post('/api/admin/questions')).send(VALID_QUESTION)
    expect(res.status).toBe(403)
  })

  it("sessiya yo'q bo'lsa 401 (Bearer'siz so'rov o'tmaydi)", async () => {
    const res = await request(app).post('/api/admin/questions').send(VALID_QUESTION)
    expect(res.status).toBe(401)
  })

  it("body/query'dagi soxta userId admin huquq bermaydi (dev-fallback o'chirilgan)", async () => {
    const res = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, userId: ADMIN_ID })
    expect(res.status).toBe(401)
  })

  it("noto'g'ri body — correctAnswer variant ichida emas → 400", async () => {
    const res = await asAdmin(request(app).post('/api/admin/questions'))
      .send({ ...VALID_QUESTION, correctAnswer: 'F99' })
    expect(res.status).toBe(400)
  })

  it('UZ/RU variant kalitlari mos kelmasa → 400', async () => {
    const res = await asAdmin(request(app).post('/api/admin/questions'))
      .send({
        ...VALID_QUESTION,
        optionsRu: { F1: 'Первый', F2: 'Второй' },
      })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/questions/:id — tahrirlash', () => {
  it('mavjud savolni tahrirlaydi', async () => {
    // Avval yaratamiz
    const create = await asAdmin(request(app).post('/api/admin/questions'))
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_PUT_DASTLABKI' })
    const qid = create.body.id

    const res = await asAdmin(request(app).put(`/api/admin/questions/${qid}`))
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_PUT_YANGI' })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(qid)

    const [row] = await db.select().from(questions).where(eq(questions.id, qid))
    expect(row.questionUz).toBe('TEST_ADMIN_Q_PUT_YANGI')
  })

  it("mavjud bo'lmagan id → 404", async () => {
    const res = await asAdmin(request(app).put('/api/admin/questions/999999999'))
      .send(VALID_QUESTION)
    expect(res.status).toBe(404)
  })

  it('relative image path qabul qiladi (images/q001.jpg — seed formati)', async () => {
    // Regression: zod .url() relative path'larni rad etardi — 146 ta rasmli
    // savolni tahrirlab bo'lmas edi
    const create = await asAdmin(request(app).post('/api/admin/questions'))
      .send({ ...VALID_QUESTION, image: 'images/q071.jpg' })
    expect(create.status).toBe(201)
    const [row] = await db.select().from(questions).where(eq(questions.id, create.body.id))
    expect(row.image).toBe('images/q071.jpg')
  })
})

describe('DELETE /api/admin/questions/:id', () => {
  it('mavjud savolni o\'chiradi (204)', async () => {
    const create = await asAdmin(request(app).post('/api/admin/questions'))
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_DELETE' })
    const qid = create.body.id

    const res = await asAdmin(request(app).delete(`/api/admin/questions/${qid}`))
    expect(res.status).toBe(204)

    const [row] = await db.select().from(questions).where(eq(questions.id, qid))
    expect(row).toBeUndefined()
  })

  it("mavjud bo'lmagan id → 404", async () => {
    const res = await asAdmin(request(app).delete('/api/admin/questions/999999999'))
    expect(res.status).toBe(404)
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await asUser(request(app).delete('/api/admin/questions/1'))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/questions/meta', () => {
  it('statistika qaytaradi', async () => {
    const res = await asAdmin(request(app).get('/api/admin/questions/meta'))
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThan(0)
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await asUser(request(app).get('/api/admin/questions/meta'))
    expect(res.status).toBe(403)
  })
})
