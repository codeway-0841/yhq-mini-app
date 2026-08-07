import { useEffect, useRef, useState } from 'react'

/**
 * Pull-to-refresh — native his (pastga tortganda yangilash).
 * Faqat scroll eng tepada bo'lganda ishlaydi. overscroll-behavior: none
 * borligi sababli native PTR bilan to'qnashmaydi.
 */

const THRESHOLD = 72   // px — shundan oshsa refresh ishga tushadi
const DAMPING   = 0.45 // tortish "qarshilik" koeffitsiyenti

export type PTRState = 'idle' | 'pulling' | 'refreshing'

export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [state, setState] = useState<PTRState>('idle')
  const [dist, setDistState] = useState(0)
  const startY   = useRef<number | null>(null)
  const distRef  = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const setDist = (v: number) => { distRef.current = v; setDistState(v) }

  useEffect(() => {
    const scrollerTop = () =>
      (document.querySelector('.route-page') as HTMLElement | null)?.scrollTop ?? 0

    const onStart = (e: TouchEvent) => {
      if (scrollerTop() <= 0) startY.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 4) {
        setState('pulling')
        setDist(Math.min(120, dy * DAMPING))
      } else {
        setState('idle')
        setDist(0)
      }
    }
    const onEnd = () => {
      if (startY.current === null) return
      if (distRef.current >= THRESHOLD) {
        setState('refreshing')
        setDist(THRESHOLD * 0.75)
        void Promise.resolve(onRefreshRef.current()).finally(() => {
          setState('idle')
          setDist(0)
        })
      } else {
        setState('idle')
        setDist(0)
      }
      startY.current = null
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { state, dist, threshold: THRESHOLD }
}
