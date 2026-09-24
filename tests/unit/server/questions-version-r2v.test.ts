/**
 * GET /api/questions/version — r2v kompozitsiyasi (R2/Worker fizika pilot).
 *
 * Invariantlar:
 *  - QBANK flag ON + fizika + publish bor → { v, r2v } (ADDITIVE);
 *  - marker yo'q → FAQAT { v } (r2v field'i umuman yo'q → client legacy);
 *  - fizika emas fan → r2v HECH QACHON qo'shilmaydi;
 *  - flag OFF → r2v yo'q (server-side kill switch);
 *  - r2v FAQAT published counter'dan (Neon counter bilan ARALASHMAYDI).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const h = vi.hoisted(() => {
  const whereFn = vi.fn()
  const fromFn = vi.fn(() => ({ where: whereFn }))
  const selectFn = vi.fn(() => ({ from: fromFn }))
  return { whereFn, fromFn, selectFn, published: 12 as number | null, enabled: true }
})

vi.mock('../../../server/db/connection', () => ({
  db: { select: h.selectFn },
}))

vi.mock('../../../server/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../server/config')>()
  return {
    ...original,
    config: {
      ...original.config,
      get qbank() {
        return { ...original.config.qbank, enabled: h.enabled }
      },
    },
  }
})

vi.mock('../../../server/modules/content/qbank-publish', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/modules/content/qbank-publish')>()),
  getPublishedVersion: vi.fn(async () => h.published),
}))

import { createApp } from '../../../server/app'
import * as providers from '../../../server/providers'

const app = createApp()

function mockProvider(sourceId = 'physics_db') {
  return {
    sourceId,
    getAllQuestions: vi.fn(),
    getPublicQuestions: vi.fn(),
    getQuestionsByTopic: vi.fn(),
    getTopics: vi.fn(),
    getQuestionById: vi.fn(),
    getStats: vi.fn(),
  } as ReturnType<typeof providers.getProvider>
}

describe('GET /api/questions/version — r2v (R2 published marker)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    h.whereFn.mockReset()
    h.published = 12
    h.enabled = true
  })

  it('fizika + flag ON + publish bor → { v, r2v } additive', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 15 }])

    const res = await request(app).get('/api/questions/version?subject=fizika').expect(200)
    expect(res.body).toEqual({ v: 'cv15', r2v: 'cv12' })
    // r2v FAQAT publish markeridan — Neon counter (15) bilan aralashmaydi
    expect(res.body.r2v).not.toBe(res.body.v)
  })

  it('marker yo\'q (publish qilinmagan) → FAQAT { v } — r2v field\'i umuman yo\'q', async () => {
    h.published = null
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 15 }])

    const res = await request(app).get('/api/questions/version?subject=fizika').expect(200)
    expect(res.body).toEqual({ v: 'cv15' })
    expect('r2v' in res.body).toBe(false)
  })

  it('flag OFF → r2v yo\'q (server-side kill switch — client legacy yo\'lga tushadi)', async () => {
    h.enabled = false
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 15 }])

    const res = await request(app).get('/api/questions/version?subject=fizika').expect(200)
    expect(res.body).toEqual({ v: 'cv15' })
    expect('r2v' in res.body).toBe(false)
  })

  it('barcha QBANK fanlari r2v oladi (yhq misolida)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider('traffic_rules_db'))
    h.whereFn.mockResolvedValue([{ v: 44 }])

    const res = await request(app).get('/api/questions/version?subject=yhq').expect(200)
    expect(res.body).toEqual({ v: 'cv44', r2v: 'cv12' })
  })

  it('r2v bo\'lsa ham javob kichik (<100 bayt) va public cache', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 15 }])

    const res = await request(app).get('/api/questions/version?subject=fizika').expect(200)
    expect(JSON.stringify(res.body).length).toBeLessThan(100)
    expect(res.headers['cache-control']).toContain('s-maxage=60')
  })
})
