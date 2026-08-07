import { useEffect, useState } from 'react'

/**
 * Count-up animatsiya (0 → target, easeOutCubic).
 * `noAnimation` setting yoki OS reduced-motion'da darhol to'liq qiymat.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(() => {
    const reduce = typeof document !== 'undefined'
      && (document.body.dataset.noAnimation === 'true'
        || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return reduce ? target : 0
  })

  useEffect(() => {
    const reduce = document.body.dataset.noAnimation === 'true'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setValue(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
