import { memo, useLayoutEffect, useRef } from 'react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { initWaveGrid } from '../../../shared/lib/wave-grid'
import type { LearningSummary } from '../../../shared/api'

// ── Hero: umumiy progress ───────────────────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ summary, lang }: {
  summary: LearningSummary
  streak?: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const total = summary.totalQuestions > 0 ? summary.totalQuestions : 0
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const progressPct = total > 0 ? summary.readinessPercent : 0
  const shown = useCountUp(progressPct, 900)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cleanup: (() => void) | null = null

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          if (entry.isIntersecting) {
            if (!cleanup) cleanup = initWaveGrid(canvas)
          } else {
            if (cleanup) {
              cleanup()
              cleanup = null
            }
          }
        },
        { threshold: 0.05 },
      )
      observer.observe(canvas)
      return () => {
        observer.disconnect()
        if (cleanup) cleanup()
      }
    }

    cleanup = initWaveGrid(canvas)
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  return (
    <div className="hero-gradient-card relative mx-4 lg:mx-0 mb-4 overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
      {/* Organik to'lqinli to'r: Canvas 2D liquid mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full block"
          aria-hidden="true"
        />
      </div>

      {/* Kontent */}
      <div className="relative z-[2]">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-medium text-white/80">{tt('readinessTitle')}</p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-white">
            {total > 0 ? shown : '—'}
          </span>
          {total > 0 && <span className="font-display text-[22px] font-semibold text-white/75">%</span>}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
              style={{ width: `${shown}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/90">
            {summary.mastered} / {total || '…'}
          </span>
        </div>


      </div>
    </div>
  )
})
