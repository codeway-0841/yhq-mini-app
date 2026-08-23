/**
 * Integration test — eski (bir martalik) ommaviy xabarnoma: POST /api/admin/broadcast
 * va POST /api/admin/broadcast/preview-count.
 *
 * Chunked kampaniya tizimi (tg_broadcasts) alohida testda; bu yerda admin
 * gating, testTelegramId yo'li, rasm/matn tanlovi va Telegram xatolarining
 * blocked/failed tasnifi tekshiriladi. Grammy mock — real Telegramga chiqmaymiz.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const { mockSendMessage, mockSendPhoto } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockSendPhoto: vi.fn(),
}))
vi.mock('grammy', () => ({
  Bot: class MockBot { api = { sendMessage: mockSendMessage, sendPhoto: mockSendPhoto } },
  InputFile: class InputFile {
    constructor(public data: unknown, public name?: string) {}
  },
  InlineKeyboard: class InlineKeyboard {
    rows: unknown[] = []
    url(text: string, u: string) { this.rows.push({ text, url: u }); return this }
    webApp(text: string, u: string) { this.rows.push({ text, webApp: u }); return this }
  },
}))

import request from 'supertest'
import { inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, sessions } from '../../../server/schema'
import { config } from '../../../server/config'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()

const ADMIN_ID = '987654322000'
const USER_ID  = '987654322001'
const ADMIN_TOKEN = 'itest_bcast_admin_0001'
const USER_TOKEN  = 'itest_bcast_user_0001'
const TEST_TG_ID = 555000111
const ORIGINAL_BOT_TOKEN = config.telegram.botToken

const payload = { target: 'all' as const, text: 'Test xabarnoma matni' }

async function cleanup() {
  await db.delete(sessions).where(inArray(sessions.userId, [ADMIN_ID, USER_ID]))
  await db.delete(users).where(inArray(users.id, [ADMIN_ID, USER_ID]))
}

beforeAll(async () => {
  await cleanup()
  await db.insert(users).values([
    { id: ADMIN_ID, firstName: 'Bcast', lastName: 'Admin', username: 'b_admin', photoUrl: '', isAdmin: true },
    { id: USER_ID,  firstName: 'Bcast', lastName: 'User',  username: 'b_user',  photoUrl: '', isAdmin: false },
  ]).onConflictDoNothing()
  const expiresAt = new Date(Date.now() + 3_600_000)
  await authRepository.createSession({ token: ADMIN_TOKEN, userId: ADMIN_ID, provider: 'phone', expiresAt })
  await authRepository.createSession({ token: USER_TOKEN,  userId: USER_ID,  provider: 'phone', expiresAt })
})

beforeEach(() => {
  mockSendMessage.mockReset()
  mockSendPhoto.mockReset()
  mockSendMessage.mockResolvedValue({})
  mockSendPhoto.mockResolvedValue({ photo: [{ file_id: 'cached_file_id' }] })
  config.telegram.botToken = 'test-bot-token'
})

afterAll(async () => {
  config.telegram.botToken = ORIGINAL_BOT_TOKEN
  await cleanup()
})

const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${ADMIN_TOKEN}`)

describe('POST /api/admin/broadcast — gating', () => {
  it('auth\'siz → 401, oddiy user → 403, hech narsa yuborilmaydi', async () => {
    const anon = await request(app).post('/api/admin/broadcast').send({ ...payload, testTelegramId: TEST_TG_ID })
    expect(anon.status).toBe(401)

    const plain = await request(app).post('/api/admin/broadcast')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ ...payload, testTelegramId: TEST_TG_ID })
    expect(plain.status).toBe(403)

    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('yaroqsiz payload → 400 (zod), yuborilmaydi', async () => {
    const res = await asAdmin(request(app).post('/api/admin/broadcast'))
      .send({ target: 'all', text: 'a' })

    expect(res.status).toBe(400)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/broadcast — yuborish', () => {
  it('testTelegramId berilsa FAQAT o\'sha chatga matn yuboriladi', async () => {
    const res = await asAdmin(request(app).post('/api/admin/broadcast'))
      .send({ ...payload, testTelegramId: TEST_TG_ID })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, sent: 1, blocked: 0, failed: 0 })
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text] = mockSendMessage.mock.calls[0]!
    expect(chatId).toBe(TEST_TG_ID)
    expect(text).toBe(payload.text)
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('base64 rasm berilsa sendPhoto (caption = matn) ishlatiladi', async () => {
    const res = await asAdmin(request(app).post('/api/admin/broadcast'))
      .send({
        ...payload,
        testTelegramId: TEST_TG_ID,
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
      })

    expect(res.status).toBe(200)
    expect(res.body.sent).toBe(1)
    expect(mockSendPhoto).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).not.toHaveBeenCalled()
    const [chatId, , opts] = mockSendPhoto.mock.calls[0]!
    expect(chatId).toBe(TEST_TG_ID)
    expect(opts.caption).toBe(payload.text)
  })

  it('tashqi imageUrl to\'g\'ridan-to\'g\'ri sendPhoto\'ga uzatiladi', async () => {
    const imageUrl = 'https://cdn.example.com/banner.jpg'
    const res = await asAdmin(request(app).post('/api/admin/broadcast'))
      .send({ ...payload, testTelegramId: TEST_TG_ID, imageUrl })

    expect(res.status).toBe(200)
    expect(res.body.sent).toBe(1)
    expect(mockSendPhoto).toHaveBeenCalledTimes(1)
    expect(mockSendPhoto.mock.calls[0]![1]).toBe(imageUrl)
  })

  it('yetib bo\'lmaydigan chat → blocked hisobi (failed EMAS)', async () => {
    for (const description of [
      'Forbidden: bot was blocked by the user',
      'Bad Request: chat not found',
      'Forbidden: user is deactivated',
    ]) {
      mockSendMessage.mockReset()
      mockSendMessage.mockRejectedValueOnce(Object.assign(new Error('x'), { description }))
      const res = await asAdmin(request(app).post('/api/admin/broadcast'))
        .send({ ...payload, testTelegramId: TEST_TG_ID })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ sent: 0, blocked: 1, failed: 0 })
    }
  })

  it('boshqa Telegram xatosi → failed hisobi', async () => {
    mockSendMessage.mockRejectedValueOnce(Object.assign(new Error('x'), {
      description: 'Bad Request: message text is empty',
    }))
    const res = await asAdmin(request(app).post('/api/admin/broadcast'))
      .send({ ...payload, testTelegramId: TEST_TG_ID })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ sent: 0, blocked: 0, failed: 1 })
  })
})

describe('POST /api/admin/broadcast/preview-count', () => {
  it('segment bo\'yicha auditoriya sonini qaytaradi (premium ⊆ all)', async () => {
    const all = await asAdmin(request(app).post('/api/admin/broadcast/preview-count')).send({ target: 'all' })
    const premium = await asAdmin(request(app).post('/api/admin/broadcast/preview-count')).send({ target: 'premium' })

    expect(all.status).toBe(200)
    expect(all.body.target).toBe('all')
    expect(Number.isInteger(all.body.count)).toBe(true)
    expect(all.body.count).toBeGreaterThan(0)          // seed qilingan adminning o'zi ham raqam-id
    expect(premium.body.count).toBeLessThanOrEqual(all.body.count)
  })

  it('oddiy user preview-count\'ga kira olmaydi (403), auth\'siz — 401', async () => {
    const plain = await request(app).post('/api/admin/broadcast/preview-count')
      .set('Authorization', `Bearer ${USER_TOKEN}`).send({ target: 'all' })
    expect(plain.status).toBe(403)

    const anon = await request(app).post('/api/admin/broadcast/preview-count').send({ target: 'all' })
    expect(anon.status).toBe(401)
  })

  it('noma\'lum segment → 400', async () => {
    const res = await asAdmin(request(app).post('/api/admin/broadcast/preview-count')).send({ target: 'vip' })
    expect(res.status).toBe(400)
  })
})
