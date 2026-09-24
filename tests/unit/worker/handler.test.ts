/**
 * Worker handleRequest — xavfsizlik pipeline testlari:
 *
 *  - PRIVATE R2 obyekti token'siz OCHILMAYDI (401);
 *  - expired/invalid token → 401;
 *  - fizika scope'li token boshqa fanga → 403;
 *  - boshqa versiyaga scope'langan token → 403;
 *  - cache key'da TOKEN YO'Q (umumiy edge cache xavfsiz);
 *  - AUTH cache'dan OLDIN (cache HIT ham faqat valid token'dan keyin);
 *  - immutable versioned obyekt edge-cache'lanadi;
 *  - rate limit → 429 (Retry-After bilan);
 *  - xom token metrikada YO'Q.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

import { handleRequest, extractToken, buildCacheKey, resetRateLimiterForTests, type WorkerEnv, type R2ObjectLike } from '../../../workers/question-content/src/index'
import { issueContentToken } from '../../../server/modules/content/content-token'

const SECRET = 'handler-test-secret-0123456789abcdef0123456789abcdef'

const CHUNK_BODY = JSON.stringify({ topicIds: [1], questions: [{ id: 1 }] })

function makeEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv & { r2Get: ReturnType<typeof vi.fn> } {
  const r2Get = vi.fn(async (key: string): Promise<R2ObjectLike | null> => {
    if (key === 'questions/physics/v12/manifest.json') {
      return { body: JSON.stringify({ subject: 'physics', contentVersion: 12 }), size: 40, arrayBuffer: async () => new ArrayBuffer(0) }
    }
    if (key === 'questions/physics/v12/chunks/chunk-001.json') {
      return { body: CHUNK_BODY, size: CHUNK_BODY.length, arrayBuffer: async () => new ArrayBuffer(0) }
    }
    return null
  })
  return {
    QBANK: { get: r2Get },
    CONTENT_TOKEN_SECRET: SECRET,
    ALLOWED_ORIGINS: 'https://app.kivvi.uz',
    r2Get,
    ...overrides,
  } as WorkerEnv & { r2Get: ReturnType<typeof vi.fn> }
}

function tokenFor(claims: Partial<{ sub: string; sid: string; v: number; exp: number }> = {}): string {
  return issueContentToken(SECRET, {
    sub: 'user-1', sid: 'physics', v: 12, exp: 2_000_000_000, ...claims,
  })
}

function req(path: string, token?: string | null, viaQuery = false): Request {
  const url = new URL(`https://content.kivvi.uz${path}`)
  if (token && viaQuery) url.searchParams.set('ct', token)
  return new Request(url.toString(), {
    headers: token && !viaQuery ? { Authorization: `Bearer ${token}` } : {},
  })
}

const ctx = { waitUntil: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimiterForTests()
})

describe('Worker — PRIVATE bucket himoyasi', () => {
  it('token\'siz → 401 (bucket hech qachon anonim ochilmaydi)', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/manifest.json'), env, ctx)
    expect(res.status).toBe(401)
    expect((await res.json() as { error: string }).error).toBe('token_required')
    expect(env.r2Get).not.toHaveBeenCalled()
  })

  it('buzilgan token → 401', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/manifest.json', 'v1.soxta.imzo'), env, ctx)
    expect(res.status).toBe(401)
    expect(env.r2Get).not.toHaveBeenCalled()
  })

  it('eskirgan token → 401 token_expired', async () => {
    const env = makeEnv()
    const expired = tokenFor({ exp: 1_000_000_000 }) // 2001-yil
    const res = await handleRequest(req('/questions/physics/v12/manifest.json', expired), env, ctx)
    expect(res.status).toBe(401)
    expect((await res.json() as { error: string }).error).toBe('token_expired')
    expect(env.r2Get).not.toHaveBeenCalled()
  })

  it('fizika tokeni BOSHQA fan\'ga → 403 wrong_subject', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/math/v12/manifest.json', tokenFor()), env, ctx)
    // path parse: 'math' subject — lekin token sid='physics'
    expect(res.status).toBe(403)
    expect((await res.json() as { error: string }).error).toBe('wrong_subject')
  })

  it('boshqa VERSIYA tokeni → 403 wrong_version', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v13/manifest.json', tokenFor({ v: 12 })), env, ctx)
    expect(res.status).toBe(403)
    expect((await res.json() as { error: string }).error).toBe('wrong_version')
  })

  it('path traversal → 404 (R2\'ga umuman bormaydi)', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/../../secret.json', tokenFor()), env, ctx)
    expect(res.status).toBe(404)
    expect(env.r2Get).not.toHaveBeenCalled()
  })

  it('R2\'da yo\'q obyekt → 404', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-099.json', tokenFor()), env, ctx)
    expect(res.status).toBe(404)
  })

  it('R2\'ga FAQAT parse-qilingan key bilan boriladi (xom URL emas)', async () => {
    const env = makeEnv()
    await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor()), env, ctx)
    expect(env.r2Get).toHaveBeenCalledWith('questions/physics/v12/chunks/chunk-001.json')
  })
})

describe('Worker — muvaffaqiyatli xizmat', () => {
  it('manifest: 200 + immutable cache header', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/manifest.json', tokenFor()), env, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })

  it('chunk: 200 + JSON tana', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor()), env, ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(CHUNK_BODY))
  })

  it('?ct= query orqali ham token qabul qilinadi (<img> yo\'li)', async () => {
    const env = makeEnv()
    const res = await handleRequest(req('/questions/physics/v12/manifest.json', tokenFor(), true), env, ctx)
    expect(res.status).toBe(200)
  })

  it('CORS: allowlist origin qaytariladi, begona origin emas', async () => {
    const env = makeEnv()
    const good = new Request('https://content.kivvi.uz/questions/physics/v12/manifest.json', {
      headers: { Authorization: `Bearer ${tokenFor()}`, Origin: 'https://app.kivvi.uz' },
    })
    const res1 = await handleRequest(good, env, ctx)
    expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('https://app.kivvi.uz')

    const evil = new Request('https://content.kivvi.uz/questions/physics/v12/manifest.json', {
      headers: { Authorization: `Bearer ${tokenFor()}`, Origin: 'https://evil.example' },
    })
    const res2 = await handleRequest(evil, env, ctx)
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('Worker — edge cache xavfsizligi', () => {
  it('cache key\'da TOKEN YO\'Q — faqat path', () => {
    expect(buildCacheKey('/questions/physics/v12/chunks/chunk-001.json'))
      .toBe('https://qbank.kivvi.internal/questions/physics/v12/chunks/chunk-001.json')
  })

  it('AUTH cache\'dan OLDIN: cache HIT bo\'lsa ham yaroqsiz token 401 oladi', async () => {
    const env = makeEnv()
    const cached = new Response('cached-body', { status: 200 })
    const cache = {
      match: vi.fn(async () => cached),
      put: vi.fn(async () => {}),
    }
    // Token umuman yo'q — cache'ga QARALMAYDI
    const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json'), env, ctx, { cache })
    expect(res.status).toBe(401)
    expect(cache.match).not.toHaveBeenCalled()
  })

  it('valid token + cache HIT → keshdan qaytadi, R2\'ga bormaydi', async () => {
    const env = makeEnv()
    const cached = new Response('cached-body', { status: 200, headers: { 'Content-Type': 'application/json' } })
    const cache = { match: vi.fn(async () => cached), put: vi.fn(async () => {}) }
    const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor()), env, ctx, { cache })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('HIT')
    expect(env.r2Get).not.toHaveBeenCalled()
  })

  it('valid token + cache MISS → R2\'dan olib cache.put qiladi (immutable)', async () => {
    const env = makeEnv()
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) }
    const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor()), env, ctx, { cache })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('MISS')
    expect(cache.put).toHaveBeenCalledTimes(1)
    const [putReq, putRes] = cache.put.mock.calls[0] as [Request, Response]
    // cache.put kalitida token YO'Q
    expect(putReq.url).not.toContain('ct=')
    expect(putReq.url).toBe('https://qbank.kivvi.internal/questions/physics/v12/chunks/chunk-001.json')
    expect(putRes.headers.get('Cache-Control')).toContain('immutable')
  })

  it('boshqa user/token — bir xil cache key (umumiy kesh XAVFSIZ: auth allaqachon o\'tgan)', async () => {
    const env = makeEnv()
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) }
    await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor({ sub: 'user-A' })), env, ctx, { cache })
    await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', tokenFor({ sub: 'user-B' })), env, ctx, { cache })
    const keys = cache.put.mock.calls.map((c) => (c[0] as Request).url)
    expect(new Set(keys).size).toBe(1)
  })
})

describe('Worker — rate limit va metrika', () => {
  it('bir user limitdan oshsa → 429 (Retry-After)', async () => {
    // Limiter modul-singleton, beforeEach'da reset qilinadi — shu testda
    // kichik limit (30/min) bilan yaratiladi.
    const env = makeEnv({ RATE_USER_PER_MIN: '30', RATE_IP_PER_MIN: '10000' })
    const t = tokenFor({ sub: 'rate-test-user' })
    let lastStatus = 0
    for (let i = 0; i < 40; i += 1) {
      const res = await handleRequest(req('/questions/physics/v12/chunks/chunk-001.json', t), env, ctx, { cache: null })
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })

  it('metrikada XOM TOKEN YO\'Q (faqat status/kind)', async () => {
    const writeDataPoint = vi.fn()
    const env = makeEnv({ QBANK_ANALYTICS: { writeDataPoint } })
    const t = tokenFor()
    await handleRequest(req('/questions/physics/v12/manifest.json', t), env, ctx)
    for (const call of writeDataPoint.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain(t)
    }
  })
})

describe('extractToken', () => {
  it('Authorization header ustuvor', () => {
    const r = new Request('https://x.test/a?ct=query-token', { headers: { Authorization: 'Bearer header-token' } })
    expect(extractToken(r)).toBe('header-token')
  })

  it('faqat ?ct= query ham ishlaydi', () => {
    expect(extractToken(new Request('https://x.test/a?ct=query-token'))).toBe('query-token')
  })

  it('token yo\'q → null', () => {
    expect(extractToken(new Request('https://x.test/a'))).toBeNull()
  })
})
