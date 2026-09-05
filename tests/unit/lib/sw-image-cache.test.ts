/**
 * Service worker rasm keshi — LRU cap regressiya testi.
 *
 * public/images ~84 MB. Ilgari har ko'rilgan rasm umumiy CACHE ga CHEKLOVSIZ
 * yozilardi va qurilma xotirasi vaqt o'tib shuncha tomon o'sardi. Endi rasmlar
 * alohida IMG_CACHE da va IMG_MAX_ENTRIES bilan cheklangan.
 *
 * sw.js — klassik worker skripti (import/export yo'q), shuning uchun uni
 * soxta `self` bilan vm sandbox'ida ishga tushiramiz va `fetch` listener'ini
 * qo'lda chaqiramiz.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'

const SW_SOURCE = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8')

/** Cache API ning minimal, tartibni saqlaydigan modeli. */
class FakeCache {
  entries = new Map<string, { status: number }>()
  async match(req: string | { url: string }) {
    const key = typeof req === 'string' ? req : req.url
    const hit = this.entries.get(key)
    return hit ? makeResponse(hit.status) : undefined
  }
  async put(req: string | { url: string }, res: { status: number }) {
    const key = typeof req === 'string' ? req : req.url
    this.entries.set(key, { status: res.status })
  }
  async delete(req: string | { url: string }) {
    const key = typeof req === 'string' ? req : req.url
    return this.entries.delete(key)
  }
  // Qo'shilish tartibida — haqiqiy Cache API kabi
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }))
  }
}

function makeResponse(status = 200, body = '', headersInit: Record<string, string> = {}) {
  const headerMap = new Map<string, string>(Object.entries(headersInit).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: {
      get(k: string) { return headerMap.get(k.toLowerCase()) ?? null },
      delete(k: string) { headerMap.delete(k.toLowerCase()) },
      set(k: string, v: string) { headerMap.set(k.toLowerCase(), v) },
    },
    clone() { return makeResponse(status, body, headersInit) },
  }
}

const caches = {
  store: new Map<string, FakeCache>(),
  async open(name: string) {
    if (!this.store.has(name)) this.store.set(name, new FakeCache())
    return this.store.get(name)!
  },
  async keys() { return [...this.store.keys()] },
  async delete(name: string) { return this.store.delete(name) },
  async match() { return undefined },
}

let listeners: Record<string, (e: unknown) => void>
let fetchMock: ReturnType<typeof vi.fn>

function loadWorker() {
  listeners = {}
  fetchMock = vi.fn(async () => makeResponse(200))
  const sandbox = {
    self: {
      addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
      location: { origin: 'https://app.test' },
    },
    caches,
    fetch: (...args: unknown[]) => fetchMock(...(args as [])),
    URL,
    Headers: class FakeHeaders {
      map = new Map<string, string>()
      delete(k: string) { this.map.delete(k.toLowerCase()) }
      get(k: string) { return this.map.get(k.toLowerCase()) ?? null }
      set(k: string, v: string) { this.map.set(k.toLowerCase(), v) }
    },
    // storable() yangi Response yasaydi — sanoq uchun status yetarli
    Response: function (this: unknown, body: unknown, init?: { status?: number }) {
      return makeResponse(init?.status ?? 200, String(body ?? ''))
    },
    setTimeout,
    Promise,
    Set,
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(SW_SOURCE, sandbox)
}

/** Bitta rasm so'rovini SW orqali o'tkazadi va waitUntil ishlarini kutadi. */
async function requestImage(path: string) {
  const url = `https://app.test${path}`
  const pending: Promise<unknown>[] = []
  let responded: Promise<unknown> = Promise.resolve()
  listeners.fetch({
    request: { method: 'GET', url, mode: 'no-cors' },
    respondWith: (p: Promise<unknown>) => { responded = p },
    waitUntil: (p: Promise<unknown>) => { pending.push(p) },
  })
  await responded
  await Promise.all(pending)
}

/** Umumiy GET so'rovini SW orqali o'tkazish */
async function requestRoute(path: string) {
  const url = `https://app.test${path}`
  const pending: Promise<unknown>[] = []
  let responded: Promise<unknown> | undefined
  listeners.fetch({
    request: { method: 'GET', url, mode: 'cors' },
    respondWith: (p: Promise<unknown>) => { responded = p },
    waitUntil: (p: Promise<unknown>) => { pending.push(p) },
  })
  if (responded) await responded
  await Promise.all(pending)
}

beforeEach(() => {
  caches.store.clear()
  loadWorker()
})

describe('sw.js rasm keshi', () => {
  it('rasmlar app shell keshiga EMAS, alohida IMG_CACHE ga tushadi', async () => {
    await requestImage('/images/q002.jpg')

    expect(caches.store.get('yhq-img-v1')?.entries.size).toBe(1)
    expect(caches.store.get('yhq-app-v3')?.entries.size ?? 0).toBe(0)
  })

  it('cap oshganda eng eski yozuvlar o\'chadi', async () => {
    for (let i = 0; i < 320; i++) await requestImage(`/images/q${i}.jpg`)

    const img = caches.store.get('yhq-img-v1')!
    expect(img.entries.size).toBe(300)
    // Eng eskilari ketdi, eng yangilari qoldi
    expect(img.entries.has('https://app.test/images/q0.jpg')).toBe(false)
    expect(img.entries.has('https://app.test/images/q319.jpg')).toBe(true)
  })

  it('ko\'rilgan rasm LRU tartibida oxiriga suriladi (touch)', async () => {
    for (let i = 0; i < 300; i++) await requestImage(`/images/q${i}.jpg`)

    // q0 — eng eski. Uni qayta ko'ramiz: keshdan keladi va oxiriga suriladi.
    await requestImage('/images/q0.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(300)   // qayta yuklanmadi

    // Yana 5 ta yangi rasm — cap oshadi, endi q1 qurbon bo'lishi kerak, q0 emas
    for (let i = 300; i < 305; i++) await requestImage(`/images/q${i}.jpg`)

    const img = caches.store.get('yhq-img-v1')!
    expect(img.entries.size).toBe(300)
    expect(img.entries.has('https://app.test/images/q0.jpg')).toBe(true)
    expect(img.entries.has('https://app.test/images/q1.jpg')).toBe(false)
  })
})

describe('sw.js question vs explanation cache boundaries (ID 09)', () => {
  it('/api/questions public ro\'yxati app keshiga tushadi', async () => {
    await requestRoute('/api/questions?bank=yhq')
    const appCache = caches.store.get('yhq-app-v3')
    expect(appCache?.entries.has('https://app.test/api/questions?bank=yhq')).toBe(true)
  })

  it('/api/questions/:id/explanation post-answer endpointi HECH QACHON keshlanmaydi (bypass)', async () => {
    await requestRoute('/api/questions/123/explanation')
    const appCache = caches.store.get('yhq-app-v3')
    expect(appCache?.entries.has('https://app.test/api/questions/123/explanation')).toBeFalsy()
  })

  it('Cache-Control: private, no-store javoblar storable orqali keshga saqlanmaydi', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, '{"text":"explanation"}', { 'cache-control': 'private, no-store' }))
    await requestRoute('/api/custom-data')
    const appCache = caches.store.get('yhq-app-v3')
    expect(appCache?.entries.size ?? 0).toBe(0)
  })
})
