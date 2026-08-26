/**
 * Skelet regressiya — Dashboard kartalarining SWR keshi qayta yuklashdan
 * OMON QOLISHI kerak.
 *
 * Telegram Mini App har ochilishda sahifani qaytadan yuklaydi. Kesh faqat
 * xotirada bo'lganida boot'da doim bo'sh chiqardi, ya'ni "SWR" hech qachon
 * ishlamasdi va user har safar skelet ko'rardi.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTtlCache, invalidateAllPersistedCaches } from '../../../src/shared/lib/ttl-cache'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  get length() { return mem.size },
  key:        (i: number) => [...mem.keys()][i] ?? null,
  getItem:    (k: string) => mem.get(k) ?? null,
  setItem:    (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear:      () => mem.clear(),
})

beforeEach(() => mem.clear())

describe('createTtlCache persist', () => {
  it('qayta yuklashdan keyin peek() ma\'lumot qaytaradi', async () => {
    const a = createTtlCache<number[]>(60_000, { persistKey: 'demo' })
    await a.fetch(async () => [1, 2, 3])

    // "Sahifa qayta yuklandi" — yangi instansiya, o'sha kalit
    const b = createTtlCache<number[]>(60_000, { persistKey: 'demo' })
    expect(b.peek()).toEqual([1, 2, 3])
  })

  it('persistKey\'siz kesh diskga YOZMAYDI', async () => {
    const a = createTtlCache<number>(60_000)
    await a.fetch(async () => 42)

    expect(mem.size).toBe(0)
    expect(createTtlCache<number>(60_000).peek()).toBeNull()
  })

  it('maxAgeMs dan eski yozuv ISHLATILMAYDI', async () => {
    const a = createTtlCache<string>(60_000, { persistKey: 'old', maxAgeMs: 1000 })
    await a.fetch(async () => 'stale')

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    try {
      expect(createTtlCache<string>(60_000, { persistKey: 'old', maxAgeMs: 1000 }).peek()).toBeNull()
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('tiklangan kesh TTL bo\'yicha BAYAT — SWR qayta so\'raydi', async () => {
    const a = createTtlCache<string>(60_000, { persistKey: 'swr' })
    await a.fetch(async () => 'v1')

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000)   // TTL o'tdi
    try {
      const b = createTtlCache<string>(60_000, { persistKey: 'swr' })
      expect(b.peek()).toBe('v1')        // birinchi kadr — skeletsiz
      expect(b.isFresh()).toBe(false)    // ...lekin yangilanishi kerak
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('invalidateAllPersistedCaches barcha yozuvlarni supuradi', async () => {
    const a = createTtlCache<number>(60_000, { persistKey: 'k1' })
    const b = createTtlCache<number>(60_000, { persistKey: 'k2' })
    await a.fetch(async () => 1)
    await b.fetch(async () => 2)
    mem.set('yhq-app-store', 'begona')   // prefiks tashqarisi — tegilmasin

    invalidateAllPersistedCaches()

    expect(createTtlCache<number>(60_000, { persistKey: 'k1' }).peek()).toBeNull()
    expect(createTtlCache<number>(60_000, { persistKey: 'k2' }).peek()).toBeNull()
    expect(mem.get('yhq-app-store')).toBe('begona')
  })

  it('parallel fetch bitta so\'rovni bo\'lishadi', async () => {
    const fetcher = vi.fn(async () => 'x')
    const c = createTtlCache<string>(60_000, { persistKey: 'dedupe' })

    await Promise.all([c.fetch(fetcher), c.fetch(fetcher)])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
