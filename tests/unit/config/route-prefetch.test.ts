/**
 * Route-chunk prefetch CONSISTENCY testi (2026-09-01 navigatsiya "flash" bug'i).
 *
 * Muammo: react-router v7 joylashuv yangilanishini React.startTransition ichida
 * bajaradi. Lazy sahifa chunk'i hali yuklanmagan bo'lsa, Suspense fallback
 * (PageLoader) EMAS — ESKI sahifa (Dashboard) chunk kelguncha ekranda qolib
 * ketardi ("rejimni tanlasam avval dashboard ~2s ko'rinib, keyin sahifa sraz
 * ochiladi"). Fix: App.tsx har sahifa chunk'ini NOMLANGAN loader orqali
 * lazy() qiladi va boot'dan keyin idle vaqtda `prefetchRouteChunks` BARCHASINI
 * oldindan yuklaydi (import() modul keshi — ikki marta yuklanmaydi).
 *
 * Qoida: App.tsx'dagi HAR BIR lazy() chunk loader'i (dashboardChunk'dan tashqari —
 * u module load'da prefetch qilinadi) `routeChunkPrefetchers` ro'yxatida bo'lishi
 * SHART. Yangi lazy sahifa qo'shib ro'yxatga kiritish unutilsa — shu sahifada
 * bug qaytadi.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const APP = fs.readFileSync(path.resolve(__dirname, '../../../src/App.tsx'), 'utf8')

/** `const X = lazy(yChunk)` ko'rinishidagi barcha chunk loader nomlari */
function lazyChunkLoaders(src: string): string[] {
  const names = new Set<string>()
  for (const m of src.matchAll(/=\s*lazy\((\w+)\)/g)) names.add(m[1])
  return [...names]
}

function prefetchListEntries(src: string): string[] {
  const m = src.match(/routeChunkPrefetchers\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('routeChunkPrefetchers ro\'yxati App.tsx\'da topilmadi')
  return m[1]
    .split(',')
    .map((s) => s.replace(/\/\/.*$/gm, '').trim())
    .filter(Boolean)
}

describe('route chunk prefetch (navigatsiya flash regression)', () => {
  it('har bir lazy() chunk loader routeChunkPrefetchers ro\'yxatida', () => {
    const lazyLoaders = lazyChunkLoaders(APP).filter((n) => n !== 'dashboardChunk')
    const prefetched = new Set(prefetchListEntries(APP))
    const missing = lazyLoaders.filter((n) => !prefetched.has(n))
    expect(
      missing,
      `Quyidagi lazy chunk loader'lar routeChunkPrefetchers'da YO'Q — ` +
        `shu sahifalarga birinchi navigatsiyada eski sahifa (Dashboard) ` +
        `chunk kelguncha ekranda qoladi: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('prefetch boot\'dan KEYIN idle vaqtda ishga tushadi (initialized gate)', () => {
    // Prefetch hook'i initialized flag'iga bog'langan bo'lishi shart —
    // aks holda boot kritik yo'lida init so'rovlari bilan raqobat qiladi.
    expect(APP).toMatch(/if \(!initialized\) return[\s\S]{0,200}requestIdleCallback\(prefetchRouteChunks/)
    expect(APP).toContain('setTimeout(prefetchRouteChunks')
  })

  it('dashboardChunk module load\'da prefetch qilinadi (regression)', () => {
    expect(APP).toMatch(/void dashboardChunk\(\)/)
  })
})
