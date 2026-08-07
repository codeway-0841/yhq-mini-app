/**
 * Unit tests for Offline Sync Center (mutation outbox).
 * User-scoped navbat, retry siyosati (4xx drop / network keep) va
 * account isolation tekshiriladi.
 * Run with: npx vitest tests/unit/lib/outbox.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// api modulini mock qilamiz — haqiqiy tarmoq chaqirig'i bo'lmasligi shart.
// Partial mock: ApiError CLASS'ning haqiqiy identitetini saqlaymiz
// (outbox instanceof tekshiruvi shunga bog'liq).
vi.mock('../../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/api')>()
  return {
    ...actual,
    api: {
      postResult:   vi.fn(),
      addSaved:     vi.fn(),
      removeSaved:  vi.fn(),
      addDailyFix:  vi.fn(),
    },
  }
})

import { api } from '../../../src/lib/api'
import {
  enqueueOutbox, flushOutbox, getOutboxEntries, getOutboxCount, setResultSyncHandler,
} from '../../../src/lib/outbox'

const memory = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v) },
  removeItem: (k: string) => { memory.delete(k) },
}

beforeEach(() => {
  memory.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', localStorageStub)
  // Har yozuvga UNIQUE id — bir xil id bo'lsa removeEntry ikkalasini ham o'chiradi
  vi.stubGlobal('crypto', (() => { let n = 0; return { randomUUID: () => `test-uuid-${++n}` } })())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** enqueue ichidagi fon flush'ning yakunlanishini kutadi */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
}

describe('outbox — muvaffaqiyatli sync', () => {
  it('enqueue + flush: yozuv serverga yuborilib navbatdan o\'chadi', async () => {
    vi.mocked(api.addSaved).mockResolvedValue({ ok: true })
    enqueueOutbox('u1', 'saved-add', { questionId: 42, subjectId: 'fizika' })
    await settle()

    expect(api.addSaved).toHaveBeenCalledWith('u1', 42, 'fizika')
    expect(getOutboxEntries('u1')).toHaveLength(0)
  })

  it('eski (subjectId\'siz) navbat yozuvlari default fan bilan yuboriladi', async () => {
    vi.mocked(api.removeSaved).mockResolvedValue({ ok: true })
    enqueueOutbox('u1', 'saved-remove', { questionId: 42 })
    await settle()

    expect(api.removeSaved).toHaveBeenCalledWith('u1', 42, 'yhq')
  })

  it('result replay server javobidagi streak\'ni handler\'ga yetkazadi', async () => {
    const handler = vi.fn()
    setResultSyncHandler(handler)
    vi.mocked(api.postResult).mockResolvedValue({ ok: true, correct: true, dailyStreak: 3 })

    enqueueOutbox('u1', 'result', { questionId: 7, selectedAnswer: 'F2', subjectId: 'yhq', date: '2026-08-07' })
    await settle()

    expect(api.postResult).toHaveBeenCalledWith('u1', { questionId: 7, selectedAnswer: 'F2', subjectId: 'yhq' })
    expect(handler).toHaveBeenCalledWith('2026-08-07', 'yhq', 3)
    expect(getOutboxCount('u1')).toBe(0)
  })

  it('bir nechta yozuv KETMA-KETLIKda yuboriladi', async () => {
    const order: string[] = []
    vi.mocked(api.addSaved).mockImplementation(async (_u, id) => { order.push(`add:${id}`); return { ok: true } })
    vi.mocked(api.removeSaved).mockImplementation(async (_u, id) => { order.push(`remove:${id}`); return { ok: true } })

    enqueueOutbox('u1', 'saved-add', { questionId: 1 })
    await flushOutbox('u1')
    enqueueOutbox('u1', 'saved-remove', { questionId: 2 })
    await settle()

    expect(order).toEqual(['add:1', 'remove:2'])
  })
})

describe('outbox — retry siyosati', () => {
  it('tarmoq xatosida yozuv navbatda qoladi (attempts oshadi)', async () => {
    vi.mocked(api.addSaved).mockRejectedValue(new Error('fetch failed'))
    enqueueOutbox('u1', 'saved-add', { questionId: 5 })
    await settle()

    const entries = getOutboxEntries('u1')
    expect(entries).toHaveLength(1)
    expect(entries[0].attempts).toBeGreaterThanOrEqual(1)
    expect(entries[0].lastError).toContain('fetch failed')
  })

  it('4xx — server rad etdi: yozuv TASHLAB YUBORILADI (loop bo\'lmasligi uchun)', async () => {
    vi.mocked(api.removeSaved).mockRejectedValue(new Error('DELETE /saved/u1/9 → 400: invalid questionId'))
    enqueueOutbox('u1', 'saved-remove', { questionId: 9 })
    await settle()

    expect(getOutboxEntries('u1')).toHaveLength(0)
  })

  it('429 — rad emas, navbatda qoladi (keyin qayta uriniladi)', async () => {
    vi.mocked(api.addSaved).mockRejectedValue(new Error('POST /saved/u1 → 429: too many'))
    enqueueOutbox('u1', 'saved-add', { questionId: 3 })
    await settle()
    expect(getOutboxEntries('u1')).toHaveLength(1)
  })

  it('keyingi flush yozuvni muvaffaqiyatli yetkazadi (retry)', async () => {
    vi.mocked(api.addSaved)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true })

    enqueueOutbox('u1', 'saved-add', { questionId: 8 })
    await settle()
    expect(getOutboxEntries('u1')).toHaveLength(1)

    await flushOutbox('u1')
    expect(getOutboxEntries('u1')).toHaveLength(0)
    expect(api.addSaved).toHaveBeenCalledTimes(2)
  })
})

describe('outbox — account isolation', () => {
  it('navbat userId bilan namespace\'langan — boshqa user ko\'rmaydi/yubormaydi', async () => {
    vi.mocked(api.addSaved).mockRejectedValue(new Error('offline'))
    enqueueOutbox('user-A', 'saved-add', { questionId: 11 })
    await settle()

    // Boshqa user bo'sh: A'ning navbati B nomidan YUBORILMAYDI
    expect(getOutboxEntries('user-B')).toHaveLength(0)

    vi.mocked(api.addSaved).mockResolvedValue({ ok: true })
    await flushOutbox('user-B')
    expect(api.addSaved).not.toHaveBeenCalledWith('user-B', expect.anything())
    expect(getOutboxEntries('user-A')).toHaveLength(1) // A'niki saqlangan
  })

  it('ghost user (id=0) uchun navbat yozilmaydi', () => {
    enqueueOutbox('0', 'saved-add', { questionId: 1 })
    enqueueOutbox('', 'saved-add', { questionId: 2 })
    expect(memory.size).toBe(0)
  })
})
