import { memo, useLayoutEffect, useRef } from 'react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { initWaveGrid } from '../../../shared/lib/wave-grid'
import { BrilliantStreakIcon } from '../../../shared/components/BrilliantStreakIcon'
import { haptics } from '../../../platform/haptics'
import type { LearningSummary } from '../../../shared/api'

// ── Hero: umumiy progress ───────────────────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ summary, streak = 0, lang, onStreakPreview }: {
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
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold tracking-[0.01em] text-white/85">{tt('readinessTitle')}</p>
          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              onStreakPreview?.()
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold tabular-nums text-white backdrop-blur-[2px] transition-transform active:scale-95 cursor-pointer touch-manipulation"
            aria-label={lang === 'ru' ? `Серия: ${streak}` : `Seriya: ${streak}`}
          >
            <BrilliantStreakIcon size={14} className={streak > 0 ? 'text-[#C6F432]' : 'text-white/75'} />
            <span>{streak}</span>
          </button>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-white">
              {total > 0 ? shown : '—'}
            </span>
            {total > 0 && <span className="font-display text-[22px] font-semibold text-white/75">%</span>}
          </div>
          <span className="mb-1 rounded-full bg-black/20 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-white/90">
            {summary.mastered} / {total || '…'}
          </span>
        </div>

        <div className="mt-3.5">
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(shown, total > 0 && summary.mastered > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
