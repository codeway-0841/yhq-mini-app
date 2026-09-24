/**
 * R2/Worker fizika bank loader (client) — manifest/chunk fetch, shakl
 * tekshiruvi, tartib, xato holatlari. Xato → throw (store fallback qiladi).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/shared/config', () => ({
  config: {
    contentWorkerUrl: 'https://content.kivvi.uz',
    r2QuestionBankPhysics: true,
    apiBaseUrl: '/api',
  },
}))

const h = vi.hoisted(() => ({
  token: 'test-token-abc' as string | null,
  segment: 'physics' as string | null,
}))
vi.mock('../../../src/shared/lib/content-token', () => ({
  getContentTokenState: vi.fn(async (subjectId: string) => {
    if (!h.token) throw new Error('token_unavailable')
    if (!h.segment) throw new Error('r2_segment_missing')
    // Server SSOT pariteti: fizika→physics, qolganlarida segment=subjectId
    const segment = subjectId === 'fizika' ? h.segment : subjectId
    return { subjectId, segment, token: h.token, expiresAtMs: Date.now() + 600_000, issuedAtMs: Date.now() }
  }),
}))

import { loadSubjectBankR2, loadPhysicsBankR2 } from '../../../src/shared/lib/r2-question-bank'

const WORKER = 'https://content.kivvi.uz'

function q(id: number, topicId = 1) {
  return {
    id,
    externalId: `ftp-${id}`,
    topicId,
    questionUz: `Savol ${id}`,
    questionRu: `Вопрос ${id}`,
    optionsUz: { A: 'a', B: 'b' },
    optionsRu: { A: 'а', B: 'б' },
    image: id === 2 ? '/images/physics/0123456789abcdef.webp' : null,
  }
}

function manifest(version: number, files: Array<{ path: string; questionCount: number }>, questionCount: number) {
  return {
    subject: 'physics',
    contentVersion: version,
    generatedAt: '2026-09-24T00:00:00.000Z',
    questionCount,
    topics: [{ topicId: 1, questionCount, chunks: files.map((f) => f.path) }],
    files: files.map((f) => ({ ...f, bytes: 100 })),
  }
}

/** fetch mock: path bo'yicha javob xaritasi */
function mockFetch(routes: Record<string, { status?: number; body?: unknown }>) {
  const calls: string[] = []
  const headers: Record<string, string>[] = []
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push(url)
    headers.push((init?.headers ?? {}) as Record<string, string>)
    const path = new URL(url).pathname + new URL(url).search
    for (const [route, resp] of Object.entries(routes)) {
      if (path === route) {
        return new Response(
          typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body),
          { status: resp.status ?? 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
    return new Response('not found', { status: 404 })
  }) as typeof fetch
  return { calls, headers }
}

beforeEach(() => {
  vi.restoreAllMocks()
  h.token = 'test-token-abc'
  h.segment = 'physics'
})

describe('loadPhysicsBankR2 — muvaffaqiyat', () => {
  it('manifest + 2 chunk → DbQuestion[] (id bo\'yicha saralangan)', async () => {
    const files = [
      { path: 'chunks/chunk-001.json', questionCount: 2 },
      { path: 'chunks/chunk-002.json', questionCount: 1 },
    ]
    const { calls, headers } = mockFetch({
      '/questions/physics/v12/manifest.json': { body: manifest(12, files, 3) },
      '/questions/physics/v12/chunks/chunk-001.json': { body: { topicIds: [1], questions: [q(3), q(1)] } },
      '/questions/physics/v12/chunks/chunk-002.json': { body: { topicIds: [1], questions: [q(2)] } },
    })

    const raw = await loadSubjectBankR2('fizika', 'cv12')
    expect(raw.map((r) => r.id)).toEqual([1, 2, 3]) // global id tartib (legacy paritet)
    expect(raw[0]).toMatchObject({ questionUz: 'Savol 1', topicId: 1 })
    expect(raw.find((r) => r.id === 2)?.image).toBe('/images/physics/0123456789abcdef.webp')
    // HAMMA so'rov Bearer token bilan
    expect(headers.every((hdr) => hdr['Authorization'] === 'Bearer test-token-abc')).toBe(true)
    // Worker domeniga boradi
    expect(calls.every((u) => u.startsWith(WORKER))).toBe(true)
    expect(calls).toHaveLength(3)
  })

  it('boshqa fan (matematika) — URL\'lar segment bilan quriladi (client mapping\'siz)', async () => {
    const files = [{ path: 'chunks/chunk-001.json', questionCount: 1 }]
    const { calls } = mockFetch({
      '/questions/matematika/v2/manifest.json': { body: { ...manifest(2, files, 1), subject: 'matematika' } },
      '/questions/matematika/v2/chunks/chunk-001.json': { body: { topicIds: [5], questions: [q(9, 5)] } },
    })
    const raw = await loadSubjectBankR2('matematika', 'cv2')
    expect(raw.map((r) => r.id)).toEqual([9])
    expect(raw[0]?.topicId).toBe(5)
    expect(calls.every((u) => u.includes('/questions/matematika/v2/'))).toBe(true)
  })

  it('segment yo\'q → r2_segment_missing', async () => {
    h.segment = null
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_segment_missing')
    h.segment = 'physics'
  })

  it('loadPhysicsBankR2 — deprecated alias fizika\'ga yo\'naltiradi', async () => {
    const files = [{ path: 'chunks/chunk-001.json', questionCount: 1 }]
    mockFetch({
      '/questions/physics/v12/manifest.json': { body: manifest(12, files, 1) },
      '/questions/physics/v12/chunks/chunk-001.json': { body: { topicIds: [1], questions: [q(1)] } },
    })
    const raw = await loadPhysicsBankR2('cv12')
    expect(raw.map((r) => r.id)).toEqual([1])
  })

  it('correctAnswer chunk\'da bo\'lsa ham CLIENT payload\'iga kirmaydi (whitelist map)', async () => {
    const dirty = { ...q(1), correctAnswer: 'A', explanation: 'sir' }
    mockFetch({
      '/questions/physics/v12/manifest.json': {
        body: manifest(12, [{ path: 'chunks/chunk-001.json', questionCount: 1 }], 1),
      },
      '/questions/physics/v12/chunks/chunk-001.json': { body: { topicIds: [1], questions: [dirty] } },
    })
    const raw = await loadSubjectBankR2('fizika', 'cv12')
    expect(raw).toHaveLength(1)
    expect('correctAnswer' in raw[0]!).toBe(false)
    expect('explanation' in raw[0]!).toBe(false)
    expect(Object.keys(raw[0]!).sort()).toEqual(['id', 'image', 'optionsRu', 'optionsUz', 'questionRu', 'questionUz', 'topicId'])
  })
})

describe('loadPhysicsBankR2 — xatolar (store fallback\'ga throw)', () => {
  it('Worker URL yo\'q → r2_worker_url_missing', async () => {
    const { config } = await import('../../../src/shared/config')
    const original = config.contentWorkerUrl
    ;(config as { contentWorkerUrl: string | null }).contentWorkerUrl = null
    try {
      await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_worker_url_missing')
    } finally {
      ;(config as { contentWorkerUrl: string | null }).contentWorkerUrl = original
    }
  })

  it('yaroqsiz versiya → r2_bad_version', async () => {
    await expect(loadSubjectBankR2('fizika', 'nonsense')).rejects.toThrow('r2_bad_version')
    await expect(loadSubjectBankR2('fizika', 'cv0')).rejects.toThrow('r2_bad_version')
  })

  it('token olinmasa → throw', async () => {
    h.token = null
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('token_unavailable')
  })

  it('manifest 404 → r2_http_404', async () => {
    mockFetch({})
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_http_404')
  })

  it('manifest shakli buzilgan → r2_manifest_invalid', async () => {
    mockFetch({ '/questions/physics/v12/manifest.json': { body: { hello: 'world' } } })
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_manifest_invalid')
  })

  it('manifest versiyasi mos kelmasa → r2_manifest_invalid', async () => {
    mockFetch({
      '/questions/physics/v12/manifest.json': { body: manifest(13, [{ path: 'chunks/chunk-001.json', questionCount: 1 }], 1) },
    })
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_manifest_invalid')
  })

  it('chunk savollar soni manifest\'dan kam → r2_count_mismatch', async () => {
    mockFetch({
      '/questions/physics/v12/manifest.json': {
        body: manifest(12, [{ path: 'chunks/chunk-001.json', questionCount: 5 }], 5),
      },
      '/questions/physics/v12/chunks/chunk-001.json': { body: { topicIds: [1], questions: [q(1)] } },
    })
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_count_mismatch')
  })

  it('chunk\'da buzilgan savol → r2_chunk_question_invalid', async () => {
    mockFetch({
      '/questions/physics/v12/manifest.json': {
        body: manifest(12, [{ path: 'chunks/chunk-001.json', questionCount: 1 }], 1),
      },
      '/questions/physics/v12/chunks/chunk-001.json': { body: { topicIds: [1], questions: [{ id: 'not-a-number' }] } },
    })
    await expect(loadSubjectBankR2('fizika', 'cv12')).rejects.toThrow('r2_chunk_question_invalid')
  })
})
