/**
 * Audit H-4 regression-guard: GET /questions/:id/explanation PUBLIC edi va izoh
 * matni to'g'ri javobni oshkor qilardi ("Nima uchun A4 to'g'ri...") — cheater
 * skriptiga har savolda fresh-correct + coin/XP farm yo'li ochiq edi.
 * Endi izoh FAQAT shu savolga ALLAQACHON javob bergan (progress_questions qatori
 * bor) user'ga ko'rsatiladi (post-answer reveal semantikasi).
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { questionsRepository } from '../../../server/modules/questions/questions.repository'

// Test-holat boshqaruvi (vi.mock factory hoisting uchun vi.hoisted SHART)
const h = vi.hoisted(() => ({ enforced: true, answered: true }))

vi.mock('../../../server/middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/middleware/auth')>()),
  isAuthEnforced: () => h.enforced,
}))

// Gate so'rovi (progress_questions SELECT) — handler ichidagi yagona executeRows
// chaqiruvi (findExplanation spy orqali alohida boshqariladi).
vi.mock('../../../server/db/connection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/db/connection')>()),
  executeRows: vi.fn(async () => (h.answered ? [{ x: 1 }] : [])),
}))

import router from '../../../server/modules/questions/questions.router'

let currentUserId: string | null = null
let app: express.Express

beforeAll(() => {
  app = express()
  app.use(express.json())
  // Global auth middleware resolve etgan credential'ni simulyatsiya qilamiz
  app.use((req, _res, next) => {
    if (currentUserId !== null) (req as { userId?: string }).userId = currentUserId
    next()
  })
  app.use('/api', router)
})

afterEach(() => {
  vi.restoreAllMocks()
  currentUserId = null
  h.enforced = true
  h.answered = true
})

const mockExplanation = (text = 'Ushbu belgi...') =>
  vi.spyOn(questionsRepository, 'findExplanation').mockResolvedValue({
    questionId: 42, explanationUz: text, explanationRu: 'RU izoh',
  } as never)

describe('GET /api/questions/:questionId/explanation — post-answer gating (audit H-4)', () => {
  it('prod + credentials YO\'Q → 401 Authentication required', async () => {
    currentUserId = null
    const res = await request(app).get('/api/questions/42/explanation?lang=uz')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Authentication required')
  })

  it('prod + user savolga JAVOB BERMAGAN → 403 explanation_locked', async () => {
    currentUserId = 'user-1'
    h.answered = false
    const res = await request(app).get('/api/questions/42/explanation?lang=uz')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('explanation_locked')
  })

  it('prod + user savolga javob bergan → 200 izoh matni qaytadi', async () => {
    currentUserId = 'user-1'
    h.answered = true
    mockExplanation('To\'g\'ri javob sababi...')
    const res = await request(app).get('/api/questions/42/explanation?lang=uz')
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('To\'g\'ri javob sababi...')
    // Per-user gate — CDN public cache ZIYO
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('javob bergan user uchun izoh topilmasa → 404', async () => {
    currentUserId = 'user-1'
    vi.spyOn(questionsRepository, 'findExplanation').mockResolvedValue(undefined as never)
    const res = await request(app).get('/api/questions/42/explanation?lang=uz')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('explanation_not_found')
  })

  it('dev muhit (auth enforce EMAS) — gate o\'tkaziladi (lokal development)', async () => {
    currentUserId = null
    h.enforced = false
    mockExplanation()
    const res = await request(app).get('/api/questions/42/explanation?lang=uz')
    expect(res.status).toBe(200)
  })
})
