import { memo } from 'react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { BrilliantStreakIcon } from '../../../shared/components/BrilliantStreakIcon'
import { haptics } from '../../../platform/haptics'
import type { LearningSummary } from '../../../shared/api'

// ── Hero: Brilliant 1:1 tayyorgarlik kartasi (sof, no-gradient, 2px ramka) ───
export const ProgressCard = memo(function ProgressCard({ summary, streak = 0, lang, onStreakPreview }: {
  summary: LearningSummary
  streak?: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const total = summary.totalQuestions > 0 ? summary.totalQuestions : 0
  const progressPct = total > 0 ? summary.readinessPercent : 0
  const shown = useCountUp(progressPct, 700)
  const barWidth = total > 0 ? Math.max(shown, summary.mastered > 0 ? 4 : 0) : 0

  return (
    <section className="mx-4 lg:mx-0 mb-3.5">
      <div className="brilliant-progress-card">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#3557ff] dark:text-[#6e8cff]">
            {tt('readinessTitle')}
          </span>

          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              onStreakPreview?.()
            }}
            className="brilliant-streak-pill"
            aria-label={isRu ? `Серия: ${streak}` : `Seriya: ${streak}`}
          >
            <span className="text-[13.5px] font-extrabold tabular-nums text-pfg">{streak}</span>
            <BrilliantStreakIcon
              size={15}
              className={streak > 0 ? 'text-[#A8D31D]' : 'text-pmuted'}
            />
          </button>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[42px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-pfg">
              {total > 0 ? shown : '—'}
            </span>
            {total > 0 && (
              <span className="font-display text-[20px] font-bold text-pmuted">%</span>
            )}
          </div>

          <span className="text-[13px] font-bold tabular-nums text-pmuted">
            {summary.mastered} / {total || '…'}
          </span>
        </div>

        <div className="mt-3.5 h-[10px] w-full overflow-hidden rounded-full bg-psurface">
          <div
            className="h-full rounded-full bg-[#3557ff] transition-[width] duration-700 ease-out"
            style={{
              width: `${barWidth}%`,
              boxShadow: barWidth > 0 ? 'inset 0 -2px 0 #2643d8' : undefined,
            }}
          />
        </div>
      </div>
    </section>
  )
})
