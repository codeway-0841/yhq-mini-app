/**
 * Integration testlar — uchta kichik, lekin end-to-end tekshirilmagan router:
 *   GET/POST/DELETE /api/saved/:userId      (saqlangan savollar)
 *   PATCH           /api/settings/:userId   (foydalanuvchi sozlamalari)
 *   GET             /api/achievements/:userId (yutuq metrikalari)
 *
 * Avval faqat router unit testlari bor edi (mock repository bilan) — bu yerda
 * haqiqiy DB bilan yozuv/o'qish va auth chegaralari tekshiriladi.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { eq, inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import {
  users, sessions, userSettings, progress, savedQuestions, dailyRecords, dailyStreaks, questions,
} from '../../../server/schema'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'

const app = createApp()

const UID   = '777000250001'
const OTHER = '777000250002'
const TOKEN = 'itest_saved_settings_0001'
const OTHER_TOKEN = 'itest_saved_settings_0002'
const IDS = [UID, OTHER]

let questionId: number

const asUser  = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`)
const asOther = (r: request.Test) => r.set('Authorization', `Bearer ${OTHER_TOKEN}`)

async function cleanup() {
  await db.delete(savedQuestions).where(inArray(savedQuestions.userId, IDS))
  await db.delete(dailyRecords).where(inArray(dailyRecords.userId, IDS))
  await db.delete(dailyStreaks).where(inArray(dailyStreaks.userId, IDS))
  await db.delete(sessions).where(inArray(sessions.userId, IDS))
  await db.delete(users).where(inArray(users.id, IDS))   // cascade: progress, settings
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID,   firstName: 'Saved', lastName: 'One', username: '', photoUrl: '' })
  await usersRepository.initAtomic({ id: OTHER, firstName: 'Saved', lastName: 'Two', username: '', photoUrl: '' })

  const expiresAt = new Date(Date.now() + 3_600_000)
  await authRepository.createSession({ token: TOKEN,       userId: UID,   provider: 'phone', expiresAt })
  await authRepository.createSession({ token: OTHER_TOKEN, userId: OTHER, provider: 'phone', expiresAt })

  // Mavjud savollardan birini olamiz (saved FK savollar jadvaliga bog'langan)
  const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
  if (!q) throw new Error('Test DB da savol yo\'q — avval npm run db:seed')
  questionId = q.id

  // Yutuq metrikalari uchun boshlang'ich holat
  // chk_progress_sum: total_answered = total_correct + total_wrong
  await db.update(progress)
    .set({ totalCorrect: 42, totalWrong: 8, totalAnswered: 50, octagonWins: 3 })
    .where(eq(progress.userId, UID))
  await db.insert(dailyRecords).values({
    userId: UID, date: '2026-01-05', subjectId: 'yhq', answered: 25, correct: 21, fixed: 4,
  })
  await db.insert(dailyStreaks).values({
    userId: UID, subjectId: 'yhq', streak: 7, lastDailyDate: '2026-01-05',
  }).onConflictDoNothing()
})

afterAll(cleanup)

// Eslatma: global telegramAuth va requireSelf FAQAT productionda majburiy
// (isAuthEnforced → config.isProd), test muhitida ular no-op. Shuning uchun bu
// yerda auth gating emas, funksional xulq tekshiriladi — gating uchun
// tests/unit/middleware/auth-*.test.ts.

describe('/api/saved/:userId', () => {
  it('POST saqlaydi, GET ro\'yxatda qaytaradi, DELETE o\'chiradi', async () => {
    const empty = await asUser(request(app).get(`/api/saved/${UID}`))
    expect(empty.status).toBe(200)
    expect(empty.body).toEqual([])

    const add = await asUser(request(app).post(`/api/saved/${UID}`)).send({ questionId, subjectId: 'yhq' })
    expect(add.status).toBe(200)
    expect(add.body).toEqual({ ok: true })

    const list = await asUser(request(app).get(`/api/saved/${UID}`))
    expect(list.status).toBe(200)
    expect(list.body.length).toBe(1)

    const del = await asUser(request(app).delete(`/api/saved/${UID}/${questionId}?subject=yhq`))
    expect(del.status).toBe(200)

    const after = await asUser(request(app).get(`/api/saved/${UID}`))
    expect(after.body).toEqual([])
  })

  it('bir xil savolni ikki marta saqlash — dublikat yaratmaydi', async () => {
    await asUser(request(app).post(`/api/saved/${UID}`)).send({ questionId, subjectId: 'yhq' })
    await asUser(request(app).post(`/api/saved/${UID}`)).send({ questionId, subjectId: 'yhq' })

    const list = await asUser(request(app).get(`/api/saved/${UID}`))
    expect(list.body.length).toBe(1)

    await asUser(request(app).delete(`/api/saved/${UID}/${questionId}?subject=yhq`))
  })

  it('yaroqsiz payload → 400 (manfiy id, noma\'lum fan)', async () => {
    const negative = await asUser(request(app).post(`/api/saved/${UID}`)).send({ questionId: -5, subjectId: 'yhq' })
    expect(negative.status).toBe(400)

    const badSubject = await asUser(request(app).post(`/api/saved/${UID}`)).send({ questionId, subjectId: 'yoq-fan' })
    expect(badSubject.status).toBe(400)
  })
})

describe('PATCH /api/settings/:userId', () => {
  it('sozlamani yangilaydi va DB\'da saqlanadi', async () => {
    const res = await asUser(request(app).patch(`/api/settings/${UID}`))
      .send({ theme: 'dark', fontSize: 'large', language: 'ru' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, UID))
    expect(row?.theme).toBe('dark')
    expect(row?.fontSize).toBe('large')
    expect(row?.language).toBe('ru')
  })

  it('bo\'sh yoki noma\'lum qiymatli patch → 400', async () => {
    const empty = await asUser(request(app).patch(`/api/settings/${UID}`)).send({})
    expect(empty.status).toBe(400)

    const bad = await asUser(request(app).patch(`/api/settings/${UID}`)).send({ theme: 'neon' })
    expect(bad.status).toBe(400)
  })
})

describe('GET /api/achievements/:userId', () => {
  it('progress, streak, fixed va fan kesimidagi aniqlikni yig\'ib beradi', async () => {
    const res = await asUser(request(app).get(`/api/achievements/${UID}`))

    expect(res.status).toBe(200)
    expect(res.body.stats).toMatchObject({
      totalCorrect:  42,
      totalAnswered: 50,
      octagonWins:   3,
      bestStreak:    7,
      totalFixed:    4,
    })

    const yhq = res.body.stats.subjectAccuracy.find((s: { subjectId: string }) => s.subjectId === 'yhq')
    expect(yhq).toMatchObject({ answered: 25, accuracy: 84 })   // 21/25
    // Faqat bitta fandan natija bor — "barcha fanlardan 80%+" bajarilmaydi
    expect(res.body.stats.allPassed80).toBe(false)
  })

  it('yozuvsiz foydalanuvchi uchun nol metrikalar (500 emas)', async () => {
    const res = await asOther(request(app).get(`/api/achievements/${OTHER}`))

    expect(res.status).toBe(200)
    expect(res.body.stats).toMatchObject({
      totalCorrect: 0, totalAnswered: 0, octagonWins: 0, bestStreak: 0, totalFixed: 0,
    })
    expect(res.body.stats.subjectAccuracy).toEqual([])
  })
})
