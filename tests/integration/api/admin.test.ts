/**
 * Integration tests for /api/admin/questions CRUD.
 *
 * Requires real DATABASE_URL + NODE_ENV=test (auth o'chiq → userId dev-fallback
 * orqali tekshiriladi). Admin user test uchun yaratiladi va o'chiriladi.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, questions, topics, questionExplanations, savedQuestions } from '../../../server/schema'
import { eq } from 'drizzle-orm'

const app = createApp()

const ADMIN_ID = '987654321000'
const NONADMIN_ID = '987654321001'

async function cleanup() {
  const adminUid = ADMIN_ID
  const plainUid = NONADMIN_ID
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
  // 2 user: admin (is_admin=true), oddiy user (is_admin=false)
  await db.insert(users).values([
    { id: ADMIN_ID, firstName: 'Test', lastName: 'Admin', username: 't_admin', photoUrl: '', isAdmin: true },
    { id: NONADMIN_ID, firstName: 'Test', lastName: 'User', username: 't_user', photoUrl: '', isAdmin: false },
  ]).onConflictDoNothing()
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
    const res = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, userId: ADMIN_ID })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeGreaterThan(0)

    // DB'da borligini tekshir
    const [row] = await db.select().from(questions).where(eq(questions.id, res.body.id))
    expect(row.questionUz).toBe(VALID_QUESTION.questionUz)
    expect(row.correctAnswer).toBe('F2')
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, userId: NONADMIN_ID })
    expect(res.status).toBe(403)
  })

  it('userId yo\'q bo\'lsa 401 (dev-fallback)', async () => {
    const res = await request(app).post('/api/admin/questions').send(VALID_QUESTION)
    expect(res.status).toBe(401)
  })

  it("noto'g'ri body — correctAnswer variant ichida emas → 400", async () => {
    const res = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, correctAnswer: 'F99', userId: ADMIN_ID })
    expect(res.status).toBe(400)
  })

  it('UZ/RU variant kalitlari mos kelmasa → 400', async () => {
    const res = await request(app).post('/api/admin/questions')
      .send({
        ...VALID_QUESTION,
        optionsRu: { F1: 'Первый', F2: 'Второй' },
        userId: ADMIN_ID,
      })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/questions/:id — tahrirlash', () => {
  it('mavjud savolni tahrirlaydi', async () => {
    // Avval yaratamiz
    const create = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_PUT_DASTLABKI', userId: ADMIN_ID })
    const qid = create.body.id

    const res = await request(app).put(`/api/admin/questions/${qid}`)
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_PUT_YANGI', userId: ADMIN_ID })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(qid)

    const [row] = await db.select().from(questions).where(eq(questions.id, qid))
    expect(row.questionUz).toBe('TEST_ADMIN_Q_PUT_YANGI')
  })

  it("mavjud bo'lmagan id → 404", async () => {
    const res = await request(app).put('/api/admin/questions/999999999')
      .send({ ...VALID_QUESTION, userId: ADMIN_ID })
    expect(res.status).toBe(404)
  })

  it('relative image path qabul qiladi (images/q001.jpg — seed formati)', async () => {
    // Regression: zod .url() relative path'larni rad etardi — 146 ta rasmli
    // savolni tahrirlab bo'lmas edi
    const create = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, image: 'images/q071.jpg', userId: ADMIN_ID })
    expect(create.status).toBe(201)
    const [row] = await db.select().from(questions).where(eq(questions.id, create.body.id))
    expect(row.image).toBe('images/q071.jpg')
  })
})

describe('DELETE /api/admin/questions/:id', () => {
  it('mavjud savolni o\'chiradi (204)', async () => {
    const create = await request(app).post('/api/admin/questions')
      .send({ ...VALID_QUESTION, questionUz: 'TEST_ADMIN_Q_DELETE', userId: ADMIN_ID })
    const qid = create.body.id

    const res = await request(app).delete(`/api/admin/questions/${qid}?userId=${ADMIN_ID}`)
    expect(res.status).toBe(204)

    const [row] = await db.select().from(questions).where(eq(questions.id, qid))
    expect(row).toBeUndefined()
  })

  it("mavjud bo'lmagan id → 404", async () => {
    const res = await request(app).delete(`/api/admin/questions/999999999?userId=${ADMIN_ID}`)
    expect(res.status).toBe(404)
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await request(app).delete(`/api/admin/questions/1?userId=${NONADMIN_ID}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/questions/meta', () => {
  it('statistika qaytaradi', async () => {
    const res = await request(app).get('/api/admin/questions/meta?userId=' + ADMIN_ID)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThan(0)
  })

  it('non-admin 403 qaytaradi', async () => {
    const res = await request(app).get('/api/admin/questions/meta?userId=' + NONADMIN_ID)
    expect(res.status).toBe(403)
  })
})
