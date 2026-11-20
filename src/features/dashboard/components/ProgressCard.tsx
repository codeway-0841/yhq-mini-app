import { memo, useLayoutEffect, useRef } from 'react'
import { Flame, CheckCircle2, AlertCircle } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { initWaveGrid } from '../../../shared/lib/wave-grid'
import { haptics } from '../../../platform/haptics'
import type { LearningSummary } from '../../../shared/api'

// ── Hero: flagship tayyorgarlik kartasi ─────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ summary, streak = 0, lang, onStreakPreview }: {
  summary: LearningSummary
  streak?: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const total = summary.totalQuestions > 0 ? summary.totalQuestions : 0
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const progressPct = total > 0 ? summary.readinessPercent : 0
  const shown = useCountUp(progressPct, 900)

  // SVG progress halqasi o'lchovlari (76×76px, r=31)
  const radius = 31
  const circumference = 2 * Math.PI * radius
  const visualPct = total > 0 ? Math.max(shown, summary.mastered > 0 ? 4 : 0) : 0
  const dashOffset = circumference * (1 - Math.min(100, visualPct) / 100)

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
    <div
      className="hero-gradient-card relative mx-4 lg:mx-0 mb-4 overflow-hidden rounded-[28px] px-4 py-4 sm:px-5 sm:py-5"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 18px 38px -18px rgba(33, 62, 232, 0.62)',
      }}
    >
      {/* Organik to'lqinli to'r: Canvas 2D liquid mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full block"
          aria-hidden="true"
        />
        {/* Yuqori chap yumshoq nur (flagship chuqurlik) */}
        <div
          className="absolute -top-14 -left-10 size-44 rounded-full opacity-35 blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)' }}
        />
      </div>

      {/* Kontent */}
      <div className="relative z-[2]">
        <div className="flex items-center justify-between gap-3">
          {/* Chap qism: sarlavha + katta foiz + o'zlashtirilgan son */}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.02em] text-white/95">
              <span className="size-1.5 rounded-full bg-[#C6F432]" aria-hidden="true" />
              {tt('readinessTitle')}
            </span>

            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="font-display text-[48px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-white">
                {total > 0 ? shown : '—'}
              </span>
              {total > 0 && (
                <span className="font-display text-[22px] font-bold text-white/75">%</span>
              )}
            </div>

            <p className="mt-1.5 text-[12px] font-medium text-white/80 tabular-nums">
              {total > 0
                ? isRu
                  ? `${summary.mastered} из ${total} вопросов освоено`
                  : `${summary.mastered} / ${total} savol o‘zlashtirildi`
                : isRu
                  ? 'Загрузка прогресса...'
                  : 'Progress yuklanmoqda...'}
            </p>
          </div>

          {/* O'ng qism: Radial Progress Ring */}
          <div className="relative flex size-[78px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden="true">
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.18)"
                strokeWidth="6.5"
              />
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke="#ffffff"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[13px] font-extrabold leading-none tabular-nums text-white">
                {summary.mastered}
              </span>
              <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] text-white/70">
                {isRu ? 'цель' : 'maqsad'}
              </span>
            </div>
          </div>
        </div>

        {/* Pastki 3-ustunli glass telemetriya paneli */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-black/20 px-2.5 py-2 backdrop-blur-[2px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#7CFFB2]">
              <CheckCircle2 size={15} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-none tabular-nums text-white">
                {summary.mastered}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-white/70">
                {isRu ? 'Освоено' : 'Yechilgan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-black/20 px-2.5 py-2 backdrop-blur-[2px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#FF9B9B]">
              <AlertCircle size={15} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-none tabular-nums text-white">
                {summary.unresolvedMistakes}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-white/70">
                {isRu ? 'Ошибки' : 'Xatolar'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              onStreakPreview?.()
            }}
            className="flex items-center gap-2 rounded-2xl bg-white/15 px-2.5 py-2 text-left transition-transform active:scale-95 cursor-pointer touch-manipulation"
            aria-label={isRu ? `Серия: ${streak}` : `Seriya: ${streak}`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-white/20 text-[#FFD84D]">
              <Flame size={15} strokeWidth={2.4} fill="currentColor" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-none tabular-nums text-white">
                {streak} {isRu ? 'дн' : 'kun'}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-white/80">
                {isRu ? 'Серия' : 'Seriya'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
})
