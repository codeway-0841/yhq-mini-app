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
