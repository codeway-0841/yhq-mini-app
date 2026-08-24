/**
 * Fanni oflayn yuklab olish — Cache API asosida, har fan alohida nomlangan
 * keshda ('yhq-offline-<subjectId>'). public/sw.js'ning activate cleanup'i
 * shu prefiksni ataylab saqlab qoladi (Task 2).
 *
 * Bu paket javob kaliti (correctAnswer) BILAN keladi — faqat oflayn-mashq
 * uchun (src/shared/store/useQuestionsStore.ts), hisobga YOZILMAYDI.
 */
import { api, type AdminDbQuestion } from '../api'

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
  // Auth (initData/Bearer), timeout va ApiError — hammasi mavjud request()
  // qatlamidan keladi. Oddiy fetch() auth header YUBORMAYDI, endpoint esa
  // requireAuth ostida — shuning uchun u har safar 401 qaytarardi.
  const rows = await api.getOfflinePackage(subjectId)
  // Keshga SINTETIK Response yoziladi (tarmoqdan kelgani emas) — Response
  // tanasi bir marta o'qiladi, shuning uchun clone()ga ehtiyoj qolmaydi.
  await cache.put(url, new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  }))

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
  // caches.open() keshni YARATADI — hech qachon yuklanmagan fanlar uchun bo'sh
  // kesh qoldirmaslik uchun avval mavjudligini tekshiramiz.
  if (!(await caches.has(cacheNameFor(subjectId)))) return false
  const cache = await caches.open(cacheNameFor(subjectId))
  const match = await cache.match(packageUrl(subjectId))
  return !!match
}

export async function deleteSubjectOffline(subjectId: string): Promise<void> {
  await caches.delete(cacheNameFor(subjectId))
}

export async function readOfflinePackage(subjectId: string): Promise<OfflineQuestionRow[] | null> {
  // caches.open() keshni YARATADI — hech qachon yuklanmagan fanlar uchun bo'sh
  // kesh qoldirmaslik uchun avval mavjudligini tekshiramiz.
  if (!(await caches.has(cacheNameFor(subjectId)))) return null
  const cache = await caches.open(cacheNameFor(subjectId))
  const match = await cache.match(packageUrl(subjectId))
  if (!match) return null
  return match.json()
}
