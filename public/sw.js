/**
 * YHQ Service Worker — offline support for the Mini App.
 *
 * Strategy:
 *   - Hashed assets (/assets/, fonts)   → cache-first, cheksiz (hash bilan nomlangan)
 *   - Savol rasmlari (/images/)         → cache-first, ALOHIDA kesh + LRU cap
 *   - /api/questions, /api/topics (GET) → network-first, cache fallback
 *   - Page navigation                   → network-first (timeout), cached shell
 *   - Everything else (POST/mutations)  → bypass (never cached — per-user auth)
 */

const CACHE = 'yhq-app-v3'

// Savol rasmlari ALOHIDA keshda: /public/images ~84 MB va user ko'rgan har bir
// rasm keshga tushardi — cheklovsiz. Qurilma xotirasi vaqt o'tib shuncha tomon
// o'sardi. Alohida kesh + entry cap trimmingni app shell/assets'ga tegmasdan
// bajarish imkonini beradi (ular hash bilan nomlangan, o'chirilmasligi kerak).
const IMG_CACHE = 'yhq-img-v1'
// ~300 rasm x ~30 KB ≈ 9 MB. Bir imtihon seansi ~100 rasmdan oshmaydi,
// shuning uchun cap normal foydalanishda sezilmaydi.
const IMG_MAX_ENTRIES = 300

const isImageAsset = (path) => path.startsWith('/images/')

const isStaticAsset = (path) =>
  path.startsWith('/assets/') ||
  /\.(js|css|jpg|jpeg|png|webp|svg|woff2?)$/.test(path)

// Avatar — /api/ ostida, lekin bu RASM va deyarli o'zgarmaydi. Keshsiz
// bo'lgani uchun har ochilishda Vercel funksiyasi + DB ga round-trip ketardi
// va avatar sezilarli kech chiqardi.
const isAvatar = (path) => path.startsWith('/api/avatar/')

// Savol va mavzular ma'lumotlari — faqat public ro'yxatlar (/api/questions, /api/topics).
// Izohlar (/api/questions/:id/explanation) post-answer auth-gated va no-store bo'lgani uchun
// SW tomonidan KESHLANMAYDI (ID 09).
const isQuestionData = (path) => {
  if (path.includes('/explanation')) return false
  return path === '/api/questions' || path.startsWith('/api/questions?') ||
         path === '/api/topics' || path.startsWith('/api/topics?')
}

// Vercel `/` va `/index.html` ni `Cache-Control: no-store` bilan beradi —
// Cache API no-store javobni SAQLASHNI RAD ETADI (TypeError → shell hech qachon
// cache'lanmardi → offline'da ilova umuman ochilmardi). Navigatsiya shell uchun header'larni tozalaymiz.
// Lekin API/dinamik private/no-store javoblar (masalan /explanation) keshga SAQLANMAYDI (ID 09).
function storable(request, response) {
  if (!response.ok) return null
  const cc = (response.headers && typeof response.headers.get === 'function' ? response.headers.get('cache-control') : '') || ''
  if (cc.includes('no-store') || cc.includes('private')) {
    const url = typeof request === 'string' ? request : (request && request.url) || ''
    let pathname = ''
    try { pathname = new URL(url, self.location.origin).pathname } catch { pathname = url }
    const isNavigationShell = pathname === '/' || pathname === '/index.html' || pathname === '/app.html'
    if (!isNavigationShell) {
      return null
    }
  }
  const headers = new Headers(response.headers)
  headers.delete('cache-control')
  return new Response(response.body, { status: response.status, headers })
}

async function putInCache(request, response) {
  const clean = storable(request, response)
  if (!clean) return
  const cache = await caches.open(CACHE)
  await cache.put(request, clean)
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop outdated caches — IMG_CACHE ham SAQLANADI (aks holda har
      // activate'da userning butun rasm keshi qayta yuklanardi).
      const keep = new Set([CACHE, IMG_CACHE])
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))

      // Migratsiya: eski versiyalarda rasmlar CACHE ichida, CHEKLOVSIZ yig'ilgan.
      // Ularni bir marta tozalaymiz — kerakli rasm IMG_CACHE ga qayta tushadi.
      const appCache = await caches.open(CACHE)
      const stale = (await appCache.keys()).filter((req) => {
        try { return isImageAsset(new URL(req.url).pathname) } catch { return false }
      })
      await Promise.all(stale.map((req) => appCache.delete(req)))

      await self.clients.claim()
    })()
  )
})

// Bir vaqtda bitta trim — parallel fetch'lar keys() ni birga kesmasligi uchun
let trimming = false

/** Rasm keshini IMG_MAX_ENTRIES gacha qisqartiradi (eng eskisidan boshlab).
 *  cache.keys() QO'SHILISH TARTIBIDA qaytaradi, `touch` esa ko'rilgan rasmni
 *  oxiriga suradi — natijada o'chirilayotgani eng uzoq ko'rilmagani bo'ladi. */
async function trimImageCache() {
  if (trimming) return
  trimming = true
  try {
    const cache = await caches.open(IMG_CACHE)
    const keys = await cache.keys()
    const excess = keys.length - IMG_MAX_ENTRIES
    if (excess > 0) {
      await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)))
    }
  } catch { /* kvota/race — kesh bo'lmasa ham ilova ishlayveradi */ } finally {
    trimming = false
  }
}

/**
 * event.waitUntil() ni XAVFSIZ chaqiradi.
 *
 * waitUntil event "active" bo'lmaganda InvalidStateError tashlaydi. Biz uni
 * respondWith ichida, `await` dan KEYIN chaqiramiz — amalda event hamon
 * active (respondWith promise'i kutilmoqda), lekin agar biror WebView boshqacha
 * yo'l tutsa, tashlangan xato handler'ni sindirib RASMNI umuman yuklatmasdi.
 * Fon ishi baribir boshlangan bo'ladi — waitUntil faqat SW umrini uzaytiradi.
 */
function keepAlive(event, promise) {
  try { event.waitUntil(promise) } catch { /* event yopilgan — fon ishi baribir ketadi */ }
}

/** LRU "touch": delete + put yozuvni qo'shilish tartibining OXIRIGA suradi. */
async function touchImage(request, response) {
  try {
    const cache = await caches.open(IMG_CACHE)
    await cache.delete(request)
    await cache.put(request, response)
  } catch { /* ignore */ }
}

/** Keshdagi app shell ('/' yoki '/index.html').
 *  Global caches.match() EMAS — u BARCHA keshlarni, jumladan yuzlab yozuvli
 *  IMG_CACHE ni ham skanerlaydi. Navigatsiya har ochilishda shu yo'ldan
 *  o'tgani uchun qidiruv CACHE bilan cheklanadi. */
async function cachedShell() {
  const cache = await caches.open(CACHE)
  return (await cache.match('/')) || (await cache.match('/index.html'))
}

const NAV_TIMEOUT_MS = 1500

async function handleNavigate(request) {
  // Tarmoq so'rovi HAR DOIM yuboriladi — timeout'da ham u keshni yangilaydi.
  const network = fetch(request).then((res) => {
    if (res.ok) void putInCache('/', res.clone())
    return res
  })

  const shell = await cachedShell()
  if (!shell) {
    // Kesh bo'sh (birinchi kirish) — tarmoqdan boshqa chora yo'q
    return network.catch(() => new Response('', { status: 504 }))
  }

  // Kesh bor: tarmoq NAV_TIMEOUT_MS ichida ulgursa — yangi javob, aks holda shell.
  return Promise.race([
    network.catch(() => shell),
    new Promise((resolve) => setTimeout(() => resolve(shell), NAV_TIMEOUT_MS)),
  ])
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation — network-first, LEKIN timeout bilan (boot perf).
  //
  // Ilgari toza network-first edi: sekin tarmoqda cache'da tayyor shell tursa
  // ham har cold start to'liq round-trip kutardi (Telegram WebView'da bu ko'p
  // hollarda 1-3 s). Endi NAV_TIMEOUT_MS ichida javob kelmasa keshdagi shell
  // darhol beriladi; tarmoq javobi baribir fon rejimida keshni yangilaydi,
  // shuning uchun keyingi ochilish yangi bo'ladi.
  //
  // Eski `caches.match('/') ?? caches.match('/index.html')` ISHLAMASDI:
  // caches.match() HAR DOIM Promise qaytaradi (hech qachon null emas), ya'ni
  // `??` o'ng tomonga hech qachon o'tmasdi va '/' keshda bo'lmasa offline
  // fallback umuman yo'q edi.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request))
    return
  }

  // Avatar — stale-while-revalidate: keshdagi nusxa DARHOL beriladi, yangisi
  // orqa fonda olinadi (user avatarni almashtirsa keyingi ochilishda ko'rinadi).
  // IMG_CACHE ichida — LRU cap avatarlarga ham tegishli bo'lsin.
  if (isAvatar(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMG_CACHE)
        const hit = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            const clean = storable(request, res.clone())
            if (clean) void cache.put(request, clean).then(trimImageCache).catch(() => {})
            return res
          })
        if (hit) {
          keepAlive(event, network.catch(() => {}))
          return hit
        }
        return network
      })()
    )
    return
  }

  // Savol rasmlari — cache-first + LRU cap (isStaticAsset'dan OLDIN turishi
  // SHART: undagi regex .jpg/.png/.webp ga ham mos keladi va cheklovsiz
  // CACHE'ga yozib yuborardi).
  if (isImageAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMG_CACHE)
        const hit = await cache.match(request)
        if (hit) {
          // Javobga xalaqit bermaydi — respondWith hali kutilmoqda,
          // shuning uchun event hamon "active" va waitUntil qabul qilinadi.
          keepAlive(event, touchImage(request, hit.clone()))
          return hit
        }
        const res = await fetch(request)
        const clean = storable(request, res.clone())
        if (clean) {
          keepAlive(event, cache.put(request, clean).then(trimImageCache).catch(() => {}))
        }
        return res
      })()
    )
    return
  }

  // Static / hashed content — cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        void putInCache(request, res.clone())
        return res
      })()
    )
    return
  }

  // Question data — network first, cached copy offline
  if (isQuestionData(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => { void putInCache(request, res.clone()); return res })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          // Kesh ham yo'q — 504. Bo'sh massiv qaytarish MUMKIN EMAS: store
          // `loaded: true, questions: []` deb yozib qo'yardi va boshqa qayta
          // urinmasdi. Xato bo'lsa store error holatiga tushadi va retry qiladi.
          return (await cache.match(request)) || new Response('', { status: 504 })
        })
    )
    return
  }
})
