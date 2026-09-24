/**
 * kivvi-question-content — PRIVATE R2 savol kontenti uchun himoyalangan Worker.
 *
 * Pipeline (TARTIB MUHIM):
 *   1. CORS preflight (faqat allowlist origin'lar)
 *   2. GET-only
 *   3. STRICT path parse (allowlist; R2 key segmentlardan QURILADI)
 *   4. Token auth (Authorization: Bearer yoki ?ct= — faqat <img> uchun)
 *      → 401 expired/buzilgan · 403 boshqa fan/versiya
 *   5. Rate limit (userId + IP burst) → 429
 *   6. Edge cache (Cache API; cache key = FAQAT path — token KIRMAYDI)
 *   7. PRIVATE R2 binding → immutable headers → cache.put
 *
 * Auth cache'dan OLDIN — umumiy (shared) edge cache'dan faqat token'i
 * to'g'ri so'rovlar foydalanadi. Kontent publik (javob kalitlari YO'Q),
 * shuning uchun bir xil path barcha userlarga umumiy keshlanishi xavfsiz.
 *
 * Log/metrika: HECH QACHON xom token yozilmaydi (faqat jti).
 */

import { parseContentPath, contentTypeFor, type ParsedContentPath } from './paths'
import { verifyContentToken, type ContentTokenClaims } from './auth'
import { SlidingWindowLimiter } from './rate-limit'

export interface R2ObjectLike {
  body: unknown
  size?: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface WorkerEnv {
  QBANK: { get(key: string): Promise<R2ObjectLike | null> }
  QBANK_ANALYTICS?: { writeDataPoint(point: Record<string, unknown>): void }
  CONTENT_TOKEN_SECRET: string
  ALLOWED_ORIGINS?: string
  RATE_USER_PER_MIN?: string
  RATE_IP_PER_MIN?: string
}

export interface WorkerCtx {
  waitUntil(promise: Promise<unknown>): void
}

interface CacheLike {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

const IMMUTABLE_CC = 'public, max-age=31536000, immutable'
const ERROR_CC = 'no-store'

// Modul darajasida — isolate qayta ishlatilganda limiter holati saqlanadi
let limiter: SlidingWindowLimiter | null = null

/** Testlar uchun limiter reset (modul-singleton izolyatsiyasi). */
export function resetRateLimiterForTests(): void {
  limiter = null
}

function getLimiter(env: WorkerEnv): SlidingWindowLimiter {
  if (!limiter) {
    limiter = new SlidingWindowLimiter(
      Math.max(30, Number(env.RATE_USER_PER_MIN ?? '300')),
      Math.max(30, Number(env.RATE_IP_PER_MIN ?? '100')),
    )
  }
  return limiter
}

function resolveCache(): CacheLike | null {
  const cachesGlobal = (globalThis as { caches?: { default?: CacheLike } }).caches
  return cachesGlobal?.default ?? null
}

/** Token qayerdan olinadi: Authorization header (fetch) YOKI ?ct= (<img>). */
export function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim() || null
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get('ct')
  return fromQuery && fromQuery.length > 0 ? fromQuery : null
}

/**
 * Cache key — FAQAT origin + path. Query (token!) HECH QACHON kirmaydi:
 * bir xil immutable obyekt barcha authorized user'larga umumiy keshlanadi.
 */
export function buildCacheKey(pathname: string): string {
  return `https://qbank.kivvi.internal${pathname}`
}

function jsonError(status: number, code: string, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ERROR_CC,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function allowedOrigin(env: WorkerEnv, origin: string | null): string | null {
  if (!origin) return null
  const list = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list.includes(origin) ? origin : null
}

function corsHeaders(env: WorkerEnv, request: Request): Record<string, string> {
  const origin = allowedOrigin(env, request.headers.get('Origin'))
  if (!origin) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** Scope tekshiruvi: token faqat O'Z fani va O'Z versiyasiga. */
function checkScope(claims: ContentTokenClaims, path: ParsedContentPath): 'ok' | 'wrong_subject' | 'wrong_version' {
  if (claims.sid !== path.subject) return 'wrong_subject'
  if (path.kind !== 'image' && claims.v !== path.version) return 'wrong_version'
  return 'ok'
}

function track(env: WorkerEnv, point: Record<string, unknown>): void {
  try {
    env.QBANK_ANALYTICS?.writeDataPoint(point)
  } catch { /* metrika hech qachon so'rovni buzmaydi */ }
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  ctx: WorkerCtx,
  deps: { cache?: CacheLike | null } = {},
): Promise<Response> {
  const url = new URL(request.url)
  const cors = corsHeaders(env, request)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'method_not_allowed', cors)
  }

  const path = parseContentPath(url.pathname)
  if (!path) {
    track(env, { event: 'bad_path', status: 404 })
    return jsonError(404, 'not_found', cors)
  }

  // ── AUTH (cache'dan OLDIN!) ──────────────────────────────────────────────
  if (!env.CONTENT_TOKEN_SECRET) {
    // Fail-closed: secret sozlanmagan Worker kontent bermaydi
    return jsonError(503, 'content_delivery_unavailable', cors)
  }
  const token = extractToken(request)
  if (!token) {
    track(env, { event: 'auth', status: 401, reason: 'missing', kind: path.kind })
    return jsonError(401, 'token_required', cors)
  }
  const verified = await verifyContentToken(env.CONTENT_TOKEN_SECRET, token)
  if (!verified.ok) {
    track(env, { event: 'auth', status: 401, reason: verified.error, kind: path.kind })
    return jsonError(401, verified.error === 'expired' ? 'token_expired' : 'invalid_token', cors)
  }
  const scope = checkScope(verified.claims, path)
  if (scope !== 'ok') {
    track(env, { event: 'auth', status: 403, reason: scope, kind: path.kind, jti: verified.claims.jti })
    return jsonError(403, scope, cors)
  }

  // ── Rate limit (userId asosiy, IP fallback) ─────────────────────────────
  const ip = request.headers.get('CF-Connecting-IP')
  const rate = getLimiter(env).check(verified.claims.sub, ip)
  if (!rate.allowed) {
    track(env, { event: 'rate_limited', status: 429, by: rate.limitedBy, jti: verified.claims.jti })
    return jsonError(429, 'rate_limited', { ...cors, 'Retry-After': String(rate.retryAfterSec) })
  }

  // ── Edge cache (auth'dan KEYIN) ─────────────────────────────────────────
  const cache = deps.cache === undefined ? resolveCache() : deps.cache
  const cacheKey = buildCacheKey(url.pathname)
  if (cache) {
    const hit = await cache.match(new Request(cacheKey))
    if (hit) {
      track(env, { event: 'serve', status: 200, kind: path.kind, cache: 'HIT' })
      const headers = new Headers(hit.headers)
      for (const [k, v] of Object.entries(cors)) headers.set(k, v)
      headers.set('X-Cache', 'HIT')
      return new Response(hit.body, { status: 200, headers })
    }
  }

  // ── PRIVATE R2 ──────────────────────────────────────────────────────────
  const object = await env.QBANK.get(path.key)
  if (!object) {
    track(env, { event: 'serve', status: 404, kind: path.kind, cache: 'MISS' })
    return jsonError(404, 'not_found', cors)
  }

  const response = new Response(object.body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(path),
      'Cache-Control': IMMUTABLE_CC,
      'X-Content-Type-Options': 'nosniff',
      'X-Cache': 'MISS',
      ...cors,
    },
  })
  if (cache) {
    ctx.waitUntil(cache.put(new Request(cacheKey), response.clone()))
  }
  track(env, { event: 'serve', status: 200, kind: path.kind, cache: 'MISS', bytes: object.size ?? 0 })
  return response
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerCtx): Promise<Response> {
    try {
      // Davriy sweep — limiter xotirasi oshib ketmasin (har ~64 so'rovda)
      if (limiter && Math.random() < 0.015) limiter.sweep()
      return await handleRequest(request, env, ctx)
    } catch (err) {
      // Xom xato tafsilotlari client'ga chiqmaydi (ichki key/sir oshkor bo'lmasin)
      console.error('[qbank-worker] unhandled error:', err instanceof Error ? err.message : 'unknown')
      return jsonError(500, 'internal_error')
    }
  },
}
