/**
 * Integration test — POST /api/share/image (FIXPLAN #48 rasm-ulashish fix).
 *
 * Telegram WebView'da navigator.share/download ishlamasligi sababli rasmlar
 * bot orqali shaxsiy chatga yuboriladi. Real bot yuborishni testda
 * chaqirmaymiz (firibgar spam bo'lardi) — faqat kontrakt holatlari:
 * auth gating, zod validatsiya, bot_not_configured/no_telegram_linked.
 *
 * BOT_TOKEN o'chiriladi — shunda endpoint hech qayerga yubormay
 * { sentToTelegram: false, message: 'bot_not_configured' } qaytaradi.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

// Grammy mock — real Telegram API'ga CHIQMAYMIZ: sendPhoto spy
const { mockSendPhoto } = vi.hoisted(() => ({ mockSendPhoto: vi.fn() }))
vi.mock('grammy', () => ({
  // `new Bot()` bilan chaqiriladi — mock klass SHART (arrow fn constructor bo'la olmaydi)
  Bot: class MockBot { api = { sendPhoto: mockSendPhoto } },
  InputFile: class InputFile {
    constructor(public data: unknown, public name?: string) {}
  },
}))

import request from 'supertest'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users } from '../../../server/schema'
import { inArray } from 'drizzle-orm'
import { config } from '../../../server/config'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()
const UID = '777000220001'
let sessionToken: string
const ORIGINAL_BOT_TOKEN = config.telegram.botToken

/** 1x1 PNG base64 (zod min-50 dan oshishi uchun yetarli) */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function cleanup() {
  await db.delete(users).where(inArray(users.id, [UID])) // cascade: sessions
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID, firstName: 'Share', lastName: '', username: UID, photoUrl: '' })
  sessionToken = `shareimg_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await authRepository.createSession({
    token: sessionToken,
    userId: UID,
    provider: 'telegram',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
})

beforeEach(() => {
  mockSendPhoto.mockReset()
  mockSendPhoto.mockResolvedValue({})
  config.telegram.botToken = 'test-bot-token'
})

afterAll(async () => {
  config.telegram.botToken = ORIGINAL_BOT_TOKEN
  await cleanup()
})

describe('POST /api/share/image (#48)', () => {
  it('authsiz so\'rov → 401 (requireAuth)', async () => {
    const res = await request(app).post('/api/share/image').send({ imageBase64: PNG_1PX, caption: 'x' })
    expect(res.status).toBe(401)
  })

  it('rasm kichkina/bo\'sh → 400 (zod)', async () => {
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: 'abc', caption: 'x' })
    expect(res.status).toBe(400)
  })

  it('caption bo\'sh → 400', async () => {
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, caption: '' })
    expect(res.status).toBe(400)
  })

  it('bot token yo\'q → bot_not_configured (xato EMAS), yuborilmaydi', async () => {
    config.telegram.botToken = ''
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, caption: 'KIWI test', fileName: 'kiwi-result-95pct.png' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.sentToTelegram).toBe(false)
    expect(res.body.message).toBe('bot_not_configured')
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('happy path: raqam-string userId → sendPhoto chaqiriladi (buffer + caption)', async () => {
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, caption: 'KIWI natija', fileName: 'kiwi-result-95pct.png' })
    expect(res.status).toBe(200)
    expect(res.body.sentToTelegram).toBe(true)
    expect(mockSendPhoto).toHaveBeenCalledTimes(1)
    const [chatId, file, opts] = mockSendPhoto.mock.calls[0]
    expect(chatId).toBe(Number(UID))
    expect((file as { name?: string }).name).toBe('kiwi-result-95pct.png')
    expect((opts as { caption: string }).caption).toBe('KIWI natija')
  })

  it('bot xatosi → 500 share_delivery_failed', async () => {
    mockSendPhoto.mockRejectedValueOnce(new Error('chat not found'))
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, caption: 'x' })
    expect(res.status).toBe(500)
    expect(String(res.body.error ?? '')).toContain('share_delivery_failed')
  })

  it('fileName invalid chars → 400', async () => {
    const res = await request(app).post('/api/share/image')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, caption: 'x', fileName: '../evil.png' })
    expect(res.status).toBe(400)
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })
})
