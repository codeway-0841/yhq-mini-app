/**
 * YHQ Service Worker — offline support for the Mini App.
 *
 * Strategy:
 *   - Hashed assets & question images   → cache-first (immutable content)
 *   - /api/questions, /api/topics (GET) → network-first, cache fallback
 *   - Page navigation                   → network-first, cached shell fallback
 *   - Everything else (POST/mutations)  → bypass (never cached — per-user auth)
 */

const CACHE = 'yhq-app-v2'

const isStaticAsset = (path) =>
  path.startsWith('/assets/') ||
  path.startsWith('/images/') ||
  /\.(js|css|jpg|jpeg|png|webp|svg|woff2?)$/.test(path)

const isQuestionData = (path) =>
  path.startsWith('/api/questions') || path.startsWith('/api/topics')

async function putInCache(request, response) {
  if (!response.ok) return
  const cache = await caches.open(CACHE)
  await cache.put(request, response.clone())
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop outdated caches
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation — network first, fall back to cached app shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { putInCache('/', res.clone()); return res })
        .catch(() => caches.match('/') ?? caches.match('/index.html'))
    )
    return
  }

  // Static / hashed content — cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) => hit ?? fetch(request).then((res) => { putInCache(request, res); return res })
      )
    )
    return
  }

  // Question data — network first, cached copy offline
  if (isQuestionData(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => { putInCache(request, res); return res })
        .catch(() => caches.match(request))
    )
    return
  }
})
