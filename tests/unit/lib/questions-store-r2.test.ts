/**
 * useQuestionsStore — R2/Worker yo'li integratsiyasi (fizika pilot).
 *
 * Invariantlar (TEST PLAN #22–#27):
 *  - flag ON + fizika + r2v → R2 loader ishlatiladi (legacy fetch YO'Q);
 *  - r2v yo'q → legacy /api/questions (server-side kill switch);
 *  - flag OFF → legacy (r2v bo'lsa ham);
 *  - fizika EMAS fan → legacy;
 *  - R2 xato → legacy fallback + qbank_r2_fallback telemetry (jim emas!);
 *  - IndexedDB versiya match ('r2:cv12') → tarmoq fetch'siz;
 *  - versiya o'zgarishi → yangi manifest/chunk fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  flagOn: true,
  r2v: 'cv12' as string | undefined,
  legacyV: 'cv15',
  r2Error: null as Error | null,
  cached: null as { subjectId: string; v: string; raw: unknown[]; topics: unknown[] } | null,
  written: [] as Array<{ v: string }>,
  trackEvents: [] as Array<{ event: string; props: Record<string, unknown> }>,
  subjectId: 'fizika',
}))

vi.mock('../../../src/shared/config', () => ({
  config: {
    get r2QuestionBank() { return h.flagOn },
    contentWorkerUrl: 'https://content.kivvi.uz',
    apiBaseUrl: '/api',
  },
}))

vi.mock('../../../src/shared/lib/r2-question-bank', () => ({
  loadSubjectBankR2: vi.fn(async (version: string) => {
    if (h.r2Error) throw h.r2Error
    return [
      { id: 1, questionUz: 'S1', questionRu: 'V1', optionsUz: { A: 'a' }, optionsRu: { A: 'а' }, image: null, topicId: 1 },
      { id: 2, questionUz: 'S2', questionRu: 'V2', optionsUz: { A: 'a' }, optionsRu: { A: 'а' }, image: '/images/physics/0123456789abcdef.webp', topicId: 1 },
    ]
  }),
}))

vi.mock('../../../src/shared/lib/question-bank-cache', () => ({
  readBankCache: vi.fn(async () => h.cached),
  writeBankCache: vi.fn(async (entry: { v: string }) => { h.written.push(entry) }),
}))

vi.mock('../../../src/shared/lib/analytics', () => ({
  track: vi.fn((event: string, props: Record<string, unknown>) => { h.trackEvents.push({ event, props }) }),
}))

const LEGACY_ROWS = [
  { id: 10, questionUz: 'L1', questionRu: 'L1', optionsUz: { A: 'a' }, optionsRu: { A: 'а' }, image: null, topicId: 1 },
]

async function freshStore() {
  vi.resetModules()
  const { api } = await import('../../../src/shared/api')
  vi.spyOn(api, 'getQuestionsVersion').mockImplementation(async () =>
    ({ v: h.legacyV, ...(h.r2v !== undefined ? { r2v: h.r2v } : {}) }))
  const getQuestions = vi.spyOn(api, 'getQuestions').mockImplementation(async () => LEGACY_ROWS)
  vi.spyOn(api, 'getTopics').mockImplementation(async () => [{ id: 1, nameUz: 'M', nameRu: 'M', slug: 'm' }])
  const { loadSubjectBankR2 } = await import('../../../src/shared/lib/r2-question-bank')
  const { useQuestionsStore } = await import('../../../src/shared/store/useQuestionsStore')
  return { store: useQuestionsStore, getQuestions, loadSubjectBankR2: vi.mocked(loadSubjectBankR2) }
}

beforeEach(() => {
  h.flagOn = true
  h.r2v = 'cv12'
  h.legacyV = 'cv15'
  h.r2Error = null
  h.cached = null
  h.written = []
  h.trackEvents = []
})

describe('useQuestionsStore — R2 yo\'li (flag ON)', () => {
  it('fizika + r2v → R2 loader, legacy fetch CHAQIRILMAYDI, kesh "r2:" prefiksli', async () => {
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(loadSubjectBankR2).toHaveBeenCalledWith('fizika', 'cv12')
    expect(getQuestions).not.toHaveBeenCalled()
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().questions.map((q) => q.id)).toEqual([1, 2])
    expect(h.written[0]?.v).toBe('r2:cv12')
    expect(h.trackEvents).toHaveLength(0)
  })

  it('kesh "r2:cv12" bilan match → TARMOQ FETCH YO\'Q (na R2, na legacy)', async () => {
    h.cached = { subjectId: 'fizika', v: 'r2:cv12', raw: LEGACY_ROWS, topics: [] }
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(loadSubjectBankR2).not.toHaveBeenCalled()
    expect(getQuestions).not.toHaveBeenCalled()
    expect(store.getState().loaded).toBe(true)
  })

  it('versiya o\'zgarishi (r2:cv12 → r2:cv13) → yangi R2 fetch', async () => {
    h.cached = { subjectId: 'fizika', v: 'r2:cv12', raw: LEGACY_ROWS, topics: [] }
    h.r2v = 'cv13'
    const { store, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(loadSubjectBankR2).toHaveBeenCalledWith('fizika', 'cv13')
    expect(h.written[0]?.v).toBe('r2:cv13')
  })

  it('R2 xato → legacy fallback + qbank_r2_fallback TELEMETRY + bank baribir yuklanadi', async () => {
    h.r2Error = new Error('r2_http_500')
    const { store, getQuestions } = await freshStore()
    await store.getState().load('uz', 'fizika')

    // Fallback legacy'dan yukladi
    expect(getQuestions).toHaveBeenCalled()
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().questions.map((q) => q.id)).toEqual([10])
    // Telemetry JIM EMAS — fallback o'lchanadi
    expect(h.trackEvents).toEqual([
      { event: 'qbank_r2_fallback', props: expect.objectContaining({ subjectId: 'fizika' }) },
    ])
    // Kesh LEGACY versiya bilan yoziladi (keyingi launch'da qayta solishtiriladi)
    expect(h.written[0]?.v).toBe('cv15')
  })
})

describe('useQuestionsStore — legacy yo\'l (kill switch holatlari)', () => {
  it('r2v YO\'Q (server publish qilmagan) → legacy fetch', async () => {
    h.r2v = undefined
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(loadSubjectBankR2).not.toHaveBeenCalled()
    expect(getQuestions).toHaveBeenCalled()
    expect(h.written[0]?.v).toBe('cv15')
  })

  it('flag OFF → legacy (r2v bo\'lsa ham)', async () => {
    h.flagOn = false
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(loadSubjectBankR2).not.toHaveBeenCalled()
    expect(getQuestions).toHaveBeenCalled()
  })

  it('boshqa fan (yhq) + r2v → R2 loader (subjectId uzatiladi)', async () => {
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'yhq')

    expect(loadSubjectBankR2).toHaveBeenCalledWith('yhq', 'cv12')
    expect(getQuestions).not.toHaveBeenCalled()
    expect(store.getState().loaded).toBe(true)
    expect(h.written[0]?.v).toBe('r2:cv12')
  })

  it('boshqa fan (yhq) + r2v YO\'Q → legacy (per-fan gate)', async () => {
    h.r2v = undefined
    const { store, getQuestions, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'yhq')

    expect(loadSubjectBankR2).not.toHaveBeenCalled()
    expect(getQuestions).toHaveBeenCalledWith('yhq')
  })

  it('kesh legacy "cv15" + server legacy v bir xil → fetch YO\'Q', async () => {
    h.r2v = undefined
    h.cached = { subjectId: 'fizika', v: 'cv15', raw: LEGACY_ROWS, topics: [] }
    const { store, getQuestions } = await freshStore()
    await store.getState().load('uz', 'fizika')

    expect(getQuestions).not.toHaveBeenCalled()
    expect(store.getState().loaded).toBe(true)
  })

  it('manba aralashmasligi: kesh legacy "cv12" + server r2v "cv12" → R2 QAYTA tortiladi (prefiks farqi)', async () => {
    // Legacy kesh raw format ('cv12'), R2 kutilmasi esa 'r2:cv12' —
    // counter'lar tasodifan bir xil ko'rinsa ham manbalar aralashmaydi.
    h.cached = { subjectId: 'fizika', v: 'cv12', raw: LEGACY_ROWS, topics: [] }
    const { store, loadSubjectBankR2 } = await freshStore()
    await store.getState().load('uz', 'fizika')

    // "db:cv12" !== "r2:cv12" — kesh yaroqsiz, R2'dan yangilanadi
    expect(loadSubjectBankR2).toHaveBeenCalled()
  })
})
