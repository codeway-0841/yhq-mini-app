/** Circular pass/fail chart for the results modal.
 *  threshold — o'tish foizi (default 90 = haqiqiy imtihon mezoni).
 *  Qisqa testlar uchun TestPage mode'ga qarab boshqacha berishi mumkin.
 *  v2.1: animatsiyali arc + count-up foiz (premium reward tuyg'usi). */
import { useEffect, useState } from 'react'

export default function DonutChart({ correct, total, threshold = 90, hideVerdict = false, passedLabel = "O'tdi ✓", failedLabel = "O'tmadi ✗" }: {
  correct: number; total: number; threshold?: number
  /** Rasmiy preset rejimda mezon yo'q — foiz neytral rangda, verdict ko'rinmaydi */
  hideVerdict?: boolean
  passedLabel?: string; failedLabel?: string
}) {
  const r             = 52
  const cx            = 70
  const cy            = 70
  const circumference = 2 * Math.PI * r
  const percent       = total > 0 ? Math.round((correct / total) * 100) : 0
  const correctArc    = total > 0 ? (correct / total) * circumference : 0
  const wrongArc      = circumference - correctArc
  const passed        = percent >= threshold

  // Animatsiya: arc bo'sh holatdan to'ldiriladi + foiz 0 dan count-up
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const reduce = typeof document !== 'undefined'
      && (document.body.dataset.noAnimation === 'true'
        || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    if (reduce) { setFill(1); return }
    let raf = 0
    const t0 = performance.now()
    const DURATION = 900
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION)
      // easeOutCubic — yumshoq "reward" sezishi
      setFill(1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const shownPct  = Math.round(percent * fill)
  const shownArc  = correctArc * fill
  const shownWrong = wrongArc * fill

  return (
    <div className="relative w-40 h-40 mx-auto my-4">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--theme-line)" strokeWidth="14" />
        {shownWrong > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--p-danger)" strokeWidth="14"
            strokeDasharray={`${shownWrong} ${circumference}`}
            strokeDashoffset={-shownArc} />
        )}
        {shownArc > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--p-primary)" strokeWidth="14"
            strokeDasharray={`${shownArc} ${circumference}`}
            strokeDashoffset={0} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black tabular-nums ${
          hideVerdict ? 'text-fg' : passed ? 'text-duo-green' : 'text-duo-red'
        }`}>{shownPct}%</span>
        {!hideVerdict && (
          <span className="text-sm font-bold mt-0.5 text-subtle">
            {passed ? passedLabel : failedLabel}
          </span>
        )}
      </div>
    </div>
  )
}
