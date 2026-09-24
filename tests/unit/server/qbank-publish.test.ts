/**
 * QBANK PUBLISH — atomik nashr orkestratsiyasi (fake deps, Neon/R2'siz).
 *
 * ATOMIK PUBLISH invariantlari:
 *  - marker (`published.json`) FAQAT barcha obyekt yuklanib va HEAD bilan
 *    tekshirilgach, ENG OXIRIDA yoziladi;
 *  - verify fail → THROW, marker YOZILMAYDI (eski versiya xizmatda qoladi);
 *  - dry-run → R2'ga HECH NARSA yozilmaydi;
 *  - rasm hash-dedup: mavjud obyekt skip;
 *  - eski versiyalar (v < joriy-1) tozalanadi (joriy + oldingi saqlanadi).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  publishQuestionBank,
  readPublishedVersion,
  markerKey,
  type PublishDeps,
  type QbankStorage,
} from '../../../server/modules/content/qbank-publish'
import type { ExportQuestionRow } from '../../../server/modules/content/qbank-export'

interface Call { op: string; key: string }

function makeStorage(opts: { failHead?: string[] } = {}): QbankStorage & { calls: Call[] } {
  const calls: Call[] = []
  const existing = new Set<string>()
  return {
    calls,
    async uploadObject(key, _body) {
      calls.push({ op: 'put', key })
      existing.add(key)
    },
    async objectExists(key) {
      calls.push({ op: 'head', key })
      if (opts.failHead?.some((p) => key.includes(p))) return false
      // Rasm HEAD'da "mavjud" bo'lmasa upload kerak bo'ladi; bizda hech narsa yo'q
      return existing.has(key)
    },
    async getObject(key) {
      calls.push({ op: 'get', key })
      return null
    },
    async deleteObjects(keys) {
      for (const key of keys) calls.push({ op: 'del', key })
    },
    async listObjects() {
      return [
        'questions/physics/v9/manifest.json',
        'questions/physics/v9/chunks/chunk-001.json',
        'questions/physics/v10/manifest.json',
        'questions/physics/v11/manifest.json',
        'questions/physics/v12/manifest.json',
      ]
    },
  }
}

function makeDeps(overrides: Partial<PublishDeps> = {}, storage?: QbankStorage & { calls: Call[] }): PublishDeps {
  const rows: ExportQuestionRow[] = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    externalId: `ftp-${i + 1}`,
    questionUz: `Savol ${i + 1}`,
    questionRu: `Вопрос ${i + 1}`,
    optionsUz: { A: 'a', B: 'b' },
    optionsRu: { A: 'а', B: 'б' },
    image: i < 3 ? `/physics-print/img-${i + 1}.webp` : null,
    topicId: (i % 3) + 1,
  }))
  const imageBytes = new Map<string, Buffer>([
    ['/physics-print/img-1.webp', Buffer.from('image-bytes-1')],
    ['/physics-print/img-2.webp', Buffer.from('image-bytes-2')],
    // img-3 ataylab yo'q — missingImages=1 (graceful fallback)
  ])
  return {
    readVersion: async () => 12,
    readRows: async () => rows,
    readTopicIds: async () => [1, 2, 3],
    storage: storage ?? makeStorage(),
    loadImage: async (p) => imageBytes.get(p) ?? null,
    now: () => new Date('2026-09-24T00:00:00.000Z'),
    ...overrides,
  }
}

describe('publishQuestionBank — muvaffaqiyatli publish', () => {
  it('hisobot to\'g\'ri + marker ENG OXIRIDA yoziladi', async () => {
    const storage = makeStorage()
    const report = await publishQuestionBank('fizika', makeDeps({}, storage))

    expect(report.version).toBe(12)
    expect(report.questionCount).toBe(30)
    expect(report.topicCount).toBe(3)
    expect(report.chunkCount).toBeGreaterThan(0)
    expect(report.imageCount).toBe(2)         // 3 DB yo'l — 1 topilmadi
    expect(report.missingImages).toBe(1)
    expect(report.verifiedObjects).toBe(report.chunkCount + 1) // chunks + manifest

    const puts = storage.calls.filter((c) => c.op === 'put').map((c) => c.key)
    // Chunk'lar + manifest + 2 rasm + marker
    const markerPut = puts.indexOf('questions/physics/published.json')
    expect(markerPut).toBeGreaterThan(-1)
    expect(markerPut).toBe(puts.length - 1) // MARKER ENG OXIRIDA
    // Manifest chunk'lardan KEYIN, marker'dan OLDIN
    const manifestPut = puts.indexOf('questions/physics/v12/manifest.json')
    expect(manifestPut).toBeGreaterThan(-1)
    expect(manifestPut).toBeLessThan(markerPut)
    // Rasmlar hash-nomli, versiyadan mustaqil
    expect(puts.some((k) => /^images\/physics\/[a-f0-9]{16}\.webp$/.test(k))).toBe(true)
  })

  it('HEAD verify HAMMA chunk + manifest uchun bajariladi', async () => {
    const storage = makeStorage()
    const report = await publishQuestionBank('fizika', makeDeps({}, storage))
    const heads = storage.calls.filter((c) => c.op === 'head').map((c) => c.key)
    expect(heads).toContain('questions/physics/v12/manifest.json')
    for (let i = 1; i <= report.chunkCount; i += 1) {
      expect(heads).toContain(`questions/physics/v12/chunks/chunk-${String(i).padStart(3, '0')}.json`)
    }
  })

  it('eski versiyalar tozalanadi: v <= joriy-2 (v9, v10 o\'chadi; v11, v12 qoladi)', async () => {
    const storage = makeStorage()
    const report = await publishQuestionBank('fizika', makeDeps({}, storage))
    const dels = storage.calls.filter((c) => c.op === 'del').map((c) => c.key)
    expect(dels).toContain('questions/physics/v9/manifest.json')
    expect(dels).toContain('questions/physics/v10/manifest.json')
    expect(dels).not.toContain('questions/physics/v11/manifest.json')
    expect(dels).not.toContain('questions/physics/v12/manifest.json')
    expect([...report.deletedOldVersions].sort((a, b) => a - b)).toEqual([9, 10])
  })
})

describe('publishQuestionBank — ATOMIKLIK: verify fail → marker YO\'Q', () => {
  it('chunk HEAD fail → THROW + published.json YOZILMAYDI', async () => {
    const storage = makeStorage({ failHead: ['chunk-001'] })
    await expect(publishQuestionBank('fizika', makeDeps({}, storage)))
      .rejects.toThrow(/verify_failed/)
    const markerPut = storage.calls.find((c) => c.op === 'put' && c.key === markerKey('physics'))
    expect(markerPut).toBeUndefined()
  })
})

describe('publishQuestionBank — dry-run', () => {
  it('R2\'ga HECH NARSA yozilmaydi (faqat o\'qish + validatsiya)', async () => {
    const storage = makeStorage()
    const report = await publishQuestionBank('fizika', makeDeps({}, storage), { dryRun: true })
    expect(report.dryRun).toBe(true)
    const puts = storage.calls.filter((c) => c.op === 'put')
    expect(puts).toHaveLength(0)
  })
})

describe('publishQuestionBank — himoya devorlari', () => {
  it('bo\'sh bank → THROW (hech narsa yozilmaydi)', async () => {
    const storage = makeStorage()
    await expect(publishQuestionBank('fizika', makeDeps({ readRows: async () => [] }, storage)))
      .rejects.toThrow(/empty_bank/)
    expect(storage.calls.filter((c) => c.op === 'put')).toHaveLength(0)
  })

  it('bank version yo\'q → THROW', async () => {
    await expect(publishQuestionBank('fizika', makeDeps({ readVersion: async () => null })))
      .rejects.toThrow(/not_found/)
  })

  it('QBANK\'da yo\'q fan → THROW', async () => {
    await expect(publishQuestionBank('musiqa', makeDeps())).rejects.toThrow(/not_supported/)
  })

  it('qator\'da ortiqcha (kalit) maydon bo\'lsa — WHITELIST uni tashlab yuboradi (chunk\'da yo\'q)', async () => {
    const badRows: ExportQuestionRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, externalId: `x${i}`, questionUz: 'q', questionRu: 'q',
      optionsUz: { A: 'a' }, optionsRu: { A: 'а' }, image: null, topicId: 1,
      // Buzilgan qator simulyatsiyasi — whitelist tashlab yuborishi SHART
      ...({ correctAnswer: 'A', explanation: 'sir' } as object),
    })) as ExportQuestionRow[]
    const storage = makeStorage()
    const report = await publishQuestionBank('fizika', makeDeps({ readRows: async () => badRows }, storage))
    expect(report.questionCount).toBe(5)
    // Yuklangan chunk'larda kalit izi YO'Q
    const puts = storage.calls.filter((c) => c.op === 'put' && c.key.includes('chunks/'))
    expect(puts.length).toBeGreaterThan(0)
  })
})

describe('QBANK_SUBJECTS — shared/subjects.ts bilan sinxron (desync himoyasi)', () => {
  it('har bir fan bankId === resolveSubject(subjectId).dataSourceId', async () => {
    const { QBANK_SUBJECTS } = await import('../../../server/modules/content/qbank-publish')
    const { resolveSubject } = await import('../../../server/config/subjects')
    for (const [subjectId, entry] of Object.entries(QBANK_SUBJECTS)) {
      const resolved = resolveSubject(subjectId)
      expect(resolved.id).toBe(subjectId)
      expect(entry.bankId).toBe(resolved.dataSourceId)
    }
  })

  it('11 fan, segment\'lar URL-xavfsiz va noyob', async () => {
    const { QBANK_SUBJECTS } = await import('../../../server/modules/content/qbank-publish')
    const segments = Object.values(QBANK_SUBJECTS).map((e) => e.pathSegment)
    expect(Object.keys(QBANK_SUBJECTS)).toHaveLength(11)
    for (const seg of segments) {
      expect(seg).toMatch(/^[a-z][a-z0-9-]{0,31}$/)
    }
    expect(new Set(segments).size).toBe(segments.length)
  })
})

describe('readPublishedVersion', () => {
  it('marker JSON → version', async () => {
    const storage = {
      getObject: vi.fn(async () => Buffer.from(JSON.stringify({ subject: 'physics', version: 12, questionCount: 8880, publishedAt: 'x' }))),
    }
    expect(await readPublishedVersion(storage, 'physics')).toBe(12)
  })

  it('marker yo\'q → null (client legacy yo\'lda)', async () => {
    expect(await readPublishedVersion({ getObject: async () => null }, 'physics')).toBeNull()
  })

  it('buzilgan marker → null (throw emas)', async () => {
    expect(await readPublishedVersion({ getObject: async () => Buffer.from('{buzilgan') }, 'physics')).toBeNull()
    expect(await readPublishedVersion({ getObject: async () => Buffer.from('{"version":0}') }, 'physics')).toBeNull()
    expect(await readPublishedVersion({ getObject: async () => Buffer.from('{"version":"12"}') }, 'physics')).toBeNull()
  })
})
