/**
 * Bank kontent versiyasi (GET /api/questions/version) — client persist-keshining
 * ishonch manbai (EGRESS "A" bosqich, 2026-09-21).
 *
 * Kritik invariantlar:
 *  - DETERMINISTIK: bir xil kontent → har safar bir xil hash (lambda'lararo)
 *  - public payload o'zgarsa → hash o'zgaradi (client keshi yangilanadi)
 *  - correctAnswer ATAYLAB hash'ga kirmaydi: client uni hech ko'rmaydi —
 *    admin faqat javob kalitini tuzatsa millionlab client keshi bekorga
 *    bekor qilinmasligi kerak
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
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

describe('hashBankContent — deterministik fingerprint', () => {
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

describe('GET /api/questions/version', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    invalidateBankVersions()
  })

  it('200 + { v } + public cache header', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue({
      sourceId: 'traffic_rules_db',
      getAllQuestions: vi.fn().mockResolvedValue([q(1), q(2)]),
      getQuestionsByTopic: vi.fn(),
      getTopics: vi.fn().mockResolvedValue([t(1)]),
      getQuestionById: vi.fn(),
      getStats: vi.fn(),
    } as any)

    const res = await request(app).get('/api/questions/version').expect(200)
    expect(typeof res.body.v).toBe('string')
    expect(res.body.v).toMatch(/^[0-9a-f]{32}$/)
    expect(res.headers['cache-control']).toContain('public')
    expect(res.headers['cache-control']).toContain('s-maxage=60')
  })

  it('javobda kontent YO\'Q — faqat fingerprint (egress minimal)', async () => {
    vi.spyOn(providers, 'getProvider').mockReturnValue({
      sourceId: 'traffic_rules_db',
      getAllQuestions: vi.fn().mockResolvedValue([q(1)]),
      getQuestionsByTopic: vi.fn(),
      getTopics: vi.fn().mockResolvedValue([]),
      getQuestionById: vi.fn(),
      getStats: vi.fn(),
    } as any)

    const res = await request(app).get('/api/questions/version').expect(200)
    expect(Object.keys(res.body)).toEqual(['v'])
    expect(JSON.stringify(res.body).length).toBeLessThan(64)
  })

  it('noto\'g\'ri parametr → 400', async () => {
    await request(app).get('/api/questions/version?topicId=abc').expect(400)
  })

  it('kontent o\'zgarsa versiya ham o\'zgaradi (kesh miss → yangi hash)', async () => {
    const provider = {
      sourceId: 'traffic_rules_db',
      getAllQuestions: vi.fn().mockResolvedValue([q(1, 'eski')]),
      getQuestionsByTopic: vi.fn(),
      getTopics: vi.fn().mockResolvedValue([]),
      getQuestionById: vi.fn(),
      getStats: vi.fn(),
    } as any
    const spy = vi.spyOn(providers, 'getProvider').mockReturnValue(provider)

    const r1 = await request(app).get('/api/questions/version').expect(200)
    // Admin tahriri simulyatsiyasi: kontent o'zgardi + kesh tozalandi
    provider.getAllQuestions.mockResolvedValue([q(1, 'yangi')])
    invalidateBankVersions()
    const r2 = await request(app).get('/api/questions/version').expect(200)

    expect(r1.body.v).not.toBe(r2.body.v)
    expect(spy).toHaveBeenCalled()
  })
})
