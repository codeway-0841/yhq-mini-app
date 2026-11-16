import { isNativeApp } from '../../platform/native'

/**
 * Cloudflare CDN / R2 URL Resolution & Caching Utilities
 *
 * All static media assets (badges, road signs, book/course icons, author portraits,
 * onboarding artwork, interactive lessons, pdfjs assets, and Rive animations)
 * can be served through the Cloudflare CDN / public R2 bucket.
 */

const RAW_CDN_BASE = (
  (import.meta.env['VITE_CLOUDFLARE_CDN_URL'] as string | undefined) ||
  (import.meta.env['VITE_CDN_URL'] as string | undefined) ||
  ''
).trim().replace(/\/+$/, '')

/**
 * Canonical Cloudflare CDN base URL (from build env when configured)
 */
export const CDN_BASE = RAW_CDN_BASE

/** Public Cloudflare R2 media CDN origin (`kivvi-library` bucket) */
export const PUBLIC_R2_CDN_URL = 'https://pub-959db3d04308444d93ae4013d976e0ec.r2.dev'

/** Canonical web origin for static assets hosted via Vercel (`yhq`, `math-print`, etc.) */
export const KIVVI_WEB_CDN_URL = 'https://kivvi.uz'

const R2_MEDIA_PREFIXES = [
  '/images/signs/',
  '/images/authors/',
  '/images/onboarding/',
  '/badges/',
  '/leagues/',
  '/brilliant/courses/',
  '/lessons/',
  '/pdfjs/',
] as const

const WEB_MEDIA_PREFIXES = [
  '/images/yhq/',
  '/math-print/',
  '/physics-print/',
  '/kutubxona/',
] as const

const RIVE_CACHE_NAME = 'kivvi-r2-rive-v1'
const RIVE_FETCH_TIMEOUT_MS = 10_000
const rivBufferCache = new Map<string, Promise<ArrayBuffer>>()

function isHtmlResponse(res: Response): boolean {
  const ct = res.headers?.get?.('content-type')?.toLowerCase() ?? ''
  return ct.includes('text/html')
}

function isValidRiveBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const header = new Uint8Array(buf, 0, 4)
  // Barcha .riv binar fayllari ASCII "RIVE" sarlavhasi bilan boshlanadi
  return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x56 && header[3] === 0x45
}

async function fetchWithTimeout(url: string, timeoutMs = RIVE_FETCH_TIMEOUT_MS): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Resolves any relative asset path or full URL through Cloudflare CDN / R2.
 */
export function resolveCdnUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return null

  // Already absolute or inline data URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (CDN_BASE) {
    return `${CDN_BASE}${normalizedPath}`
  }
  if (isNativeApp()) {
    if (R2_MEDIA_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
      return `${PUBLIC_R2_CDN_URL}${normalizedPath}`
    }
    if (WEB_MEDIA_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
      return `${KIVVI_WEB_CDN_URL}${normalizedPath}`
    }
  }
  return normalizedPath
}

async function fetchRiveRemoteWithCache(localPath: string): Promise<ArrayBuffer> {
  const r2Url = `${CDN_BASE || PUBLIC_R2_CDN_URL}${localPath}`
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(RIVE_CACHE_NAME)
      const hit = await cache.match(r2Url)
      if (hit) {
        const cachedBuf = await hit.arrayBuffer()
        if (isValidRiveBuffer(cachedBuf)) return cachedBuf
        await cache.delete(r2Url).catch(() => undefined)
      }
    } catch {
      // CacheStorage mavjud bo'lmasa tarmoqdan o'qishda davom etamiz
    }
  }

  const candidates = r2Url.startsWith(KIVVI_WEB_CDN_URL) ? [r2Url] : [r2Url, `${KIVVI_WEB_CDN_URL}${localPath}`]
  let lastStatus = 0
  for (const remoteUrl of candidates) {
    try {
      const res = await fetchWithTimeout(remoteUrl)
      if (!res.ok || isHtmlResponse(res)) {
        lastStatus = res.status
        continue
      }
      const buf = await res.arrayBuffer()
      if (!isValidRiveBuffer(buf)) continue
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(RIVE_CACHE_NAME)
          await cache.put(
            r2Url,
            new Response(buf.slice(0), {
              status: 200,
              headers: { 'Content-Type': 'application/octet-stream' },
            }),
          )
        } catch {
          // Keshga yozilmasa ham tasdiqlangan buffer'ni qaytaramiz
        }
      }
      return buf
    } catch {
      // Timeout yoki tarmoq xatosi bo'lsa navbatdagi fallback URL'ni sinab ko'ramiz
    }
  }
  throw new Error(`Failed to load ${localPath}${lastStatus ? `: HTTP ${lastStatus}` : ''}`)
}

async function resolveRiveBuffer(localPath: string): Promise<ArrayBuffer> {
  const localRes = await fetch(localPath).catch(() => null)
  if (localRes && localRes.ok && !isHtmlResponse(localRes)) {
    const localBuf = await localRes.arrayBuffer().catch(() => null)
    if (localBuf && isValidRiveBuffer(localBuf)) return localBuf
  }
  if (isNativeApp() || CDN_BASE) {
    return fetchRiveRemoteWithCache(localPath)
  }
  throw new Error(`Failed to load ${localPath}${localRes ? `: HTTP ${localRes.status}` : ''}`)
}

/**
 * Rive (.riv) buferini yuklaydi:
 *  1) Avval lokal bundle'dan (<3ms, oflayn)
 *  2) APK ichidan chiqarilgan fayllar uchun: persistent CacheStorage → Cloudflare R2 (10s timeout) → kivvi.uz
 */
export function fetchRiveAssetBuffer(file: string): Promise<ArrayBuffer> {
  const localPath = file.startsWith('/') ? file : `/brilliant/${file}`
  let promise = rivBufferCache.get(localPath)
  if (!promise) {
    promise = resolveRiveBuffer(localPath)
    promise.catch(() => { rivBufferCache.delete(localPath) })
    rivBufferCache.set(localPath, promise)
  }
  return promise
}

/**
 * R2 ga chiqarilgan ikkilamchi .riv fayllarni fon rejimida CacheStorage'ga oldindan yozadi.
 * RAM xotirasini band qilmaydi va oflayn/tarmoq xatosida darhol to'xtaydi.
 */
export async function warmRiveAssetCache(files: readonly string[]): Promise<void> {
  if (!isNativeApp() && !CDN_BASE) return
  if (typeof window === 'undefined' || typeof fetch !== 'function' || typeof caches === 'undefined') return

  let cache: Cache
  try {
    cache = await caches.open(RIVE_CACHE_NAME)
  } catch {
    return
  }

  let consecutiveFailures = 0
  for (const file of files) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) break
    const localPath = file.startsWith('/') ? file : `/brilliant/${file}`
    if (rivBufferCache.has(localPath)) continue

    const r2Url = `${CDN_BASE || PUBLIC_R2_CDN_URL}${localPath}`
    try {
      const hit = await cache.match(r2Url)
      if (hit) continue
      // Lokal APK ichida mavjud bo'lsa tarmoqdan qayta yuklamaymiz
      const headRes = await fetch(localPath, { method: 'HEAD' }).catch(() => null)
      if (headRes && headRes.ok && !isHtmlResponse(headRes)) continue

      await fetchRiveRemoteWithCache(localPath)
      consecutiveFailures = 0
    } catch {
      consecutiveFailures += 1
      if (consecutiveFailures >= 2) break
    }
  }
}

/**
 * Resolves badge asset URL
 */
export function resolveBadgeUrl(badgeImage: string | null | undefined): string | null {
  return resolveCdnUrl(badgeImage)
}

/**
 * Resolves book/course cover asset URL
 */
export function resolveCoverUrl(coverImage: string | null | undefined): string | null {
  return resolveCdnUrl(coverImage)
}

/**
 * Resolves question / test image URL
 */
export function resolveTestImageUrl(image: string | null | undefined): string | null {
  return resolveCdnUrl(image)
}
