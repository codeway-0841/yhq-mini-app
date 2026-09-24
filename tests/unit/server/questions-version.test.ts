/**
 * Bank kontent versiyasi (GET /api/questions/version) — client persist-keshining
 * ishonch manbai.
 *
 * EGRESS FIX (2026-09-24, AUDIT-NEON-EGRESS #2): versiya endi BUTUN bankni
 * (0.6–11.8MB) SELECT * qilib md5 olmaydi — FAQAT `question_banks.content_version`
 * yagona-qator counter'i o'qiladi (~50 bayt). Admin CRUD counter'ni atomik
 * oshiradi — client kesh-invalidation semantikasi o'zgarmagan.
 *
 * Kritik invariantlar:
 *  - javob { v } — opaque string, faqat counter'dan (`cv<n>`)
 *  - provider.getAllQuestions/getTopics HECH QACHON chaqirilmaydi (full-bank YO'Q)
 *  - PER-LAMBDA KESH YO'Q: har so'rov yangi counter — admin tahriri barcha
 *    Vercel instance'lariga darhol ko'rinadi (multi-instance to'g'rilik)
 *  - counter oshsa → v o'zgaradi (client bankni qayta tortadi)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// db/connection mock — bankContentVersion endi db.select({ v: content_version })
// zanjirini ishlatadi. Zanjir: select(...).from(...).where(...) → rows.
const h = vi.hoisted(() => {
  const whereFn = vi.fn()
  const fromFn = vi.fn(() => ({ where: whereFn }))
  const selectFn = vi.fn(() => ({ from: fromFn }))
  return { whereFn, fromFn, selectFn }
})

vi.mock('../../../server/db/connection', () => ({
  db: { select: h.selectFn },
}))

// Legacy kontrakt testi — R2 chegarasi mock (r2v YO'Q deb hisoblaymiz).
// Sabab: tests/setup.ts dotenv yuklaydi va lokal .env'da QBANK_R2_ENABLED=true
// bo'lsa real getPublishedVersion jonli R2 markerga borardi (unit test
// tarmoqqa chiqMASLIGI shart). r2v kompozitsiyasi questions-version-r2v.test.ts'da.
vi.mock('../../../server/modules/content/qbank-publish', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/modules/content/qbank-publish')>()),
  getPublishedVersion: vi.fn(async () => null),
}))

import { createApp } from '../../../server/app'
import * as providers from '../../../server/providers'
import { hashBankContent, invalidateBankVersions } from '../../../server/modules/questions/bank-version'
import type { QuestionRow, TopicRow } from '../../../server/providers/QuestionBankProvider'

const app = createApp()

const q = (id: number, text = `savol ${id}`): QuestionRow => ({
  id,
  bankId: 'traffic_rules_db',
  externalId: String(id),
  questionUz: text,
  questionRu: `вопрос ${id}`,
  optionsUz: { a: 'A', b: 'B' },
  optionsRu: { a: 'А', b: 'Б' },
  correctAnswer: 'a',
  image: null,
  topicId: 1,
} as QuestionRow)

const t = (id: number, name = `Mavzu ${id}`): TopicRow => ({
  id, nameUz: name, nameRu: `Тема ${id}`, slug: `mavzu-${id}`, bankId: 'traffic_rules_db',
} as TopicRow)

function mockProvider() {
  return {
    sourceId: 'traffic_rules_db',
    getAllQuestions: vi.fn(),
    getPublicQuestions: vi.fn(),
    getQuestionsByTopic: vi.fn(),
    getTopics: vi.fn(),
    getQuestionById: vi.fn(),
    getStats: vi.fn(),
  } as any
}

describe('hashBankContent — deterministik fingerprint (test/diagnostika util)', () => {
  it('bir xil kontent → bir xil hash', () => {
    const rows = [q(1), q(2)]
    const topics = [t(1)]
    expect(hashBankContent(rows, topics)).toBe(hashBankContent(rows, topics))
  })

  it('savol matni o\'zgarsa → hash o\'zgaradi', () => {
    const topics = [t(1)]
    const h1 = hashBankContent([q(1, 'eski matn')], topics)
    const h2 = hashBankContent([q(1, 'yangi matn')], topics)
    expect(h1).not.toBe(h2)
  })

  it('correctAnswer o\'zgarsa → hash O\'ZGARMAYDI (client uni ko\'rmaydi)', () => {
    const topics = [t(1)]
    const a = q(1)
    const b = { ...q(1), correctAnswer: 'b' }
    expect(hashBankContent([a], topics)).toBe(hashBankContent([b], topics))
  })

  it('topic nomi o\'zgarsa → hash o\'zgaradi (keshdagi topics ham yangilanadi)', () => {
    const rows = [q(1)]
    expect(hashBankContent(rows, [t(1, 'Eski')])).not.toBe(hashBankContent(rows, [t(1, 'Yangi')]))
  })

  it('savollar soni o\'zgarsa → hash o\'zgaradi', () => {
    const topics = [t(1)]
    expect(hashBankContent([q(1)], topics)).not.toBe(hashBankContent([q(1), q(2)], topics))
  })
})

describe('GET /api/questions/version — content_version counter (EGRESS fix)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    invalidateBankVersions()
    h.whereFn.mockReset()
    h.fromFn.mockClear()
    h.selectFn.mockClear()
  })

  it('200 + { v: "cv<n>" } + public cache header', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 7 }])

    const res = await request(app).get('/api/questions/version').expect(200)
    expect(res.body).toEqual({ v: 'cv7' })
    expect(res.headers['cache-control']).toContain('public')
    expect(res.headers['cache-control']).toContain('s-maxage=60')
  })

  it('EGRESS: FAQAT yagona-qator content_version o\'qiladi — butun bank TORTILMAYDI', async () => {
    const provider = mockProvider()
    vi.spyOn(providers, 'getProvider').mockReturnValue(provider)
    h.whereFn.mockResolvedValue([{ v: 3 }])

    await request(app).get('/api/questions/version').expect(200)

    // Full-bank o'qishlar — HECH QACHON:
    expect(provider.getAllQuestions).not.toHaveBeenCalled()
    expect(provider.getPublicQuestions).not.toHaveBeenCalled()
    expect(provider.getTopics).not.toHaveBeenCalled()
    // SQL proyeksiya FAQAT content_version ustunini so'raydi:
    expect(h.selectFn).toHaveBeenCalledTimes(1)
    const projection = h.selectFn.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(projection)).toEqual(['v'])
  })

  it('PER-LAMBDA KESH YO\'Q — har so\'rov DB\'dan yangi o\'qiydi (multi-instance to\'g\'rilik)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 5 }])

    await request(app).get('/api/questions/version').expect(200)
    await request(app).get('/api/questions/version').expect(200)
    // Bitta integer'lik PK lookup arzon — to'g'rilik keshdan muhim:
    // admin tahriri boshqa lambda instance'larida ham darhol ko'rinishi SHART.
    expect(h.whereFn).toHaveBeenCalledTimes(2)
  })

  it('counter oshsa KEYINGI so\'rovda darhol yangi versiya — invalidate SHART EMAS (multi-instance xavfsiz)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 5 }])
    const r1 = await request(app).get('/api/questions/version').expect(200)

    // Admin CRUD simulyatsiyasi: content_version 5 → 6. E'tibor bering:
    // invalidateBankVersions() CHAQIRILMAYDI — kesh bo'lmagani uchun
    // keyingi so'rov o'zi yangi qiymatni ko'radi (eski lambda'da qotish YO'Q).
    h.whereFn.mockResolvedValue([{ v: 6 }])
    const r2 = await request(app).get('/api/questions/version').expect(200)

    expect(r1.body.v).toBe('cv5')
    expect(r2.body.v).toBe('cv6')
    expect(r1.body.v).not.toBe(r2.body.v)
    expect(h.whereFn).toHaveBeenCalledTimes(2)
  })

  it('invalidateBankVersions() no-op bo\'lsa ham xavfsiz chaqiriladi (repository integratsiyasi)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 9 }])
    invalidateBankVersions() // no-op — lekin mavjud va throw qilmaydi
    const res = await request(app).get('/api/questions/version').expect(200)
    expect(res.body).toEqual({ v: 'cv9' })
  })

  it('bank qatori topilmasa → "cv1" fallback', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([])

    const res = await request(app).get('/api/questions/version').expect(200)
    expect(res.body).toEqual({ v: 'cv1' })
  })

  it('javobda kontent YO\'Q — faqat versiya (egress minimal)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue(mockProvider())
    h.whereFn.mockResolvedValue([{ v: 12 }])

    const res = await request(app).get('/api/questions/version').expect(200)
    expect(Object.keys(res.body)).toEqual(['v'])
    expect(JSON.stringify(res.body).length).toBeLessThan(64)
  })

  it('noto\'g\'ri parametr → 400', async () => {
    await request(app).get('/api/questions/version?topicId=abc').expect(400)
  })
})
