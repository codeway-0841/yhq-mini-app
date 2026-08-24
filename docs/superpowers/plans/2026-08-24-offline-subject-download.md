# Fanni oflayn yuklab olish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foydalanuvchi faol fanning barcha savollarini (matn + variantlar + rasmlar + javob kaliti) bitta bosish bilan qurilmasiga yuklab, internet umuman bo'lmasa ham darhol to'g'ri/xato ko'rib mashq qila olsin — natija hisobga (XP/coin/streak/liga) yozilmasdan.

**Architecture:** Yangi `requireAuth`li backend endpoint javob kaliti bilan to'liq savol to'plamini qaytaradi; frontend uni + rasmlarni Cache API'ga (har fan — alohida nomlangan kesh) yozadi. `useQuestionsStore.load()` online urinish muvaffaqiyatsiz bo'lsa shu keshga qaytadi va `isOfflinePractice` bayrog'ini ko'taradi; `TestPage.tsx` shu bayroqqa qarab javobni serverga yubormasdan lokal tekshiradi.

**Tech Stack:** Express + Zod (backend), React + Zustand + Cache API (frontend), Vitest + Supertest + Testing Library (testlar).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-24-offline-subject-download-design.md` (foydalanuvchi tomonidan tasdiqlangan).
- **CLAUDE.md qoida #8** (Scoring trust): `GET /questions` correctAnswer qaytarmaydi — bu YANGI endpoint YAGONA ataylab qilingan istisno, sababi kodda izohlanishi SHART.
- **CLAUDE.md qoida #10** (i18n): har bir yangi matn kaliti UZ **va** RU bilan qo'shiladi.
- **CLAUDE.md qoida #4** (API validation): yangi endpoint zod orqali query'ni tekshiradi.
- Barcha yangi kod TypeScript strict rejimda (`npx tsc -p tsconfig.json --noEmit` / `tsconfig.server.json`) xatosiz kompilyatsiya qilishi shart.
- Har bir task oxirida commit — alohida, tavsiflovchi xabar bilan (repo konvensiyasi: `feat(...)`/`fix(...)`/`test(...)`/`docs(...)`).

---

## Task 1: Backend — `/api/offline-package` endpoint

**Files:**
- Modify: `server/modules/questions/questions.router.ts`
- Test: `tests/unit/server/questions.router.test.ts`

**Interfaces:**
- Consumes: `resolveSubject` (`../../config/subjects`), `getProvider` (`../../providers`), `requireAuth` (`../../middleware/auth`), mavjud `contentLimit`/`wrap`/`CONTENT_CACHE`.
- Produces: `GET /api/offline-package?subject=<id>` — 401 (auth yo'q), 400 (noto'g'ri query), 200 + `QuestionRow[]` (JSON, **`correctAnswer` BILAN**, `toPublic()` chaqirilmaydi).

**KRITIK TOPILMA (spec'da yo'q edi — kod o'qib aniqlandi):** `server/middleware/auth.ts`dagi `PUBLIC_GET = new Set(['questions', 'topics', 'dashboard', 'avatar'])` tekshiruvi **birinchi path segmenti** bo'yicha ishlaydi (`normalized.split('/').filter(Boolean)[0]`). Agar yo'l `/questions/offline-package` deb nomlansa, `telegramAuth` uni `isPublicGet()===true` deb hisoblab **credential tekshiruvini butunlay o'tkazib yuboradi** (`server/middleware/auth.ts:197`, `{ next(); return }`) — natijada `req.userId` HECH QACHON o'rnatilmaydi va route'dagi `requireAuth` doim 401 qaytaradi, hatto to'g'ri Telegram initData yuborilganda ham. Shuning uchun yo'l ataylab **`/offline-package`** (`questions` bilan boshlanmaydi, `PUBLIC_GET`ga tegmaydi) — `requireAuth` to'g'ri ishlashi uchun.

- [ ] **Step 1: Write the failing tests**

`tests/unit/server/questions.router.test.ts` faylining oxiriga (`})` yopilishidan OLDIN, mavjud `describe('GET /api/questions/:questionId/explanation'...)` blokidan keyin) qo'shiladi:

```ts
  describe('GET /api/offline-package', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/offline-package?subject=yhq').expect(401)
      expect(res.body.error).toBeDefined()
    })

    it('returns questions WITH correctAnswer for authenticated requests', async () => {
      const mockQuestions = [
        {
          id: 1,
          questionUz: 'Savol 1',
          questionRu: 'Вопрос 1',
          optionsUz: { a: '1', b: '2' },
          optionsRu: { a: '1', b: '2' },
          correctAnswer: 'a',
          image: null,
          topicId: 1,
        },
      ]
      vi.spyOn(providers, 'getProvider').mockReturnValue({
        getAllQuestions: vi.fn().mockResolvedValue(mockQuestions),
        getQuestionsByTopic: vi.fn().mockResolvedValue(mockQuestions),
        getTopics: vi.fn().mockResolvedValue([]),
        getQuestionById: vi.fn().mockResolvedValue(mockQuestions[0]),
      } as any)

      // Dev/test muhitida imzosiz initData fallback qabul qilinadi
      // (server/middleware/auth.ts — devUnverifiedTelegramId, isAuthEnforced()===false).
      const FAKE_INIT_DATA =
        'query_id=DEV&user=%7B%22id%22%3A999999999%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1723000000&hash=dev'

      const res = await request(app)
        .get('/api/offline-package?subject=yhq')
        .set('x-telegram-init-data', FAKE_INIT_DATA)
        .expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].correctAnswer).toBe('a')
      expect(res.body[0].questionUz).toBe('Savol 1')
    })

    it('returns 400 for invalid query parameters', async () => {
      const FAKE_INIT_DATA =
        'query_id=DEV&user=%7B%22id%22%3A999999999%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1723000000&hash=dev'
      const res = await request(app)
        .get('/api/offline-package?subject=' + 'x'.repeat(40))
        .set('x-telegram-init-data', FAKE_INIT_DATA)
        .expect(400)
      expect(res.body.error).toBe("Noto'g'ri so'rov parametrlari")
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/server/questions.router.test.ts`
Expected: 3 yangi test FAIL (route mavjud emas — 404 qaytaradi, 401/200/400 emas).

- [ ] **Step 3: Implement the endpoint**

`server/modules/questions/questions.router.ts` — import qatoriga qo'shiladi (mavjud importlardan keyin, 6-qatordan keyin):

```ts
import { requireAuth } from '../../middleware/auth'
```

`/questions` handler'idan keyin (37-66 qatorlar orasidagi mavjud blokdan keyin), `/topics` handler'idan OLDIN qo'shiladi:

```ts
const OfflinePackageQuery = z.object({
  subject: z.string().max(32).optional(),
})

/**
 * GET /api/offline-package?subject=yhq
 *
 * Oflayn mashq uchun — javob kaliti (correctAnswer) BILAN qaytaradi.
 * DIQQAT: bu YAGONA joy repo bo'ylab — correctAnswer ataylab client'ga
 * yuboriladi. Xavfsiz, chunki oflayn-mashq javoblari HECH QACHON
 * /progress/:userId/result'ga yuborilmaydi (src/features/test/TestPage.tsx,
 * isOfflinePractice tekshiruvi) — kalitni bilish reyting/coin'ni aldash
 * uchun ishlatib bo'lmaydi (bu yo'l butunlay yopiq).
 *
 * Yo'l ATAYLAB '/questions/...' PREFIKSSIZ: server/middleware/auth.ts'dagi
 * PUBLIC_GET birinchi segmenti 'questions' bo'lgan HAR QANDAY yo'lni
 * telegramAuth'da to'liq credential-tekshiruvsiz o'tkazadi — req.userId
 * hech qachon o'rnatilmaydi, requireAuth doim 401 qaytarardi.
 */
router.get('/offline-package', requireAuth, contentLimit, wrap(async (req, res) => {
  const parsed = OfflinePackageQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Noto\'g\'ri so\'rov parametrlari' })
    return
  }
  const entry    = resolveSubject(parsed.data.subject)
  const provider = getProvider(entry.dataSourceId)
  const rows     = await provider.getAllQuestions()

  res.set('Cache-Control', CONTENT_CACHE)
  res.set('X-Data-Source', entry.dataSourceId)
  res.json(rows)   // toPublic() CHAQIRILMAYDI — correctAnswer qoladi
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/server/questions.router.test.ts`
Expected: barcha testlar PASS (eski + 3 yangi).

- [ ] **Step 5: Commit**

```bash
git add server/modules/questions/questions.router.ts tests/unit/server/questions.router.test.ts
git commit -m "feat(offline): add authenticated offline-package endpoint with answer key"
```

---

## Task 2: Service worker — oflayn keshni tozalashdan himoya qilish

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Produces: `OFFLINE_CACHE_PREFIX = 'yhq-offline-'` konstantasi — Task 3 shu prefiksga mos nom bilan kesh yaratadi.

**KRITIK TOPILMA:** `sw.js`ning `activate` handleri (38-49 qatorlar) `CACHE`dan (`'yhq-app-v3'`) BOSHQA barcha keshlarni o'chiradi — bu har SW yangilanishida (har deploy'da) ishlaydi. Task 3'da yaratiladigan `yhq-offline-<subjectId>` keshlari, agar himoyalanmasa, foydalanuvchi ilovani yangilagan zahoti (masalan keyingi safar ochganda) **jimgina o'chib ketadi** — qishloqda yuklab olingan kontent birinchi update'da yo'qoladi. Bu `isQuestionData()`ga yangi yo'l qo'shishdan (spec'da taxmin qilingan, lekin kerak emas — `path.startsWith('/api/questions')` allaqachon `/api/offline-package`ga TEGMAYDI ham, chunki bu endpoint `/questions` bilan boshlanmaydi, va aslida uni SW orqali reaktiv keshlashning HOJATI yo'q — Task 3 buni to'g'ridan-to'g'ri `caches.open()` bilan yozadi) ko'ra ko'proq muhim tuzatish.

- [ ] **Step 1: Verify current behavior (manual — SW browser-only, avtomatlashtirilgan test yo'q)**

`public/sw.js`da hozirgi `activate` handlerini o'qib tasdiqlang: 40-49 qatorlar `CACHE`dan boshqa HAMMA nomni o'chiradi. Bu keyingi qadamda tuzatiladi.

- [ ] **Step 2: Modify sw.js**

`public/sw.js`, 11-qator atrofi (`const CACHE = 'yhq-app-v3'`dan keyin) — yangi konstanta qo'shiladi:

```js
const CACHE = 'yhq-app-v3'
// Oflayn fan-paketlari (Task 3, src/shared/lib/offlinePackage.ts) shu prefiks
// bilan nomlangan alohida keshlarga yoziladi — activate cleanup'da SAQLANADI
// (foydalanuvchi ataylab yuklab olgan kontent app-update'da o'chib ketmasin).
const OFFLINE_CACHE_PREFIX = 'yhq-offline-'
```

`activate` handleridagi (40-49 qatorlar) cleanup qatori:

```js
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
```

quyidagicha o'zgartiriladi:

```js
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== CACHE && !k.startsWith(OFFLINE_CACHE_PREFIX)).map((k) => caches.delete(k))
      )
```

- [ ] **Step 3: Manual verify (prod build kerak — SW faqat import.meta.env.PROD'da ishlaydi)**

Bu qadam Task 8 (yakuniy verifikatsiya)da, to'liq feature tayyor bo'lgach, birga qilinadi — hozircha kod o'zgarishi yetarli.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "fix(sw): preserve offline-package caches on service worker activate"
```

---

## Task 3: `offlinePackage.ts` — yuklash/tekshirish/o'chirish

**Files:**
- Create: `src/shared/lib/offlinePackage.ts`
- Test: `tests/unit/lib/offlinePackage.test.ts`

**Interfaces:**
- Consumes: `AdminDbQuestion` (`../api`, mavjud tip — `DbQuestion & { correctAnswer: string }`).
- Produces:
  - `type OfflineQuestionRow = AdminDbQuestion`
  - `interface DownloadProgress { done: number; total: number; percent: number }`
  - `downloadSubjectOffline(subjectId: string, onProgress: (p: DownloadProgress) => void): Promise<void>`
  - `isSubjectDownloaded(subjectId: string): Promise<boolean>`
  - `deleteSubjectOffline(subjectId: string): Promise<void>`
  - `readOfflinePackage(subjectId: string): Promise<OfflineQuestionRow[] | null>`

Task 5 (`useQuestionsStore`) `readOfflinePackage` chaqiradi; Task 6 (`OfflinePage`) `downloadSubjectOffline`/`isSubjectDownloaded`/`deleteSubjectOffline` chaqiradi.

- [ ] **Step 1: Write the failing tests**

`tests/unit/lib/offlinePackage.test.ts` (yangi fayl) — `tests/unit/lib/outbox.test.ts`dagi `vi.stubGlobal` naqshiga mos, Cache API'ning minimal in-memory taqlidi bilan:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lib/offlinePackage.test.ts`
Expected: FAIL — `Cannot find module '../../../src/shared/lib/offlinePackage'`.

- [ ] **Step 3: Implement**

`src/shared/lib/offlinePackage.ts` (yangi fayl):

```ts
/**
 * Fanni oflayn yuklab olish — Cache API asosida, har fan alohida nomlangan
 * keshda ('yhq-offline-<subjectId>'). public/sw.js'ning activate cleanup'i
 * shu prefiksni ataylab saqlab qoladi (Task 2).
 *
 * Bu paket javob kaliti (correctAnswer) BILAN keladi — faqat oflayn-mashq
 * uchun (src/shared/store/useQuestionsStore.ts), hisobga YOZILMAYDI.
 */
import type { AdminDbQuestion } from '../api'

export type OfflineQuestionRow = AdminDbQuestion

export interface DownloadProgress { done: number; total: number; percent: number }

const CACHE_PREFIX = 'yhq-offline-'

function cacheNameFor(subjectId: string): string {
  return `${CACHE_PREFIX}${subjectId}`
}

function packageUrl(subjectId: string): string {
  return `/api/offline-package?subject=${encodeURIComponent(subjectId)}`
}

export async function downloadSubjectOffline(
  subjectId: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const cache = await caches.open(cacheNameFor(subjectId))
  const url = packageUrl(subjectId)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`offline-package fetch failed: ${res.status}`)
  const rows: OfflineQuestionRow[] = await res.clone().json()
  await cache.put(url, res)

  const images = [...new Set(rows.map((r) => r.image).filter((x): x is string => !!x))]
  const total = images.length + 1
  onProgress({ done: 1, total, percent: Math.round(100 / total) })

  for (let i = 0; i < images.length; i++) {
    const imgUrl = images[i]!
    try {
      const imgRes = await fetch(imgUrl)
      if (imgRes.ok) await cache.put(imgUrl, imgRes)
    } catch (err) {
      // Bitta rasm muvaffaqiyatsiz bo'lsa ham yuklash davom etadi — qayta
      // "Yuklab olish" bosilsa allaqachon keshdagilar qayta so'ralmaydi
      // (bu funksiya ularni ham qayta fetch qiladi hozircha — YAGNI: birinchi
      // versiyada "faqat yetishmaganlarni qayta so'rash" optimallashtirilmaydi).
      console.warn('[offlinePackage] rasm yuklanmadi:', imgUrl, (err as Error)?.message ?? err)
    }
    onProgress({ done: i + 2, total, percent: Math.round(((i + 2) / total) * 100) })
  }
}

export async function isSubjectDownloaded(subjectId: string): Promise<boolean> {
  const cache = await caches.open(cacheNameFor(subjectId))
  const match = await cache.match(packageUrl(subjectId))
  return !!match
}

export async function deleteSubjectOffline(subjectId: string): Promise<void> {
  await caches.delete(cacheNameFor(subjectId))
}

export async function readOfflinePackage(subjectId: string): Promise<OfflineQuestionRow[] | null> {
  const cache = await caches.open(cacheNameFor(subjectId))
  const match = await cache.match(packageUrl(subjectId))
  if (!match) return null
  return match.json()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/offlinePackage.test.ts`
Expected: barcha testlar PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/offlinePackage.ts tests/unit/lib/offlinePackage.test.ts
git commit -m "feat(offline): add per-subject download/check/delete cache library"
```

---

## Task 4: i18n kalitlari (UZ + RU)

**Files:**
- Modify: `src/shared/i18n/index.ts`

**Interfaces:**
- Produces: quyidagi kalitlar — Task 6 (OfflinePage) va Task 7 (TestPage banner) ishlatadi.

- [ ] **Step 1: UZ blokka qo'shish**

`src/shared/i18n/index.ts` — 2026-08-24 sessiyasida qo'shilgan `"// ── Progress explainers..."` blokidan keyin (`gotItBtn: "Tushunarli",` qatoridan keyin, `// ── Lucky Spin` izohidan OLDIN):

```ts
  // ── Fanni oflayn yuklab olish (2026-08-24) ──
  offlineScreenTitle: "Oflayn rejim",
  offlineScreenDesc: "Internet bo'lmaganda ham ishlashi uchun kerakli narsalarni telefoningizga saqlab qo'ying.",
  offlineDownloadTitle: "Oflayn rasmlarni yuklash",
  offlineDownloadDesc: "Barcha savol rasmlarini yuklab oling",
  offlineDownloadBtn: "Yuklab olish",
  offlineDeleteBtn: "O'chirish",
  offlineConfirmSheetTitle: "Oflayn rejimda foydalaning",
  offlineConfirmSheetDesc: "Barcha savol rasmlarini yuklab oling va internetga ulanmasdan test yeching",
  offlineConfirmSheetConfirm: "Rasmlarni yuklash",
  offlineConfirmSheetCancel: "Hozir emas",
  offlineDeleteSheetTitle: "Oflayn rejimni o'chirish",
  offlineDeleteSheetDesc: "Yuklab olingan barcha rasmlar qurilmangizdan o'chiriladi. Keyingi testlarda rasmlar internet orqali yuklanadi.",
  offlineDeleteSheetConfirm: "Ha, o'chirish",
  offlineDeleteSheetCancel: "Bekor qilish",
  offlinePracticeBanner: "Oflayn mashq — natija hisobga yozilmaydi",
  offlineDownloadFailed: "Yuklab bo'lmadi. Qaytadan urinib ko'ring",
```

- [ ] **Step 2: RU blokka qo'shish**

RU bloqidagi mos joyga (`gotItBtn: "Понятно",` qatoridan keyin, `// ── Колесо удачи` izohidan OLDIN):

```ts
  // ── Скачивание предмета офлайн (2026-08-24) ──
  offlineScreenTitle: "Офлайн-режим",
  offlineScreenDesc: "Сохраните на телефон всё необходимое, чтобы пользоваться приложением даже без интернета.",
  offlineDownloadTitle: "Скачать офлайн-изображения",
  offlineDownloadDesc: "Скачайте изображения всех вопросов",
  offlineDownloadBtn: "Скачать",
  offlineDeleteBtn: "Удалить",
  offlineConfirmSheetTitle: "Используйте офлайн-режим",
  offlineConfirmSheetDesc: "Скачайте изображения всех вопросов и решайте тесты без подключения к интернету",
  offlineConfirmSheetConfirm: "Скачать изображения",
  offlineConfirmSheetCancel: "Не сейчас",
  offlineDeleteSheetTitle: "Отключить офлайн-режим",
  offlineDeleteSheetDesc: "Все скачанные изображения будут удалены с устройства. В следующих тестах изображения будут загружаться из интернета.",
  offlineDeleteSheetConfirm: "Да, удалить",
  offlineDeleteSheetCancel: "Отмена",
  offlinePracticeBanner: "Офлайн-практика — результат не засчитывается",
  offlineDownloadFailed: "Не удалось скачать. Попробуйте снова",
```

- [ ] **Step 3: Verify type-check catches any UZ/RU key mismatch**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 0 xato (UZ/RU kalitlar soni/nomlari mos bo'lsa; mos bo'lmasa `LANGS` tayinlashda xato chiqadi — `src/shared/i18n/index.ts:812` atrofida).

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/index.ts
git commit -m "feat(i18n): add offline subject download UZ+RU strings"
```

---

## Task 5: `useQuestionsStore` — oflayn fallback

**Files:**
- Modify: `src/shared/store/useQuestionsStore.ts`
- Test: `tests/unit/store/useQuestionsStore.test.ts` (yangi fayl — hozir bu store uchun test yo'q)

**Interfaces:**
- Consumes: `readOfflinePackage` (Task 3, `../lib/offlinePackage`).
- Produces: `QuestionsState`ga qo'shiladigan yangi maydonlar — `isOfflinePractice: boolean`, `offlineAnswers: Record<number, string>`. Task 7 (`TestPage.tsx`) shu ikkalasini o'qiydi.

- [ ] **Step 1: Write the failing test**

`tests/unit/store/useQuestionsStore.test.ts` (yangi fayl):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getQuestions = vi.fn()
const getTopics = vi.fn()
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, getQuestions, getTopics } }
})

const readOfflinePackage = vi.fn()
vi.mock('../../../src/shared/lib/offlinePackage', () => ({ readOfflinePackage }))

async function fresh() {
  vi.resetModules()
  return import('../../../src/shared/store/useQuestionsStore')
}

const OFFLINE_ROWS = [
  { id: 1, questionUz: 'S1', questionRu: 'В1', optionsUz: { a: '1' }, optionsRu: { a: '1' }, correctAnswer: 'a', image: null, topicId: 1 },
]

beforeEach(() => {
  getQuestions.mockReset()
  getTopics.mockReset()
  readOfflinePackage.mockReset()
})

describe('useQuestionsStore.load — offline fallback', () => {
  it('online muvaffaqiyatli bo\'lsa isOfflinePractice=false, offlineAnswers bo\'sh', async () => {
    getQuestions.mockResolvedValue([{ id: 1, questionUz: 'S1', questionRu: 'В1', optionsUz: { a: '1' }, optionsRu: { a: '1' }, image: null, topicId: 1 }])
    getTopics.mockResolvedValue([])
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(useQuestionsStore.getState().isOfflinePractice).toBe(false)
    expect(useQuestionsStore.getState().offlineAnswers).toEqual({})
    expect(readOfflinePackage).not.toHaveBeenCalled()
  })

  it('online muvaffaqiyatsiz + oflayn paket bor bo\'lsa — undan yuklaydi, isOfflinePractice=true', async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(true)
    expect(state.loaded).toBe(true)
    expect(state.offlineAnswers).toEqual({ 1: 'a' })
    expect(state.questions).toHaveLength(1)
    expect(state.questions[0]!.id).toBe(1)
  })

  it('online muvaffaqiyatsiz + oflayn paket ham yo\'q bo\'lsa — error state', async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(null)
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(false)
    expect(state.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/store/useQuestionsStore.test.ts`
Expected: FAIL — `isOfflinePractice`/`offlineAnswers` `undefined` (hali qo'shilmagan).

- [ ] **Step 3: Implement**

`src/shared/store/useQuestionsStore.ts` — to'liq yangi fayl mazmuni:

```ts
import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../api'
import { useSubjectStore } from './useSubjectStore'
import { readOfflinePackage, type OfflineQuestionRow } from '../lib/offlinePackage'

interface QuestionsState {
  questions: Question[]
  topics:    DbTopic[]
  loaded:    boolean
  loading:   boolean
  error:     string | null
  /** Language the currently mapped questions are in. */
  lang:      'uz' | 'ru'
  /** Qaysi fan uchun yuklangan (subject almashganda qayta yuklanadi). */
  subjectId: string
  /** true — `questions` onlayn server'dan EMAS, yuklab olingan oflayn paketdan kelgan. */
  isOfflinePractice: boolean
  /** questionId → correctAnswer — FAQAT isOfflinePractice===true bo'lganda to'ldiriladi, lokal scoring uchun. */
  offlineAnswers: Record<number, string>
  load:      (lang: 'uz' | 'ru', subjectId?: string) => Promise<void>
  /** Admin CRUD'dan keyin cache'dan qat'iatan qayta yuklash (force) */
  reload:    () => Promise<void>
  /** Re-map already-fetched questions to another language — no network call. */
  setLang:   (lang: 'uz' | 'ru') => void
}

// Raw (til-mapping'siz) PUBLIC savollar — language switch'da re-fetch'siz
// qayta map qilish uchun. correctAnswer bu yerda YO'Q (server strip qiladi),
// FAQAT isOfflinePractice===false bo'lganda mazmunli.
let rawQuestions: DbQuestion[] = []
// Xuddi shu maqsad — FAQAT isOfflinePractice===true bo'lganda to'ldiriladi,
// setLang() til almashtirishda tarmoqqa qayta murojaat qilmasdan (bu urinish
// baribir muvaffaqiyatsiz bo'lardi — offline) to'g'ridan-to'g'ri qayta xaritalaydi.
let rawOfflineQuestions: OfflineQuestionRow[] = []
let loadVersion = 0

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,
  lang:      'uz',
  subjectId: useSubjectStore.getState().subjectId || 'yhq',
  isOfflinePractice: false,
  offlineAnswers: {},

  async load(lang, subjectId) {
    const sid = subjectId ?? useSubjectStore.getState().subjectId ?? get().subjectId
    // Shu til + shu fan allaqachon yuklangan
    if (get().loaded && get().lang === lang && get().subjectId === sid) return
    const version = ++loadVersion
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([api.getQuestions(sid), api.getTopics(sid)])
      if (version !== loadVersion) return
      rawQuestions = raw
      set({
        questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId: sid,
        isOfflinePractice: false, offlineAnswers: {},
      })
    } catch (e) {
      if (version !== loadVersion) return
      // OFLAYN MASHQ: online urinish muvaffaqiyatsiz — shu fan uchun oldindan
      // yuklab olingan paket bormi tekshiramiz (src/shared/lib/offlinePackage.ts).
      const offlineRows = await readOfflinePackage(sid).catch(() => null)
      if (version !== loadVersion) return
      if (offlineRows && offlineRows.length > 0) {
        rawOfflineQuestions = offlineRows
        const offlineAnswers: Record<number, string> = {}
        for (const row of offlineRows) offlineAnswers[row.id] = row.correctAnswer
        set({
          questions: offlineRows.map((q) => dbToQuestion(q, lang)),
          topics: [], loaded: true, lang, subjectId: sid,
          isOfflinePractice: true, offlineAnswers,
        })
        return
      }
      set({ error: e instanceof Error ? e.message : 'Failed to load questions' })
    } finally {
      if (version === loadVersion) set({ loading: false })
    }
  },

  async reload() {
    const { lang, subjectId } = get()
    // load() dan FARQLI: cache-bust bilan — admin CRUD'dan keyingi stale
    // CDN/browser javobini chetlab o'tish uchun
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([
        api.getQuestions(subjectId, true),
        api.getTopics(subjectId, true),
      ])
      rawQuestions = raw
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId, isOfflinePractice: false, offlineAnswers: {} })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to reload questions' })
    } finally {
      set({ loading: false })
    }
  },

  setLang(lang) {
    if (get().lang === lang) return
    if (get().isOfflinePractice) {
      // Oflayn paketda ham rawOfflineQuestions bor (yuqoridagi load() to'ldiradi,
      // isOfflinePractice FAQAT offlineRows.length>0 bo'lganda true bo'ladi —
      // shuning uchun bu yerda bo'sh bo'lish holati yo'q) — tarmoqqa qayta
      // murojaat qilish shart emas, to'g'ridan-to'g'ri qayta xaritalanadi.
      set({ questions: rawOfflineQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
      return
    }
    if (rawQuestions.length === 0) { void get().load(lang); return }
    set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
  },
}))
```

**Izoh:** `setLang()`ga oflayn-holat filiali qo'shildi — bu spec'da yo'q edi, lekin mavjud kodni o'qib chiqishda aniqlandi: `rawQuestions` module-level o'zgaruvchi FAQAT online yo'lda to'ldiriladi. Yangi `rawOfflineQuestions` o'zgaruvchisi xuddi shu rolni oflayn paket uchun bajaradi — `load()`ning oflayn filiali uni to'ldiradi, `setLang()` esa til almashtirilganda tarmoqqa qayta murojaat qilmasdan (baribir muvaffaqiyatsiz bo'lardi) to'g'ridan-to'g'ri undan qayta xaritalaydi.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/store/useQuestionsStore.test.ts`
Expected: barcha testlar PASS.

- [ ] **Step 5: Run full unit suite to check no regressions**

Run: `npx vitest run tests/unit`
Expected: barcha testlar PASS (ayniqsa `useQuestionsStore`ni ishlatuvchi boshqa joylar — mavjud testlar buzilmasligi kerak).

- [ ] **Step 6: Commit**

```bash
git add src/shared/store/useQuestionsStore.ts tests/unit/store/useQuestionsStore.test.ts
git commit -m "feat(offline): fall back to cached offline package when the network fails"
```

---

## Task 6: Profil ekrani — "Oflayn rejim" sahifasi

**Files:**
- Create: `src/features/profile/OfflinePage.tsx`
- Test: `tests/unit/components/OfflinePage.test.tsx`
- Modify: `src/App.tsx` (route qo'shish)
- Modify: `src/features/profile/Profil.tsx` (Toggle qatorini navigatsiyaga almashtirish)

**Interfaces:**
- Consumes: `downloadSubjectOffline`/`isSubjectDownloaded`/`deleteSubjectOffline`/`DownloadProgress` (Task 3), i18n kalitlari (Task 4), `Progress` (`../../shared/components/ui/progress`), `DialogOverlay`, `useToast`, `goBack`.

- [ ] **Step 1: Write the failing test**

`tests/unit/components/OfflinePage.test.tsx` (yangi fayl) — `SubjectSheet.test.tsx` naqshiga mos, `offlinePackage.ts` mock qilingan holda (Task 3'ning o'z testlari kesh mexanikasini allaqachon qamrab olgan — bu yerda faqat komponent xulqi tekshiriladi):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OfflinePage from '../../../src/features/profile/OfflinePage'
import { useSubjectStore } from '../../../src/shared/store/useSubjectStore'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const isSubjectDownloaded = vi.fn()
const downloadSubjectOffline = vi.fn()
const deleteSubjectOffline = vi.fn()
vi.mock('../../../src/shared/lib/offlinePackage', () => ({
  isSubjectDownloaded: (...a: unknown[]) => isSubjectDownloaded(...a),
  downloadSubjectOffline: (...a: unknown[]) => downloadSubjectOffline(...a),
  deleteSubjectOffline: (...a: unknown[]) => deleteSubjectOffline(...a),
}))

function renderPage() {
  return render(<MemoryRouter><OfflinePage /></MemoryRouter>)
}

beforeEach(() => {
  isSubjectDownloaded.mockReset()
  downloadSubjectOffline.mockReset()
  deleteSubjectOffline.mockReset()
  useSubjectStore.setState({ subjectId: 'yhq' })
  useAppStore.setState({
    settings: {
      autoNextCorrect: true, autoNextWrong: false, noAnimation: false, shuffleOptions: false,
      fontSize: 'medium', fontStyle: 'default', language: 'uz', theme: 'dark', offlineMode: true,
    },
  })
})

describe('OfflinePage', () => {
  it('shows the download button when nothing is downloaded yet', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    renderPage()
    await waitFor(() => expect(screen.getByText('Yuklab olish')).toBeInTheDocument())
  })

  it('shows the delete button when the subject is already downloaded', async () => {
    isSubjectDownloaded.mockResolvedValue(true)
    renderPage()
    await waitFor(() => expect(screen.getByText("O'chirish")).toBeInTheDocument())
  })

  it('clicking download opens the confirm sheet, confirming starts the download', async () => {
    isSubjectDownloaded.mockResolvedValue(false)
    downloadSubjectOffline.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => screen.getByText('Yuklab olish'))

    fireEvent.click(screen.getByText('Yuklab olish'))
    expect(await screen.findByText('Rasmlarni yuklash')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Rasmlarni yuklash'))
    await waitFor(() => expect(downloadSubjectOffline).toHaveBeenCalledWith('yhq', expect.any(Function)))
  })

  it('clicking delete opens a confirm sheet, confirming deletes', async () => {
    isSubjectDownloaded.mockResolvedValue(true)
    deleteSubjectOffline.mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => screen.getByText("O'chirish"))

    fireEvent.click(screen.getByText("O'chirish"))
    expect(await screen.findByText('Ha, o\'chirish')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Ha, o\'chirish'))
    await waitFor(() => expect(deleteSubjectOffline).toHaveBeenCalledWith('yhq'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/OfflinePage.test.tsx`
Expected: FAIL — `Cannot find module '../../../src/features/profile/OfflinePage'`.

- [ ] **Step 3: Implement OfflinePage.tsx**

`src/features/profile/OfflinePage.tsx` (yangi fayl):

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Trash2 } from 'lucide-react'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import {
  downloadSubjectOffline, isSubjectDownloaded, deleteSubjectOffline, type DownloadProgress,
} from '../../shared/lib/offlinePackage'
import { Progress } from '../../shared/components/ui/progress'
import DialogOverlay from '../../shared/components/DialogOverlay'
import { useToast } from '../../shared/components/ToastContainer'

type Status = 'checking' | 'idle' | 'downloading' | 'downloaded'

export default function OfflinePage() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const subjectId = useSubjectStore((s) => s.subjectId)
  const { info: showToast } = useToast()

  const [status, setStatus] = useState<Status>('checking')
  const [progress, setProgress] = useState<DownloadProgress>({ done: 0, total: 1, percent: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Uzoq davom etadigan downloadSubjectOffline() paytida foydalanuvchi
  // sahifadan chiqib ketsa (orqaga tugma) — keyingi setState chaqiruvlari
  // unmount qilingan komponentga tegmasin.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    isSubjectDownloaded(subjectId).then((yes) => {
      if (!cancelled) setStatus(yes ? 'downloaded' : 'idle')
    })
    return () => { cancelled = true }
  }, [subjectId])

  const startDownload = async () => {
    setConfirmOpen(false)
    setStatus('downloading')
    setProgress({ done: 0, total: 1, percent: 0 })
    // subjectId'ni ushbu chaqiruv boshlanganda qulflab olamiz. Taqqoslash
    // useSubjectStore.getState() orqali — LIVE qiymat — chunki React'dagi
    // `subjectId` o'zgaruvchi shu closure yaratilgan render'ga qotib qolgan,
    // taqqoslasa ikkalasi ham bir xil "muzlagan" qiymat bo'lib, hech narsani
    // ushlamas edi (foydalanuvchi async davomida boshqa fanga o'tsa ham).
    const forSubject = subjectId
    try {
      await downloadSubjectOffline(forSubject, (p: DownloadProgress) => {
        if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setProgress(p)
      })
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setStatus('downloaded')
    } catch {
      if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) {
        setStatus('idle')
        showToast(tt('offlineDownloadFailed'))
      }
    }
  }

  const confirmDelete = async () => {
    setDeleteOpen(false)
    const forSubject = subjectId
    try {
      await deleteSubjectOffline(forSubject)
    } catch (err) {
      console.warn('[OfflinePage] o\'chirib bo\'lmadi:', (err as Error)?.message ?? err)
      if (mountedRef.current) showToast(tt('shopError'))
    }
    if (mountedRef.current && forSubject === useSubjectStore.getState().subjectId) setStatus('idle')
  }

  return (
    <div className="px-5 pt-4 pb-10">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('offlineScreenTitle')}</h1>
      </div>

      <p className="px-1 mb-5 text-[13px] text-pmuted">{tt('offlineScreenDesc')}</p>

      <div className="rounded-container border border-pline bg-pcard p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: 'color-mix(in srgb, var(--p-primary) 10%, transparent)' }}>
            <Download size={16} strokeWidth={1.75} style={{ color: 'var(--p-primary)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-pfg">{tt('offlineDownloadTitle')}</p>
            <p className="text-[12px] text-pmuted">{tt('offlineDownloadDesc')}</p>

            {status === 'downloading' && (
              <div className="mt-3">
                <Progress value={progress.percent} label={`${progress.percent}%`} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          {status === 'downloaded' ? (
            <button onClick={() => setDeleteOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-control bg-pdanger/10 py-2.5 text-[13px] font-semibold text-pdanger">
              <Trash2 size={14} strokeWidth={1.75} />
              {tt('offlineDeleteBtn')}
            </button>
          ) : (
            <button onClick={() => setConfirmOpen(true)} disabled={status === 'downloading' || status === 'checking'}
              className="w-full rounded-control bg-pprimary py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
              {tt('offlineDownloadBtn')}
            </button>
          )}
        </div>
      </div>

      {confirmOpen && (
        <DialogOverlay onClose={() => setConfirmOpen(false)} labelId="offline-confirm-title">
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />
            <p id="offline-confirm-title" className="text-center text-base font-black mb-2 text-fg">{tt('offlineConfirmSheetTitle')}</p>
            <p className="text-center text-[13px] text-muted mb-5">{tt('offlineConfirmSheetDesc')}</p>
            <button onClick={startDownload} className="w-full rounded-2xl bg-pprimary py-3 text-[14px] font-bold text-white mb-2">
              {tt('offlineConfirmSheetConfirm')}
            </button>
            <button onClick={() => setConfirmOpen(false)} className="w-full rounded-2xl bg-canvas border border-line py-3 text-[14px] font-bold text-fg">
              {tt('offlineConfirmSheetCancel')}
            </button>
          </div>
        </DialogOverlay>
      )}

      {deleteOpen && (
        <DialogOverlay onClose={() => setDeleteOpen(false)} labelId="offline-delete-title">
          <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />
            <p id="offline-delete-title" className="text-center text-base font-black mb-2 text-fg">{tt('offlineDeleteSheetTitle')}</p>
            <p className="text-center text-[13px] text-muted mb-5">{tt('offlineDeleteSheetDesc')}</p>
            <button onClick={confirmDelete} className="w-full rounded-2xl bg-pdanger py-3 text-[14px] font-bold text-white mb-2">
              {tt('offlineDeleteSheetConfirm')}
            </button>
            <button onClick={() => setDeleteOpen(false)} className="w-full rounded-2xl bg-canvas border border-line py-3 text-[14px] font-bold text-fg">
              {tt('offlineDeleteSheetCancel')}
            </button>
          </div>
        </DialogOverlay>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/OfflinePage.test.tsx`
Expected: barcha testlar PASS.

- [ ] **Step 5: Register the route**

`src/App.tsx` — 39-qator (`const StatistikaPage = lazy(...)`) yonida:

```ts
const OfflinePage      = lazy(() => import('./features/profile/OfflinePage'))
```

118-qator (`<Route path="/statistika" element={<StatistikaPage />} />`) yonida:

```tsx
            <Route path="/offline"    element={<OfflinePage />} />
```

- [ ] **Step 6: Change the Profil.tsx row from a Toggle to navigation**

`src/features/profile/Profil.tsx`, 127-qator — olib tashlanadi (endi ishlatilmaydi):

```ts
  const offlineOn = settings.offlineMode
```

353-356 qatorlar:

```tsx
        <Item
          icon={WifiOff} label={tt('offlineMode')}
          right={<Toggle size="sm" checked={offlineOn} onChange={(v) => updateSettings({ offlineMode: v })} />}
        />
```

quyidagicha almashtiriladi:

```tsx
        <Item
          icon={WifiOff} label={tt('offlineScreenTitle')}
          onPress={() => navigate('/offline')}
        />
```

**Izoh (qamrov chegarasi):** `settings.offlineMode` o'zi (app-shell service worker ro'yxatdan o'tishini boshqaruvchi, `src/main.tsx:46`) TEGILMAYDI — bu boshqa, mavjud mexanizm (butun ilova qobig'ini reaktiv keshlash), yangi per-fan yuklab olish funksiyasidan mustaqil. `Toggle` importi Profil.tsx boshqa joyda ishlatilmasa ham qoldiriladi (keng qamrovli tekshiruv shart emas — TypeScript ishlatilmagan importni xato sifatida ushlamaydi, faqat lint ogohlantirishi bo'lishi mumkin, bu qamrovdan tashqarida).

- [ ] **Step 7: Run full unit suite**

Run: `npx vitest run tests/unit`
Expected: barcha testlar PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/profile/OfflinePage.tsx tests/unit/components/OfflinePage.test.tsx src/App.tsx src/features/profile/Profil.tsx
git commit -m "feat(offline): add Offline mode screen with download/delete flow"
```

---

## Task 7: `TestPage.tsx` — oflayn-mashq javob yo'li + banner

**Files:**
- Modify: `src/features/test/TestPage.tsx`

**Interfaces:**
- Consumes: `isOfflinePractice`, `offlineAnswers` (Task 5, `useQuestionsStore`).

- [ ] **Step 1: Add selectors**

`src/features/test/TestPage.tsx`, 53-56 qatorlar atrofida (mavjud `useQuestionsStore` selektorlari):

```ts
  const questions        = useQuestionsStore((s) => s.questions)
  const storeTopics      = useQuestionsStore((s) => s.topics)
  const questionsLoading = useQuestionsStore((s) => s.loading)
  const questionsLoaded  = useQuestionsStore((s) => s.loaded)
```

pastiga qo'shiladi:

```ts
  const isOfflinePractice = useQuestionsStore((s) => s.isOfflinePractice)
  const offlineAnswers    = useQuestionsStore((s) => s.offlineAnswers)
```

- [ ] **Step 2: Branch handleSelect for offline practice**

320-330 qatorlardagi (o'qilgan kod bo'yicha) mavjud:

```ts
  const handleSelect = useCallback((optId: string) => {
    if (selected || submitting || !q) return
    const questionId = q.id
    const answeredIndex = current
    setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = optId; return next })
    setSubmitting(true)

    // ASYNC FEEDBACK: to'g'rilikni SERVER hal qiladi (javob kaliti client'da yo'q).
    void (async () => {
```

quyidagicha o'zgartiriladi (yangi oflayn filial `setSubmitting(true)`dan OLDIN qo'shiladi, `submitAnswer` chaqirilmasdan qaytadi):

```ts
  const handleSelect = useCallback((optId: string) => {
    if (selected || submitting || !q) return
    const questionId = q.id
    const answeredIndex = current
    setSelectedHistory((prev) => { const next = [...prev]; next[answeredIndex] = optId; return next })

    // OFLAYN MASHQ: javob kaliti keshdan (useQuestionsStore.offlineAnswers) —
    // serverga HECH NARSA yuborilmaydi, hisobga (XP/coin/streak/liga) tegmaydi.
    if (isOfflinePractice) {
      const idx = activeQuestions.findIndex((x) => x.id === questionId)
      if (idx === -1) return
      const correctAnswer = offlineAnswers[questionId]
      const isCorrect = correctAnswer === optId
      setAnswers((prev) => { const next = [...prev]; next[idx] = isCorrect ? 'correct' : 'wrong'; return next })
      setCorrectOpts((prev) => { const next = [...prev]; next[idx] = correctAnswer ?? null; return next })
      haptics.notify(isCorrect ? 'success' : 'error')
      return
    }

    setSubmitting(true)

    // ASYNC FEEDBACK: to'g'rilikni SERVER hal qiladi (javob kaliti client'da yo'q).
    void (async () => {
```

**Diqqat implementatorga:** `useCallback` dependency ro'yxatiga (qator oxiridagi `[selected, submitting, q, ...]`) `isOfflinePractice, offlineAnswers, activeQuestions` qo'shilishi kerak — aniq mavjud ro'yxatni ko'rib, shu uchtasini yetishmasa qo'shing (ESLint `react-hooks/exhaustive-deps` buni ko'rsatadi).

- [ ] **Step 3: Add the offline-practice banner**

Savol ekranining tepasida (aniq JSX joyi — savol matni/rasm render qilinadigan blokdan oldin, implementatsiya paytida `q.text`/`ImageZoomModal` atrofida ko'riladi) quyidagi shartli banner qo'shiladi:

```tsx
{isOfflinePractice && (
  <div className="mx-5 mb-3 rounded-control border border-pline bg-psurface px-3 py-2 text-center text-[12px] font-medium text-pmuted">
    📴 {tt('offlinePracticeBanner')}
  </div>
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: 0 xato.

- [ ] **Step 5: Run full unit suite**

Run: `npx vitest run tests/unit`
Expected: barcha testlar PASS (ayniqsa mavjud `TestPage`/javob-yuborish bilan bog'liq testlar buzilmagan).

- [ ] **Step 6: Commit**

```bash
git add src/features/test/TestPage.tsx
git commit -m "feat(offline): score offline-practice answers locally, skip submission"
```

---

## Task 8: Yakuniy verifikatsiya

**Files:** (o'zgartirilmaydi — faqat tekshirish)

- [ ] **Step 1: To'liq type-check**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
```
Expected: ikkalasi ham 0 xato.

- [ ] **Step 2: To'liq unit suite**

```bash
npx vitest run tests/unit
```
Expected: barcha testlar PASS (Task 1-7'dagi yangilaridan tashqari, mavjud 639+ testning hech biri buzilmagan).

- [ ] **Step 3: Prod build + manual browser check (SW faqat PROD'da ishlaydi)**

```bash
npm run build
```

Keyin `dist/` papkasini statik serverda ochib (masalan `npx serve dist` yoki mavjud preview vositasi bilan):

1. Ilovani oching, "Sozlamalar → Profil → Oflayn rejim"ga o'ting.
2. "Yuklab olish" bosing → tasdiqlash sheet chiqishi kerak → "Rasmlarni yuklash" bosing → progress-bar 100%gacha yetishi kerak.
3. DevTools → Application → Cache Storage'da `yhq-offline-yhq` nomli kesh paydo bo'lganini tekshiring (paket JSON + rasm URL'lari ichida).
4. DevTools → Network → "Offline" belgilang (yoki `navigator.onLine`ni brauzer orqali o'chiring).
5. Test boshlang (masalan "20 talik tezkor test") — savollar ochilishi, rasmlar ko'rinishi kerak.
6. Javob tanlang — DARHOL to'g'ri/xato ko'rinishi kerak, banner "Oflayn mashq — natija hisobga yozilmaydi" ko'rinishi kerak.
7. Profildagi XP/coin sonlari O'ZGARMAGANINI tekshiring.
8. DevTools → Network → "Offline"ni o'chiring, Profil → Oflayn rejim → "O'chirish" bosing → tasdiqlang → Cache Storage'dan `yhq-offline-yhq` yo'qolganini tekshiring.

- [ ] **Step 4: Spec bilan solishtirish (self-review)**

`docs/superpowers/specs/2026-08-24-offline-subject-download-design.md`ning har bandini shu planning tasklari qamrab olganini tasdiqlang:
- Trigger (tugma + 2 tasdiqlash sheet) — Task 6 ✓
- Qamrov (faol fan, savol+rasm, darsliksiz) — Task 1/3 (faqat `getAllQuestions()`, `lessons.ts` chaqirilmaydi) ✓
- Javob kaliti bilan endpoint — Task 1 ✓
- Cache API saqlash — Task 2/3 ✓
- Oflayn yechish, hisobga yozilmasligi — Task 5/7 ✓
- Xavfsizlik (offline javob serverga yuborilmasligi) — Task 7, Step 2 ✓ (submitAnswer/enqueueOutbox chaqirilmaydi)
