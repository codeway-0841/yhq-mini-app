/**
 * Lazy Octagon question pools (EGRESS 2026-09-24, AUDIT-NEON-EGRESS #1).
 *
 * Ilgari: server boot'da `loadOctagonPools()` 11 bankni (52.7MB) SELECT * qilib
 * xotiraga tortardi — Render free plan har uyqu/uyg'onish + deploy'da takror.
 * Endi: boot'da 0 bank; pool FAQAT shu fanda birinchi duel so'rovida yuklanadi;
 * parallel so'rovlar bitta inflight Promise'ni bo'lishadi; pool RAM'da qoladi.
 *
 * Kritik invariantlar:
 *  - ensurePool faqat so'ralgan fan dataSourceId'sini yuklaydi (subject izolyatsiya)
 *  - N ta parallel ensurePool = 1 ta provider.getAllQuestions (inflight dedup)
 *  - yuklangan pool keyingi chaqiriqlarda DB'ga bormaydi (cache)
 *  - xato → inflight tozalanadi, keyingi so'rov qayta urinadi (retry-safe)
 *  - bo'sh yoki boshqa fan pool'i bilan match boshlanmaydi
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as providers from '../../../server/providers'
import {
  ensurePool,
  poolForSubject,
  setEnginePools,
} from '../../../server/modules/octagon/octagon.engine'
import type { QuestionRow } from '../../../server/providers/QuestionBankProvider'

const row = (id: number, bankId = 'physics_db'): QuestionRow => ({
  id,
  bankId,
  externalId: String(id),
  questionUz: `savol ${id}`,
  questionRu: `вопрос ${id}`,
  optionsUz: { a: '1', b: '2' },
  optionsRu: { a: '1', b: '2' },
  correctAnswer: 'a',
  image: null,
  topicId: 1,
} as QuestionRow)

function fakeProvider(getAllQuestions: ReturnType<typeof vi.fn>, sourceId = 'physics_db') {
  return {
    sourceId,
    getAllQuestions,
    getPublicQuestions: vi.fn(),
    getQuestionsByTopic: vi.fn(),
    getTopics: vi.fn(),
    getQuestionById: vi.fn(),
    getStats: vi.fn(),
  } as any
}

describe('ensurePool — lazy per-subject pool loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setEnginePools(new Map())
  })

  it('faqat so\'ralgan fan yuklanadi (boot\'da 0 bank)', async () => {
    const getAll = vi.fn().mockResolvedValue([row(1), row(2)])
    const spy = vi.spyOn(providers, 'getProvider').mockReturnValue(fakeProvider(getAll))

    const pool = await ensurePool('fizika')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('physics_db')
    expect(getAll).toHaveBeenCalledTimes(1)
    expect(pool).toHaveLength(2)
    // Duel payload maydonlari to'liq map'langan:
    expect(pool[0]).toMatchObject({ id: 1, correct: 'a', textUz: 'savol 1' })
    // Yuklangan pool endi poolForSubject orqali sync olinadi (match hot-path):
    expect(poolForSubject('fizika')).toBe(pool)
  })

  it('parallel so\'rovlar BITTA inflight promise\'ni bo\'lishadi — 1 ta DB o\'qish', async () => {
    const getAll = vi.fn().mockResolvedValue([row(1)])
    vi.spyOn(providers, 'getProvider').mockReturnValue(fakeProvider(getAll))

    const [a, b, c] = await Promise.all([ensurePool('fizika'), ensurePool('fizika'), ensurePool('fizika')])

    expect(getAll).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('yuklangan pool RAM\'da qoladi — keyingi chaqiriqlar DB\'ga BORMAYDI', async () => {
    const getAll = vi.fn().mockResolvedValue([row(1)])
    vi.spyOn(providers, 'getProvider').mockReturnValue(fakeProvider(getAll))

    await ensurePool('fizika')
    const again = await ensurePool('fizika')

    expect(getAll).toHaveBeenCalledTimes(1)
    expect(again).toBe(poolForSubject('fizika'))
  })

  it('xato bo\'lsa inflight tozalanadi — keyingi so\'rov qayta urinadi (retry-safe)', async () => {
    const getAll = vi.fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([row(1)])
    vi.spyOn(providers, 'getProvider').mockReturnValue(fakeProvider(getAll))

    await expect(ensurePool('fizika')).rejects.toThrow('db down')

    const pool = await ensurePool('fizika')
    expect(pool).toHaveLength(1)
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('bo\'sh bank cache qilinmaydi — questions unavailable xatosidan keyin qayta urinadi', async () => {
    const getAll = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row(1)])
    vi.spyOn(providers, 'getProvider').mockReturnValue(fakeProvider(getAll))

    await expect(ensurePool('fizika')).rejects.toThrow('No questions available for physics_db')
    expect(poolForSubject('fizika')).toEqual([])

    const pool = await ensurePool('fizika')
    expect(pool).toHaveLength(1)
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('so\'ralgan fan pool\'i yo\'q bo\'lsa boshqa bankka fallback qilmaydi', () => {
    const trafficPool = [{ id: 1, correct: 'a' }]
    setEnginePools(new Map([['traffic_rules_db', trafficPool]]))

    expect(poolForSubject('yhq')).toBe(trafficPool)
    expect(poolForSubject('fizika')).toEqual([])
  })

  it('turli fanlar ALOHIDA pool oladi (subject izolyatsiyasi)', async () => {
    const getAll = vi.fn().mockResolvedValue([row(1)])
    const spy = vi.spyOn(providers, 'getProvider').mockImplementation((dsId: string) =>
      fakeProvider(getAll, dsId),
    )

    await ensurePool('fizika')
    await ensurePool('fizika')
    expect(getAll).toHaveBeenCalledTimes(1)

    await ensurePool('yhq') // traffic_rules_db — alohida bank
    expect(spy).toHaveBeenCalledWith('traffic_rules_db')
    expect(getAll).toHaveBeenCalledTimes(2)
    // Fizika pool'i qayta yuklanmadi:
    await ensurePool('fizika')
    expect(getAll).toHaveBeenCalledTimes(2)
  })
})
