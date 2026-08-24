import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Cache API taqlidi (node muhitida yo'q) — outbox.test.ts'dagi
// localStorage stub naqshiga mos: Map asosida, real Cache/CacheStorage
// interfeysining shu faylda ishlatiladigan qismini bajaradi.
const cacheStores = new Map<string, Map<string, Response>>()

function makeCache(name: string) {
  if (!cacheStores.has(name)) cacheStores.set(name, new Map())
  const store = cacheStores.get(name)!
  return {
    match: async (req: string) => store.get(req) ?? undefined,
    put:   async (req: string, res: Response) => { store.set(req, res) },
  }
}

const cachesMock = {
  open:   async (name: string) => makeCache(name),
  delete: async (name: string) => cacheStores.delete(name),
}
vi.stubGlobal('caches', cachesMock)

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    clone() { return jsonResponse(body, ok) },
    json: async () => body,
  } as unknown as Response
}

async function fresh() {
  return import('../../../src/shared/lib/offlinePackage')
}

const QUESTIONS = [
  { id: 1, questionUz: 'S1', questionRu: 'В1', optionsUz: { a: '1' }, optionsRu: { a: '1' }, correctAnswer: 'a', image: '/images/q001.jpg', topicId: 1 },
  { id: 2, questionUz: 'S2', questionRu: 'В2', optionsUz: { a: '1' }, optionsRu: { a: '1' }, correctAnswer: 'a', image: '/images/q002.jpg', topicId: 1 },
  { id: 3, questionUz: 'S3', questionRu: 'В3', optionsUz: { a: '1' }, optionsRu: { a: '1' }, correctAnswer: 'a', image: null, topicId: 1 },
]

beforeEach(() => {
  vi.resetModules()
  cacheStores.clear()
  fetchMock.mockReset()
})

describe('downloadSubjectOffline', () => {
  it('fetches the package and every unique image, reporting progress to 100%', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('offline-package')) return Promise.resolve(jsonResponse(QUESTIONS))
      return Promise.resolve(jsonResponse({}))
    })
    const { downloadSubjectOffline } = await fresh()
    const progress: number[] = []

    await downloadSubjectOffline('yhq', (p) => progress.push(p.percent))

    // 2 noyob rasm + 1 paket = 3 birlik
    expect(progress[progress.length - 1]).toBe(100)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/images/q001.jpg'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/images/q002.jpg'))
  })

  it('continues past a single failed image fetch instead of aborting', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('offline-package')) return Promise.resolve(jsonResponse(QUESTIONS))
      if (url.includes('q001')) return Promise.reject(new TypeError('network error'))
      return Promise.resolve(jsonResponse({}))
    })
    const { downloadSubjectOffline } = await fresh()
    const progress: number[] = []

    await expect(downloadSubjectOffline('yhq', (p) => progress.push(p.percent))).resolves.toBeUndefined()
    expect(progress[progress.length - 1]).toBe(100)
  })
})

describe('isSubjectDownloaded / deleteSubjectOffline / readOfflinePackage', () => {
  it('is false before download, true after, false after delete', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('offline-package') ? jsonResponse(QUESTIONS) : jsonResponse({})))
    const { downloadSubjectOffline, isSubjectDownloaded, deleteSubjectOffline } = await fresh()

    expect(await isSubjectDownloaded('yhq')).toBe(false)
    await downloadSubjectOffline('yhq', () => {})
    expect(await isSubjectDownloaded('yhq')).toBe(true)
    await deleteSubjectOffline('yhq')
    expect(await isSubjectDownloaded('yhq')).toBe(false)
  })

  it('readOfflinePackage returns the cached rows, or null if never downloaded', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('offline-package') ? jsonResponse(QUESTIONS) : jsonResponse({})))
    const { downloadSubjectOffline, readOfflinePackage } = await fresh()

    expect(await readOfflinePackage('yhq')).toBeNull()
    await downloadSubjectOffline('yhq', () => {})
    const rows = await readOfflinePackage('yhq')
    expect(rows).toHaveLength(3)
    expect(rows?.[0]?.correctAnswer).toBe('a')
  })

  it('different subjects have independent caches', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('offline-package') ? jsonResponse(QUESTIONS) : jsonResponse({})))
    const { downloadSubjectOffline, isSubjectDownloaded } = await fresh()

    await downloadSubjectOffline('yhq', () => {})
    expect(await isSubjectDownloaded('yhq')).toBe(true)
    expect(await isSubjectDownloaded('rustili')).toBe(false)
  })
})
