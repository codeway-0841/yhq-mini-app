/**
 * QBANK EXPORT CORE — xavfsizlik va to'g'rilik testlari.
 *
 * Kritik invariantlar (scoring trust boundary):
 *  - correctAnswer / correct_answer / answerKey HECH QAYERDA yo'q:
 *    manifest'da ham, chunk JSON'larida ham (kalit skani + serialize regex);
 *  - savollar/mavzular soni manba bilan bir xil;
 *  - manifest'dagi har bir chunk fayl MAVJUD (va yolg'iz chunk yo'q);
 *  - chunk savollari yig'indisi == bank savollari soni;
 *  - deterministik: bir xil kirish → bayt-bayt bir xil chiqish;
 *  - base64/data: rasm JSON'ga kirmaydi.
 */
import { describe, it, expect } from 'vitest'
import {
  buildBankExport,
  sanitizeQuestion,
  assertNoAnswerKeys,
  assertJsonClean,
  assertExportClean,
  validateExport,
  type ExportQuestionRow,
} from '../../../server/modules/content/qbank-export'

const row = (id: number, topicId: number | null = 1, image: string | null = null): ExportQuestionRow => ({
  id,
  externalId: `ftp-${id}`,
  questionUz: `Savol matni ${id}`,
  questionRu: `Вопрос ${id}`,
  optionsUz: { A: `variant A${id}`, B: `variant B${id}`, C: `variant C${id}`, D: `variant D${id}` },
  optionsRu: { A: `вариант А${id}`, B: `вариант Б${id}`, C: `вариант В${id}`, D: `вариант Г${id}` },
  image,
  topicId,
})

function makeBank(questionCount: number, topicCount: number): { rows: ExportQuestionRow[]; topicIds: number[] } {
  const topicIds = Array.from({ length: topicCount }, (_, i) => i + 1)
  const rows = Array.from({ length: questionCount }, (_, i) => row(i + 1, topicIds[i % topicCount]!))
  return { rows, topicIds }
}

describe('sanitizeQuestion — WHITELIST proyeksiya', () => {
  it('faqat publik maydonlar qoladi (id/externalId/topicId/question/options/image)', () => {
    const clean = sanitizeQuestion(row(5, 2, '/physics-print/x.webp'))
    expect(Object.keys(clean).sort()).toEqual(
      ['externalId', 'id', 'image', 'optionsRu', 'optionsUz', 'questionRu', 'questionUz', 'topicId'],
    )
  })

  it('resolveImage DB yo\'lini R2 ref\'ga o\'giradi', () => {
    const clean = sanitizeQuestion(row(5, 2, '/physics-print/x.webp'), () => '/images/physics/abc123.webp')
    expect(clean.image).toBe('/images/physics/abc123.webp')
  })

  it('resolveImage null qaytarsa — ESKI yo\'l saqlanadi (graceful fallback)', () => {
    const clean = sanitizeQuestion(row(5, 2, '/physics-print/x.webp'), () => null)
    expect(clean.image).toBe('/physics-print/x.webp')
  })

  it('base64/data: rasm JSON\'ga KIRMAYDI (alohida obyekt bo\'lishi shart)', () => {
    const clean = sanitizeQuestion(row(5, 2, 'data:image/webp;base64,AAAA'))
    expect(clean.image).toBeNull()
  })
})

describe('assertNoAnswerKeys / assertJsonClean — javob kaliti skani', () => {
  it.each([
    [{ correctAnswer: 'a' }],
    [{ correct_answer: 'a' }],
    [{ answerKey: 'a' }],
    [{ nested: { deep: { correctAnswer: 'a' } } }],
    [[{ items: [{ correct: 'a' }] }]],
    [{ explanation: 'text' }],
    [{ solutionText: 'x' }],
  ])('taqiqlangan kalit → THROW: %j', (value) => {
    expect(() => assertNoAnswerKeys(value)).toThrow(/forbidden_key/)
  })

  it('publik shakl (chunk savoli) — throw YO\'Q', () => {
    expect(() => assertNoAnswerKeys(sanitizeQuestion(row(1)))).not.toThrow()
  })

  it('serialize JSON\'da forbidden kalit → THROW', () => {
    expect(() => assertJsonClean('{"correctAnswer":"a"}', 'test')).toThrow(/forbidden_json/)
    expect(() => assertJsonClean('{"correct_answer":"a"}', 'test')).toThrow(/forbidden_json/)
    expect(() => assertJsonClean('{"id":1,"questionUz":"ok"}', 'test')).not.toThrow()
  })
})

describe('buildBankExport — chunking va manifest', () => {
  it('kichik mavzular PACKED: kam chunk, har mavzu aniq 1 chunk\'da', () => {
    // 60 savol × 20 mavzu (3 per mavzu) — bitta chunk'ga sig'adi
    const { rows, topicIds } = makeBank(60, 20)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 12, rows, topicIds,
      generatedAt: '2026-09-24T00:00:00.000Z', targetChunkBytes: 150 * 1024,
    })
    expect(artifacts.chunks.size).toBe(1)
    expect(artifacts.manifest.questionCount).toBe(60)
    expect(artifacts.manifest.topics).toHaveLength(20)
    for (const topic of artifacts.manifest.topics) {
      expect(topic.chunks).toEqual(['chunks/chunk-001.json'])
      expect(topic.questionCount).toBe(3)
    }
    expect(artifacts.manifest.files).toEqual([
      { path: 'chunks/chunk-001.json', bytes: expect.any(Number), questionCount: 60 },
    ])
    expect(() => assertExportClean(artifacts)).not.toThrow()
    expect(() => validateExport(artifacts, { questionCount: 60, topicIds })).not.toThrow()
  })

  it('target oshganda yangi chunk ochiladi (byte-size asosida)', () => {
    const { rows, topicIds } = makeBank(200, 40)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds,
      generatedAt: '2026-01-01T00:00:00.000Z', targetChunkBytes: 4 * 1024, // 4KB — ko'p chunk
    })
    expect(artifacts.chunks.size).toBeGreaterThan(3)
    // Har mavzu aniq 1 chunk'da (packed — katta mavzu yo'q bu yerda)
    for (const topic of artifacts.manifest.topics) {
      expect(topic.chunks).toHaveLength(1)
    }
    // Chunk'lar yig'indisi == bank savollari
    const total = artifacts.manifest.files.reduce((s, f) => s + f.questionCount, 0)
    expect(total).toBe(200)
    expect(() => validateExport(artifacts, { questionCount: 200, topicIds })).not.toThrow()
  })

  it('juda katta mavzu bir necha chunk\'ga BO\'LINADI (manifest chunks massiv)', () => {
    // 1 katta mavzu (~1.2KB × 40 ≈ 48KB) — minimum target (16KB) dan katta
    const topicIds = [7]
    const bigText = 'ABCDEFGH'.repeat(150)
    const rows = Array.from({ length: 40 }, (_, i) => ({
      ...row(i + 1, 7), questionUz: `${bigText} ${i}`,
    }))
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds,
      generatedAt: '2026-01-01T00:00:00.000Z', targetChunkBytes: 16 * 1024,
    })
    const topic = artifacts.manifest.topics[0]!
    expect(topic.questionCount).toBe(40)
    expect(topic.chunks.length).toBeGreaterThan(1)
    const total = artifacts.manifest.files.reduce((s, f) => s + f.questionCount, 0)
    expect(total).toBe(40)
    expect(() => validateExport(artifacts, { questionCount: 40, topicIds })).not.toThrow()
  })

  it('chunk JSON\'da correctAnswer izi YO\'Q (serialize skan)', () => {
    const { rows, topicIds } = makeBank(30, 5)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds, generatedAt: '2026-01-01T00:00:00.000Z',
    })
    for (const json of artifacts.chunks.values()) {
      expect(json).not.toMatch(/correctAnswer|correct_answer|answerKey|answer_key/)
    }
    expect(artifacts.manifestJson).not.toMatch(/correctAnswer|correct_answer|answerKey/)
  })

  it('DETERMINISTIK: bir xil kirish → bayt-bayt bir xil chiqish', () => {
    const { rows, topicIds } = makeBank(100, 10)
    const opts = {
      subject: 'physics', contentVersion: 5, rows, topicIds,
      generatedAt: '2026-01-01T00:00:00.000Z', targetChunkBytes: 8 * 1024,
    }
    const a = buildBankExport(opts)
    const b = buildBankExport(opts)
    expect(a.manifestJson).toBe(b.manifestJson)
    expect([...a.chunks.keys()]).toEqual([...b.chunks.keys()])
    for (const [path, json] of a.chunks) {
      expect(b.chunks.get(path)).toBe(json)
    }
  })

  it('mavzu-ichida id o\'sish + mavzular o\'sish tartibida (client global qayta tartiblaydi)', () => {
    const { rows, topicIds } = makeBank(40, 4)
    // Aralashtirib yuboramiz — export o'zi tartiblashi shart
    const shuffled = [...rows].reverse()
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows: shuffled, topicIds, generatedAt: '2026-01-01T00:00:00.000Z',
    })
    // Chunk'lardagi yassi tartib = (topicId, id) bo'yicha saralangan — aniq
    // deterministik invariant (packed chunk'da mavzular ketma-ket yoziladi).
    const flat = [...artifacts.chunks.values()]
      .flatMap((json) => (JSON.parse(json) as { questions: Array<{ id: number; topicId: number | null }> }).questions)
    const expected = [...rows].sort((a, b) =>
      (a.topicId ?? Number.MAX_SAFE_INTEGER) - (b.topicId ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    )
    expect(flat.map((q) => q.id)).toEqual(expected.map((q) => q.id))
    // Har bir TOPIC SEGMENTI ichida id'lar o'suvchi
    for (const json of artifacts.chunks.values()) {
      const ids = (JSON.parse(json) as { questions: Array<{ id: number; topicId: number | null }> }).questions
      let lastTopic: number | null = null
      let lastId = -1
      for (const q of ids) {
        if (q.topicId === lastTopic) expect(q.id).toBeGreaterThan(lastId)
        lastTopic = q.topicId
        lastId = q.id
      }
    }
    // Manifest mavzulari o'suvchi id tartibida
    const tids = artifacts.manifest.topics.map((t) => t.topicId)
    expect(tids).toEqual([...tids].sort((a, b) => (a ?? 0) - (b ?? 0)))
    // Umumiy qamrov: hamma savol bor
    const allIds = [...artifacts.chunks.values()]
      .flatMap((json) => (JSON.parse(json) as { questions: Array<{ id: number }> }).questions)
      .map((q) => q.id)
    expect([...allIds].sort((a, b) => a - b)).toEqual(rows.map((r) => r.id).sort((a, b) => a - b))
  })
})

describe('validateExport — publish gate', () => {
  it('savollar soni mos kelmasa → THROW', () => {
    const { rows, topicIds } = makeBank(10, 2)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds, generatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(() => validateExport(artifacts, { questionCount: 11, topicIds })).toThrow(/count_mismatch/)
  })

  it('manifest chunk ref\'i o\'chirilsa → THROW (orphan)', () => {
    const { rows, topicIds } = makeBank(10, 2)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds, generatedAt: '2026-01-01T00:00:00.000Z',
    })
    const first = [...artifacts.chunks.keys()][0]!
    artifacts.chunks.delete(first)
    expect(() => validateExport(artifacts, { questionCount: 10, topicIds })).toThrow(/missing|orphan/)
  })

  it('noma\'lum mavzu (katalogda yo\'q) → THROW', () => {
    const { rows } = makeBank(10, 2)
    const artifacts = buildBankExport({
      subject: 'physics', contentVersion: 1, rows, topicIds: [99], generatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(() => validateExport(artifacts, { questionCount: 10, topicIds: [99] })).toThrow(/unknown_topic/)
  })
})
