/**
 * Sahifa scroller'i — SSOT (2026-09-24 wondering-shell).
 *
 * Ikki rejim:
 * - Mobil (<lg): DOCUMENT scroll (window) — 2026-09-01 sticky incident qoidasi
 *   (haqiqiy scroll document'da, container'larda overflow TAQIQLANADI).
 * - Desktop (lg+): route-page PANEL ichki scrollport — border qotib turadi,
 *   kontent panel ICHIDA scroll bo'ladi (wondering.app uslubi). Sticky
 *   headerlar panel tepasiga yopishadi (yagona ATAYLAB scrollport — insidentdagi
 *   kabi tasodifiy oraliq scrollport EMAS).
 *
 * matchMedia orqali rejim aniqlanadi — SSR/test'da matchMedia yo'q bo'lsa
 * document rejimi (xavfsiz default).
 */
export function isDesktopPanelScroll(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    if (!window.matchMedia?.('(min-width: 1024px)')?.matches) return false
  } catch {
    return false
  }
  return document.querySelector('.route-page') instanceof HTMLElement
}

/** Haqiqiy scroller: desktop panel rejimida element, aks holda null (= window). */
export function getPageScroller(): HTMLElement | null {
  if (!isDesktopPanelScroll()) return null
  const el = document.querySelector('.route-page')
  return el instanceof HTMLElement ? el : null
}

/** Joriy vertikal scroll (har ikki rejimda). */
export function pageScrollY(): number {
  const el = getPageScroller()
  if (el) return Math.max(0, el.scrollTop)
  if (typeof window === 'undefined') return 0
  return Math.max(0, window.scrollY || 0)
}

/** Elementning scroller-boshidan offseti (Darslik section sakrash uchun). */
export function pageScrollOffsetOf(el: HTMLElement, extra = 0): number {
  const rect = el.getBoundingClientRect()
  const scroller = getPageScroller()
  if (scroller) {
    const srect = scroller.getBoundingClientRect()
    return Math.max(0, rect.top - srect.top + scroller.scrollTop + extra)
  }
  const y = typeof window !== 'undefined' ? window.scrollY || 0 : 0
  return Math.max(0, rect.top + y + extra)
}

/** Berilgan Y ga scroll (har ikki rejimda). */
export function scrollPageTo(top: number, behavior: ScrollBehavior = 'auto'): void {
  const next = Math.max(0, top)
  const el = getPageScroller()
  if (el) {
    el.scrollTo({ top: next, behavior })
    return
  }
  if (typeof window !== 'undefined') window.scrollTo({ top: next, behavior })
}

/** Sahifa boshiga scroll (navigatsiya reset, "tepaga" tugmalari). */
export function scrollPageToTop(behavior: ScrollBehavior = 'auto'): void {
  scrollPageTo(0, behavior)
}

/** Har ikki rejimda ishlaydigan scroll listener (window + panel). */
export function addPageScrollListener(cb: () => void): () => void {
  const cleanups: Array<() => void> = []
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', cb, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', cb))
  }
  if (typeof document !== 'undefined') {
    const el = document.querySelector('.route-page')
    if (el instanceof HTMLElement) {
      el.addEventListener('scroll', cb, { passive: true })
      cleanups.push(() => el.removeEventListener('scroll', cb))
    }
  }
  return () => {
    for (const c of cleanups) c()
  }
}
