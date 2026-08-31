/**
 * Integration test — POST /api/certificate/send.
 *
 * Sertifikat rasmi Telegram bot orqali foydalanuvchining shaxsiy chatiga
 * yuboriladi. Real Telegram API'ga CHIQMAYMIZ (grammy mock qilingan) —
 * tekshiriladigan kontrakt: auth gating, zod validatsiya,
 * bot_not_configured / no_telegram_linked shoxlari, caption tarkibi va
 * yuborish xatosi 500 certificate_delivery_failed'ga aylanishi.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

// Grammy mock — sendPhoto spy (real bot chaqirilmaydi)
const { mockSendPhoto } = vi.hoisted(() => ({ mockSendPhoto: vi.fn() }))
vi.mock('grammy', () => ({
  Bot: class MockBot { api = { sendPhoto: mockSendPhoto } },
  InputFile: class InputFile {
    constructor(public data: unknown, public name?: string) {}
  },
}))

import request from 'supertest'
import { inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users } from '../../../server/schema'
import { config } from '../../../server/config'
import { usersRepository } from '../../../server/modules/users/users.repository'
import { authRepository } from '../../../server/modules/auth/auth.repository'

const app = createApp()
const UID = '777000230001'          // raqam-string id → to'g'ridan-to'g'ri Telegram chatId
const UID_NO_TG = 'p_998901234599'  // telefon akkaunti, telegram identity YO'Q
let sessionToken: string
let sessionTokenNoTg: string
const ORIGINAL_BOT_TOKEN = config.telegram.botToken

/** 1x1 PNG base64 (zod min-50 dan oshadi) */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const validBody = {
  imageBase64: PNG_1PX,
  certId:      'YHQ-2026-0042',
  subjectName: "Yo'l harakati qoidalari",
  score:       19,
  total:       20,
  percent:     95,
}

async function cleanup() {
  await db.delete(users).where(inArray(users.id, [UID, UID_NO_TG]))   // cascade: sessions
}

beforeAll(async () => {
  await cleanup()
  await usersRepository.initAtomic({ id: UID, firstName: 'Cert', lastName: '', username: UID, photoUrl: '' })
  await usersRepository.initAtomic({ id: UID_NO_TG, firstName: 'NoTg', lastName: '', username: 'notg', photoUrl: '' })

  sessionToken = `cert_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await authRepository.createSession({
    token: sessionToken, userId: UID, provider: 'telegram',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  sessionTokenNoTg = `cert_notg_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await authRepository.createSession({
    token: sessionTokenNoTg, userId: UID_NO_TG, provider: 'phone',
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

describe('POST /api/certificate/send', () => {
  it('authsiz so\'rov → 401, bot chaqirilmaydi', async () => {
    const res = await request(app).post('/api/certificate/send').send(validBody)
    expect(res.status).toBe(401)
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('juda qisqa rasm yoki certId yo\'q → 400 (zod)', async () => {
    const short = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ ...validBody, imageBase64: 'iVBOR' })
    expect(short.status).toBe(400)

    const noCert = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ imageBase64: PNG_1PX, subjectName: 'Fizika' })
    expect(noCert.status).toBe(400)
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('bot token sozlanmagan → xato EMAS, sentToTelegram: false', async () => {
    config.telegram.botToken = ''
    const res = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, sentToTelegram: false, message: 'bot_not_configured' })
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('Telegram ulanmagan akkaunt → no_telegram_linked (yuborilmaydi)', async () => {
    const res = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionTokenNoTg}`)
      .send(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, sentToTelegram: false, message: 'no_telegram_linked' })
    expect(mockSendPhoto).not.toHaveBeenCalled()
  })

  it('happy path: sendPhoto chaqiriladi — chatId, fayl nomi va caption tarkibi', async () => {
    const res = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, sentToTelegram: true })
    expect(mockSendPhoto).toHaveBeenCalledTimes(1)

    const [chatId, file, opts] = mockSendPhoto.mock.calls[0]!
    expect(chatId).toBe(Number(UID))
    expect((file as { name?: string }).name).toBe(`kivvi-certificate-${validBody.certId}.png`)
    expect(opts.parse_mode).toBe('Markdown')
    expect(opts.caption).toContain(validBody.certId)
    expect(opts.caption).toContain(validBody.subjectName)
    expect(opts.caption).toContain('19/20')
  })

  it('bot yuborishda yiqilsa → 500 certificate_delivery_failed', async () => {
    mockSendPhoto.mockRejectedValueOnce(new Error('telegram down'))
    const res = await request(app).post('/api/certificate/send')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(validBody)

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).toContain('certificate_delivery_failed')
  })
})
