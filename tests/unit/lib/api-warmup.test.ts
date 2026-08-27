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
