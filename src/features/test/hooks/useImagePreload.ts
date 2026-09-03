import { useEffect } from 'react'
import type { Question } from '../../../shared/api'

export function formatImageSrc(src?: string | null): string | undefined {
  if (!src) return undefined
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/')) {
    return src
  }
  return `/${src}`
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
