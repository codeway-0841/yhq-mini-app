/**
 * EGRESS regression-guard (2026-09-24, AUDIT-NEON-EGRESS) — source-level tekshiruvlar.
 * Kelajakdagi tahrirlar quyidagilarni qayta KIRITMASLIGI kerak:
 *
 *  1) server boot'da loadOctagonPools() — 11 bank (52.7MB) SELECT * har
 *     Render uyqu/uyg'onish + deploy'da (overage #1 manbai).
 *  2) AdminQuestionsTab'da useQuestionsStore...reload() — har admin tahrirda
 *     `_t=Date.now()` cache-bust bilan butun bank (5-13MB) qayta tortilardi
 *     (overage #4 manbai). Client endi content_version orqali yangilanadi.
 *  3) /api/questions full-bank yo'li provider.getAllQuestions() (correctAnswer'li)
 *     o'rniga getPublicQuestions() ishlatishi SHART (overage #3 manbai).
 *  4) /api/questions/version butun bankni md5'lamaydi — faqat content_version
 *     counter (provider.getAllQuestions bank-version.ts'da YO'Q).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

describe('EGRESS regression — server boot 0 bank yuklaydi', () => {
  it("server/index.ts boot'da loadOctagonPools'ga TEGMAYDI (lazy ensurePool)", () => {
    const src = readSrc('server/index.ts')
    expect(src).not.toContain('loadOctagonPools')
    expect(src).toContain('attachOctagon')
  })

  it("octagon gateway duel'dan OLDIN ensurePool'ni kutadi (lazy pool)", () => {
    const src = readSrc('server/modules/octagon/octagon.gateway.ts')
    expect(src).toContain('ensurePool(subjectId)')
  })
})

describe('EGRESS regression — admin CRUD client bankni qayta TORTMAYDI', () => {
  it("AdminQuestionsTab'da useQuestionsStore.reload() YO'Q", () => {
    const src = readSrc('src/features/admin/components/AdminQuestionsTab.tsx')
    expect(src).not.toContain('useQuestionsStore.getState().reload')
    expect(src).not.toContain("from '../../../shared/store/useQuestionsStore'")
  })
})

describe("EGRESS regression — public endpoint'larga correct_answer tortilmaydi", () => {
  it('/api/questions full-bank yo\'li getPublicQuestions ishlatadi', () => {
    const src = readSrc('server/modules/questions/questions.router.ts')
    expect(src).toContain('provider.getPublicQuestions()')
    // To'liq (correctAnswer'li) o'qish faqat octagon/admin yo'llarida qolishi kerak:
    expect(src).not.toContain('provider.getAllQuestions()')
  })

  it('/api/questions?topicId= yo\'li ham kalitsiz (getPublicQuestionsByTopic)', () => {
    const src = readSrc('server/modules/questions/questions.router.ts')
    expect(src).toContain('provider.getPublicQuestionsByTopic(')
    expect(src).not.toContain('provider.getQuestionsByTopic(')
  })

  it("bank-version.ts butun bankni o'qimaydi (md5-full-bank YO'Q)", () => {
    const src = readSrc('server/modules/questions/bank-version.ts')
    expect(src).not.toContain('getAllQuestions')
    expect(src).toContain('questionBanks.contentVersion')
  })
})

describe('EGRESS regression — R2 qbank eksporti (fizika pilot)', () => {
  it('exporter Neon\'dan EXPLICIT proyeksiya o\'qiydi — select() (SELECT *) YO\'Q', () => {
    const src = readSrc('server/modules/content/qbank-publish.ts')
    // SELECT * taqiqlangan: ustunlar aniq sanalgan (correctAnswer kirmaydi)
    expect(src).not.toMatch(/\.select\(\s*\)/)
    expect(src).toContain('externalId: questions.externalId')
    expect(src).not.toContain('questions.correctAnswer')
    expect(src).not.toContain('correctAnswer')
  })

  it('exporter xavfsizlik skani bilan (assertExportClean + validateExport)', () => {
    const src = readSrc('server/modules/content/qbank-publish.ts')
    expect(src).toContain('assertExportClean')
    expect(src).toContain('validateExport')
  })

  it('marker ENG OXIRIDA yoziladi (atomik publish) — verify\'dan keyin', () => {
    const src = readSrc('server/modules/content/qbank-publish.ts')
    const verifyIdx = src.indexOf('qbank_publish_verify_failed')
    const markerIdx = src.indexOf('markerKey(pathSegment),')
    expect(verifyIdx).toBeGreaterThan(-1)
    expect(markerIdx).toBeGreaterThan(verifyIdx)
  })

  it('exporter server boot va runtime router\'larga KIRMAYDI (CLI-only)', () => {
    expect(readSrc('server/index.ts')).not.toContain('export-question-bank')
    expect(readSrc('server/index.ts')).not.toContain('publishQuestionBank')
    // Octagon lazy-pool arxitekturasi buzilmaydi
    expect(readSrc('server/index.ts')).not.toContain('loadOctagonPools')
  })

  it('/questions/version butun bankni o\'qimaydi — faqat counter + (fizika) marker', () => {
    const src = readSrc('server/modules/questions/questions.router.ts')
    // r2v kompozitsiyasi mavjud, lekin full-bank o'qish yo'q
    expect(src).toContain('getPublishedVersion')
    expect(src).not.toContain('getAllQuestions')
  })

  it('Worker R2 key\'ini FAQAT parse-segmentlardan quradi (xom URL emas)', () => {
    const src = readSrc('workers/question-content/src/index.ts')
    expect(src).toContain('env.QBANK.get(path.key)')
    // Xom so'rov URL'i key sifatida ishlatilmasligi shart
    expect(src).not.toContain('QBANK.get(url')
    expect(src).not.toContain('QBANK.get(request.url')
  })
})
