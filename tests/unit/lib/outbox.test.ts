/**
 * FE-1 regression — Outbox retry siyosati:
 * attempts FAQAT server javobida sarflanadi; tarmoq/offline urinishlari
 * MAX_ATTEMPTS byudjetini yemaydi (100-savol offline testda javoblar
 * yo'qolardi). localStorage/navigator node'da yo'q — stubGlobal bilan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../../src/shared/api'

const postResult = vi.fn()

// outbox.ts `../api` import'ini ushlaymiz — ApiError'ni AKTUAL qoldiramiz
// (outbox ichidagi `instanceof ApiError` mock class'ga adashmasligi uchun).
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { postResult: (...args: unknown[]) => postResult(...args) } }
})

// ── Brauzer global'lari (node muhiti) ──────────────────────────────────────
const store = new Map<string, string>()
const localStorageMock = {
  getItem:    (k: string) => store.get(k) ?? null,
  setItem:    (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear:      () => store.clear(),
}
vi.stubGlobal('localStorage', localStorageMock)

async function freshOutbox() {
  // Modul state'i (flushing/locklar) testlar orasida oqmasin
  return import('../../../src/shared/lib/outbox')
}

const ENTRY = { questionId: 1, selectedAnswer: 'a', subjectId: 'yhq', date: '2026-08-11', clientToken: 'tok-1' }

beforeEach(() => {
  vi.resetModules()
  postResult.mockReset()
  store.clear()
  vi.stubGlobal('navigator', { onLine: true })
})

describe('flushOutbox retry siyosati', () => {
  it("tarmoq xatosi (TypeError) — attempts SARFLANMAYDI, 25+ flushda ham saqlanadi", async () => {
    postResult.mockRejectedValue(new TypeError('fetch failed'))
    const { enqueueOutbox, getOutboxEntries, flushOutbox } = await freshOutbox()

    enqueueOutbox('u1', 'result', { ...ENTRY })
    // 100-savol offline test simulatsiyasi: har enqueue flush trigger qilardi
    for (let i = 0; i < 30; i++) await flushOutbox('u1')

    const entries = getOutboxEntries('u1')
    expect(entries).toHaveLength(1)            // eski kodda tashlab yuborilardi!
    expect(entries[0].attempts).toBe(0)        // serverga yetib bormagan = bepul
    expect(postResult).toHaveBeenCalled()      // urinilgan, lekin muvaffaqiyatsiz
  })

  it('navigator.onLine=false — fetch umuman urinmaydi, navbat butun', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    postResult.mockRejectedValue(new TypeError('fetch failed'))
    const { enqueueOutbox, getOutboxEntries, flushOutbox } = await freshOutbox()

    enqueueOutbox('u1', 'result', { ...ENTRY })
    await flushOutbox('u1')

    expect(postResult).not.toHaveBeenCalled()  // 8s abort-timeout ham kutilmagan
    const entries = getOutboxEntries('u1')
    expect(entries).toHaveLength(1)
    expect(entries[0].attempts).toBe(0)
  })

  it('5xx (server javob berdi) — attempts bump, MAX_ATTEMPTSdan keyin drop', async () => {
    postResult.mockRejectedValue(new ApiError(500, 'POST /x → 500: Internal'))
    const { enqueueOutbox, getOutboxEntries, flushOutbox } = await freshOutbox()

    enqueueOutbox('u1', 'result', { ...ENTRY })
    await flushOutbox('u1')
    expect(getOutboxEntries('u1')[0]?.attempts).toBe(1)

    for (let i = 0; i < 30; i++) await flushOutbox('u1')
    expect(getOutboxEntries('u1')).toHaveLength(0)  // zombi himoyasi ishlaydi
  })

  it('4xx fatal — darhol tashlanadi (qayta urinish befoyda)', async () => {
    postResult.mockRejectedValue(new ApiError(400, 'POST /x → 400: bad request', 'invalid_question'))
    const { enqueueOutbox, getOutboxEntries, flushOutbox } = await freshOutbox()

    enqueueOutbox('u1', 'result', { ...ENTRY })
    await flushOutbox('u1')

    expect(getOutboxEntries('u1')).toHaveLength(0)
    expect(postResult).toHaveBeenCalledTimes(1)
  })
})
