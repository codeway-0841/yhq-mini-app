import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../../../src/shared/api'

/**
 * api.warmUp() regression-guard (src/shared/api/index.ts):
 * serverless backend (Vercel fn + Neon DB) idle'dan keyin SUSPEND bo'ladi —
 * testdagi 1-javob cold start (5-8s) tufayli 8s timeout'ga urilib "offline"ga
 * tushardi. Test sahifalari mount'da `/ready` ping'i yuboradi (DB ping —
 * funksiya HAM, Neon compute HAM uyg'onadi). Fire-and-forget: javob kodi
 * va tarmoq xatosi caller'ga HECH QACHON qaytmasligi shart.
 */
describe('api.warmUp — serverless cold-start ping', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("/ready endpoint'iga ping yuboradi", () => {
    const fetchMock = vi.fn(async () => new Response('{"status":"ready"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    api.warmUp()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/ready')
  })

  it("server xatosi (503) va tarmoq uzilishi yutiladi — throw/unhandled rejection YO'Q", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    expect(() => api.warmUp()).not.toThrow()
    // Microtask'dagi reject ham .catch(() => {}) tomonidan yutilishi kerak
    await new Promise((r) => setTimeout(r, 10))
  })
})

/**
 * api.startKeepAlive() regression-guard (2026-08-31 "test boshida sekin +
 * offline saqlandi" fix): test davomida Neon compute ~5 daqiqada SUSPEND
 * bo'ladi — savolni uzoq o'qigandan keyingi javob yana cold start (5-8s)
 * yemasligi uchun 4 daqiqada bir /ready ping. stop() chaqirilgach ping
 * TO'XTASHI shart (aks holda unmount'dan keyin ham timer yurib ketardi).
 */
describe('api.startKeepAlive — test davomida backend keep-alive', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("mount'da 1 ping + har intervalda ping; stop() to'xtatadi", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      const stop = api.startKeepAlive(60_000)
      expect(fetchMock).toHaveBeenCalledTimes(1) // darhol 1 ping

      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledTimes(3)

      stop()
      await vi.advanceTimersByTimeAsync(180_000)
      expect(fetchMock).toHaveBeenCalledTimes(3) // stop'dan keyin ping YO'Q
    } finally {
      vi.useRealTimers()
    }
  })

  it("default interval 4 daqiqa (Neon autosuspend ~5 daq'dan OLDIN)", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      const stop = api.startKeepAlive()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(3 * 60_000 + 59_000)
      expect(fetchMock).toHaveBeenCalledTimes(1) // 3:59 — hali ping yo'q
      await vi.advanceTimersByTimeAsync(2_000)
      expect(fetchMock).toHaveBeenCalledTimes(2) // 4:01 — ping ketdi
      stop()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * postResult timeout regression-guard (2026-08-31): backend suspend'dan
 * uyg'onayotgan 1-javob 5-8s+ kutadi — eski 8s default'da timeout bo'lib
 * javob outbox'ga ("offline saqlandi") tushardi. Endi 20s: 8s'da abort
 * BO'LMASLIGI, 20s'da 408 bilan abort bo'lishi shart.
 */
describe('api.postResult — cold-start timeout (20s)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("8s'da abort BO'LMAYDI, 20s'da 408 timeout", async () => {
    vi.useFakeTimers()
    try {
      // Hech qachon resolve bo'lmaydigan, lekin abort signal'ga quloc tutgan fetch
      const fetchMock = vi.fn((_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')))
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const settled = vi.fn()
      void api
        .postResult('u1', { questionId: 1, selectedAnswer: 'a', subjectId: 'yhq' })
        .catch((e: unknown) => { settled(e) })

      await vi.advanceTimersByTimeAsync(8_000)
      expect(settled).not.toHaveBeenCalled() // cold start (5-8s) hali kutilmoqda

      await vi.advanceTimersByTimeAsync(12_001)
      expect(settled).toHaveBeenCalledTimes(1)
      expect(settled.mock.calls[0]![0]).toMatchObject({ status: 408, code: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })
})
