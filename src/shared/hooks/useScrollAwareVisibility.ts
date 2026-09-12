import { useEffect, useRef, useState } from 'react'

export interface UseScrollAwareVisibilityOptions {
  threshold?: number
  topThreshold?: number
}

/**
 * Scroll yo'nalishini kuzatib, floating tugma ko'rinishini boshqaradi.
 *
 * Xususiyatlari:
 * - Pastga skroll qilganda (delta > threshold) yashiriladi
 * - Yuqoriga skroll qilganda (delta < -threshold) ko'rsatiladi
 * - Sahifa boshida (scrollY < topThreshold) doim ko'rinadi
 * - Jitter-free: threshold o'tmaguncha holat o'zgarmaydi
 * - 0 ta ortiqcha re-render: RAF + passive scroll listener, faqat holat almashganda setState
 */
export function useScrollAwareVisibility(options?: UseScrollAwareVisibilityOptions): boolean {
  const threshold = options?.threshold ?? 12
  const topThreshold = options?.topThreshold ?? 80

  const [isVisible, setIsVisible] = useState(true)
  const isVisibleRef = useRef(true)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    lastScrollYRef.current = Math.max(0, window.scrollY || 0)
    let isScheduled = false
    let rafId: number | null = null

    const handleScroll = () => {
      if (isScheduled) return
      isScheduled = true
      rafId = window.requestAnimationFrame(() => {
        isScheduled = false
        rafId = null
        const currentY = Math.max(0, window.scrollY || 0)

        // Sahifa boshida (scrollY < topThreshold) har doim ko'rinib turishi shart
        if (currentY < topThreshold) {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true
            setIsVisible(true)
          }
          lastScrollYRef.current = currentY
          return
        }

        const delta = currentY - lastScrollYRef.current

        if (isVisibleRef.current) {
          // Tugma ko'rinib turibdi:
          // Yuqoriga skroll davom etsa, eng pastki nuqtani yangilab boramiz
          if (currentY < lastScrollYRef.current) {
            lastScrollYRef.current = currentY
          } else if (delta >= threshold) {
            // Pastga skroll chegaradan oshsa -> yashiramiz
            isVisibleRef.current = false
            setIsVisible(false)
            lastScrollYRef.current = currentY
          }
        } else {
          // Tugma yashiringan:
          // Pastga skroll davom etsa, eng yuqori nuqtani yangilab boramiz
          if (currentY > lastScrollYRef.current) {
            lastScrollYRef.current = currentY
          } else if (delta <= -threshold) {
            // Yuqoriga skroll chegaradan oshsa -> ko'rsatamiz
            isVisibleRef.current = true
            setIsVisible(true)
            lastScrollYRef.current = currentY
          }
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [threshold, topThreshold])

  return isVisible
}
