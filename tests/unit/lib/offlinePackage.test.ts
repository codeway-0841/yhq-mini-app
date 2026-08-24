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
  has:    async (name: string) => cacheStores.has(name),
}
vi.stubGlobal('caches', cachesMock)

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Stateful Response mock that tracks body consumption
function jsonResponse(body: unknown, ok = true): Response {
  let bodyUsed = false
  return {
    ok,
    status: ok ? 200 : 500,
    clone() { return jsonResponse(body, ok) },
    json: async () => {
      if (bodyUsed) throw new TypeError('Body has already been consumed')
      bodyUsed = true
      return body
    },
  } as unknown as Response
}

// Mock the api module
vi.mock('../../../src/shared/api', () => {
  const apiMock = {
    api: {
      getOfflinePackage: vi.fn(),
    },
    ApiError: class ApiError extends Error {
      status: number
      code?: string
      retryable: boolean
      constructor(status: number, message: string, code?: string) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = code
        this.retryable = status <= 0 || status === 408 || status === 429 || status >= 500
      }
    },
  }
  return apiMock
})

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
  vi.clearAllMocks()
  cacheStores.clear()
  fetchMock.mockReset()
})

describe('downloadSubjectOffline', () => {
  it('fetches the package and every unique image, reporting progress to 100%', async () => {
    const { downloadSubjectOffline } = await fresh()
    const { api } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockResolvedValueOnce(QUESTIONS)
    fetchMock.mockResolvedValue(jsonResponse({}))
    const progress: number[] = []

    await downloadSubjectOffline('yhq', (p) => progress.push(p.percent))

    // 2 noyob rasm + 1 paket = 3 birlik
    expect(progress[progress.length - 1]).toBe(100)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/images/q001.jpg'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/images/q002.jpg'))
    expect(vi.mocked(api.getOfflinePackage)).toHaveBeenCalledWith('yhq')
  })

  it('continues past a single failed image fetch instead of aborting', async () => {
    const { downloadSubjectOffline } = await fresh()
    const { api } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockResolvedValueOnce(QUESTIONS)
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('q001')) return Promise.reject(new TypeError('network error'))
      return Promise.resolve(jsonResponse({}))
    })
    const progress: number[] = []

    await expect(downloadSubjectOffline('yhq', (p) => progress.push(p.percent))).resolves.toBeUndefined()
    expect(progress[progress.length - 1]).toBe(100)
  })

  it('propagates failed package fetch', async () => {
    const { downloadSubjectOffline } = await fresh()
    const { api, ApiError } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockRejectedValueOnce(new ApiError(401, 'Unauthorized'))

    await expect(downloadSubjectOffline('yhq', () => {})).rejects.toThrow('Unauthorized')
  })
})

describe('isSubjectDownloaded / deleteSubjectOffline / readOfflinePackage', () => {
  it('is false before download, true after, false after delete', async () => {
    const { downloadSubjectOffline, isSubjectDownloaded, deleteSubjectOffline } = await fresh()
    const { api } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockResolvedValueOnce(QUESTIONS)
    fetchMock.mockResolvedValue(jsonResponse({}))

    expect(await isSubjectDownloaded('yhq')).toBe(false)
    await downloadSubjectOffline('yhq', () => {})
    expect(await isSubjectDownloaded('yhq')).toBe(true)
    await deleteSubjectOffline('yhq')
    expect(await isSubjectDownloaded('yhq')).toBe(false)
  })

  it('readOfflinePackage returns the cached rows, or null if never downloaded', async () => {
    const { downloadSubjectOffline, readOfflinePackage } = await fresh()
    const { api } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockResolvedValueOnce(QUESTIONS)
    fetchMock.mockResolvedValue(jsonResponse({}))

    expect(await readOfflinePackage('yhq')).toBeNull()
    await downloadSubjectOffline('yhq', () => {})
    const rows = await readOfflinePackage('yhq')
    expect(rows).toHaveLength(3)
    expect(rows?.[0]?.correctAnswer).toBe('a')
  })

  it('different subjects have independent caches', async () => {
    const { downloadSubjectOffline, isSubjectDownloaded } = await fresh()
    const { api } = await import('../../../src/shared/api')
    vi.mocked(api.getOfflinePackage).mockResolvedValueOnce(QUESTIONS)
    fetchMock.mockResolvedValue(jsonResponse({}))

    await downloadSubjectOffline('yhq', () => {})
    expect(await isSubjectDownloaded('yhq')).toBe(true)
    expect(await isSubjectDownloaded('rustili')).toBe(false)
  })
})
