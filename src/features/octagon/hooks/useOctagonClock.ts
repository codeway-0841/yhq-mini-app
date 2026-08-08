import { useEffect, useState } from 'react'

/** Server raund deadline'igacha bo'lgan qolgan soniyalar (null — raund yo'q) + silliq progress. */
export function useOctagonClock(deadline: number | null): { timeLeft: number | null; roundPct: number } {
  const [left, setLeft] = useState<number | null>(null)
  const [pct, setPct] = useState(1)

  useEffect(() => {
    if (!deadline) { setLeft(null); return }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [deadline])

  // Silliq (60fps) raund progress 0..1 — progress bar uchun
  useEffect(() => {
    if (!deadline) { setPct(1); return }
    const total = deadline - Date.now() || 1
    let raf = 0
    const step = () => {
      setPct(Math.max(0, Math.min(1, (deadline - Date.now()) / total)))
      if (Date.now() < deadline) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [deadline])

  return { timeLeft: left, roundPct: pct }
}
