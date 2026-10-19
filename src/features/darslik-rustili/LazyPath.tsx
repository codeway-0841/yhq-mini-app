import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Learning path'ni faqat ko'rinish zonasiga yaqinlashganda mount qiladi.
 *
 * Rus tili darsligida 689 ta tugun bor — hammasini bir yo'la render qilish
 * past darajali qurilmalarda sekin. IO mavjud bo'lmasa (masalan, testlar)
 * darhol render qilamiz.
 */
export function LazyPath({ rows, children }: { rows: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  // Balandlik zaxirasi: `.learning-row` min-height clamp(140px, 40vw, 175px)
  const viewport = typeof window === 'undefined' ? 390 : window.innerWidth
  const rowHeight = Math.round(Math.min(175, Math.max(140, viewport * 0.4)))

  return (
    <div ref={ref}>
      {visible ? children : <div aria-hidden="true" style={{ height: rows * rowHeight }} />}
    </div>
  )
}
