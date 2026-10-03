import { useEffect } from 'react'
import type { Question } from '../../../shared/api'
import { buildContentImageUrl } from '../../../shared/lib/content-token'
import { isNativeApp } from '../../../platform/native'

/** Canonical CDN apex manzili (Vercel Edge CDN orqali) */
const CDN_MEDIA_BASE = 'https://kivvi.uz'

export function formatImageSrc(src?: string | null): string | undefined {
  if (!src) return undefined
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src
  }

  const path = src.startsWith('/') ? src : `/${src}`

  // R2/Worker rasm yo'li (fizika R2 banki) — token'li Worker URL.
  // Worker URL'siz (flag o'chiq) eski passthrough qoladi.
  if (path.startsWith('/images/')) {
    const workerUrl = buildContentImageUrl(path)
    if (workerUrl) return workerUrl
  }

  // Native Android APK muhitida og'ir media assetlar (yhq test rasmlari,
  // math-print va physics-print diagrammalari, kutubxona) APK hajmini 18MB ga
  // tushirish uchun to'g'ridan-to'g'ri CDN'dan yuklanadi va WebView keshida saqlanadi.
  if (isNativeApp()) {
    if (
      path.startsWith('/images/yhq/') ||
      path.startsWith('/math-print/') ||
      path.startsWith('/physics-print/') ||
      path.startsWith('/kutubxona/')
    ) {
      return `${CDN_MEDIA_BASE}${path}`
    }
  }

  return path
}

const PRELOAD_WINDOW = 10

export function useImagePreload(activeQuestions: Question[], current: number) {
  useEffect(() => {
    if (!activeQuestions || activeQuestions.length === 0) return

    const from = Math.max(0, current - PRELOAD_WINDOW)
    const to = Math.min(activeQuestions.length, current + PRELOAD_WINDOW + 1)
    const imageSources = activeQuestions
      .slice(from, to)
      .map((q) => formatImageSrc(q.image))
      .filter((src): src is string => Boolean(src))

    if (imageSources.length === 0) return

    const preloadedImages: HTMLImageElement[] = []
    for (const src of imageSources) {
      const img = new Image()
      img.src = src
      preloadedImages.push(img)
    }

    if (typeof caches !== 'undefined') {
      caches.open('yhq-test-images').then((cache) => {
        imageSources.forEach((src) => {
          fetch(src, { mode: 'no-cors' }).then((res) => {
            if (res.ok || res.type === 'opaque') void cache.put(src, res)
          }).catch(() => {})
        })
      }).catch(() => {})
    }

    return () => {
      preloadedImages.forEach((img) => { img.src = '' })
    }
  }, [activeQuestions, current])

  // Test yakunlanganda yoki sahifadan chiqilganda vaqtinchalik kesh tozalanadi
  useEffect(() => {
    return () => {
      if (typeof caches !== 'undefined') {
        caches.delete('yhq-test-images').catch(() => {})
      }
    }
  }, [])
}
