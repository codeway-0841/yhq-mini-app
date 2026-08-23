/**
 * Integration test — POST /api/tutor/explain (AI Tutor SSE endpointi).
 *
 * Gemini'ga HAQIQIY chiqmaymiz: global `fetch` mock qilinadi va SSE oqimi
 * qaytariladi. Tekshiriladigan kontrakt: kalit yo'qligi, premium gating,
 * kunlik kvota (429), noma'lum savol, zod validatsiya va matn qismlarining
 * client formatiga (`data: {"text": ...}`) o'girilishi.
 *
 * Kvota repository'sining o'zi tests/integration/api/tutor-budget.test.ts'da.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { eq, inArray } from 'drizzle-orm'
import { createApp } from '../../../server/app'
import { db } from '../../../server/db/connection'
import { users, sessions, questions, tutorUsage } from '../../../server/schema'
import { config } from '../../../server/config'
import { authRepository } from '../../../server/modules/auth/auth.repository'
import { usersRepository } from '../../../server/modules/users/users.repository'
import {
  tutorUsageRepository, TUTOR_DAILY_USER_LIMIT,
} from '../../../server/modules/tutor/tutor.repository'
import { tashkentDate } from '../../../server/utils/date'

const app = createApp()

const PREMIUM = '777000260001'
const FREE    = '777000260002'
const CAPPED  = '777000260003'   // kunlik kvotasi to'lgan premium
const IDS = [PREMIUM, FREE, CAPPED]
const TOKENS: Record<string, string> = {
  [PREMIUM]: 'itest_tutor_premium_0001',
  [FREE]:    'itest_tutor_free_0001',
  [CAPPED]:  'itest_tutor_capped_0001',
}

const ORIGINAL_KEY = config.ai.geminiApiKey
const realFetch = globalThis.fetch
let questionId: number

const as = (uid: string) => (r: request.Test) => r.set('Authorization', `Bearer ${TOKENS[uid]}`)

/**
 * FAQAT Gemini chaqiruvini ushlaydi — qolgan hamma fetch realFetch'ga o'tadi.
 * (Neon serverless drayveri ham global fetch ustida ishlaydi: uni almashtirsak
 * DB so'rovlari yiqiladi.)
 */
function mockGemini(handler: () => Response) {
  const calls = { count: 0 }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('generativelanguage.googleapis.com')) {
      calls.count++
      return handler()
    }
    return realFetch(input as RequestInfo, init)
  }) as unknown as typeof fetch
  return calls
}

/** Gemini SSE javobini taqlid qiluvchi Response */
function sseResponse(chunks: string[], ok = true, status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const text of chunks) {
        const payload = { candidates: [{ content: { parts: [{ text }] } }] }
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      controller.close()
    },
  })
  return { ok, status, body, text: async () => '' } as unknown as Response
}

async function cleanup() {
  await db.delete(tutorUsage).where(inArray(tutorUsage.userId, IDS))
  await db.delete(sessions).where(inArray(sessions.userId, IDS))
  await db.delete(users).where(inArray(users.id, IDS))
}

beforeAll(async () => {
  await cleanup()
  for (const id of IDS) {
    await usersRepository.initAtomic({ id, firstName: 'Tutor', lastName: id.slice(-4), username: '', photoUrl: '' })
    await authRepository.createSession({
      token: TOKENS[id]!, userId: id, provider: 'phone',
      expiresAt: new Date(Date.now() + 3_600_000),
    })
  }
  await db.update(users).set({ tariff: 'premium' }).where(inArray(users.id, [PREMIUM, CAPPED]))
  await db.update(users).set({ tariff: 'free', premiumUntil: null }).where(eq(users.id, FREE))

  const [q] = await db.select({ id: questions.id }).from(questions).limit(1)
  if (!q) throw new Error('Test DB da savol yo\'q — avval npm run db:seed')
  questionId = q.id
})

beforeEach(() => {
  config.ai.geminiApiKey = 'test-gemini-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

afterAll(async () => {
  config.ai.geminiApiKey = ORIGINAL_KEY
  globalThis.fetch = realFetch
  await cleanup()
})

describe('POST /api/tutor/explain', () => {
  it('GEMINI_API_KEY sozlanmagan → 503, Gemini chaqirilmaydi', async () => {
    config.ai.geminiApiKey = ''
    const gemini = mockGemini(() => sseResponse(['x']))

    const res = await as(PREMIUM)(request(app).post('/api/tutor/explain')).send({ questionId, lang: 'uz' })

    expect(res.status).toBe(503)
    expect(gemini.count).toBe(0)
  })

  it('premium bo\'lmagan foydalanuvchi → 403 premium_required', async () => {
    const gemini = mockGemini(() => sseResponse(['x']))

    const res = await as(FREE)(request(app).post('/api/tutor/explain')).send({ questionId, lang: 'uz' })

    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).toContain('premium_required')
    expect(gemini.count).toBe(0)
  })

  it('yaroqsiz payload → 400 (questionId 0, noma\'lum til)', async () => {
    const zero = await as(PREMIUM)(request(app).post('/api/tutor/explain')).send({ questionId: 0 })
    expect(zero.status).toBe(400)

    const lang = await as(PREMIUM)(request(app).post('/api/tutor/explain')).send({ questionId, lang: 'en' })
    expect(lang.status).toBe(400)
  })

  it('premium: Gemini matni SSE bo\'lib client formatida uzatiladi', async () => {
    mockGemini(() => sseResponse(['Salom, ', 'bu qoida...']))

    const res = await as(PREMIUM)(request(app).post('/api/tutor/explain'))
      .send({ questionId, lang: 'uz', answeredCorrect: false })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.text).toContain('data: {"text":"Salom, "}')
    expect(res.text).toContain('data: {"text":"bu qoida..."}')
    expect(res.text.trimEnd().endsWith('data: [DONE]')).toBe(true)
  })

  it('noma\'lum savol → 404', async () => {
    mockGemini(() => sseResponse(['x']))

    const res = await as(PREMIUM)(request(app).post('/api/tutor/explain')).send({ questionId: 999_999_999, lang: 'uz' })

    expect(res.status).toBe(404)
  })

  it('Gemini 429 qaytarsa → 503 quota', async () => {
    mockGemini(() => sseResponse([], false, 429))

    const res = await as(PREMIUM)(request(app).post('/api/tutor/explain')).send({ questionId, lang: 'uz' })

    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).toContain('quota')
  })

  it('kunlik kvota to\'lgan premium → 429 daily_limit (Gemini chaqirilmaydi)', async () => {
    // Kvotani to'ldiramiz — limitgacha sarflaymiz
    const date = tashkentDate()
    for (let i = 0; i < TUTOR_DAILY_USER_LIMIT; i++) {
      await tutorUsageRepository.tryConsume(CAPPED, date, TUTOR_DAILY_USER_LIMIT)
    }
    const gemini = mockGemini(() => sseResponse(['x']))

    const res = await as(CAPPED)(request(app).post('/api/tutor/explain')).send({ questionId, lang: 'uz' })

    expect(res.status).toBe(429)
    expect(JSON.stringify(res.body)).toContain('daily_limit')
    expect(gemini.count).toBe(0)
  })
})
