import { memo } from 'react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { BrilliantStreakIcon } from '../../../shared/components/BrilliantStreakIcon'
import { isSubjectExtendedOnDate, todayStr, useDailyStore } from '../../../shared/store/useDailyStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { haptics } from '../../../platform/haptics'
import type { LearningSummary } from '../../../shared/api'

const DAYS_UZ = ['D', 'S', 'Ch', 'P', 'J', 'Sh', 'Y'] as const
const DAYS_RU = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'] as const
const SEGMENTS = 12

// ── KIVVI Kinetic Horizon: Direct-on-canvas Readiness + 7-kunlik yulduzcha chiziq ──
export const ProgressCard = memo(function ProgressCard({ summary, streak = 0, lang, onStreakPreview }: {
  summary: LearningSummary
  streak?: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const isRu = lang === 'ru'
  const subjectId = useSubjectStore((s) => s.subjectId)
  const globalExtendedDate = useDailyStore((s) => s.globalExtendedDate)
  const activityKey = useDailyStore((s) => s.activityKey)
  const extendedDates = useDailyStore((s) => s.extendedDates)
  const extendedToday = isSubjectExtendedOnDate(
    { globalExtendedDate, activityKey, extendedDates },
    todayStr(),
    subjectId,
  )

  const total = summary.totalQuestions > 0 ? summary.totalQuestions : 0
  const progressPct = total > 0 ? summary.readinessPercent : 0
  const shown = useCountUp(progressPct, 750)
  const filledSegments = total > 0
    ? Math.max(summary.mastered > 0 ? 1 : 0, Math.round((shown / 100) * SEGMENTS))
    : 0

  const jsDay = new Date().getDay()
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1
  const dayLabels = isRu ? DAYS_RU : DAYS_UZ

  const lastActiveIdx = extendedToday ? todayIdx : todayIdx - 1
  const activeStartIdx = streak > 0 ? Math.max(0, lastActiveIdx - streak + 1) : 99

  return (
    <section className="mx-4 lg:mx-0 mb-3 pt-0.5">
      {/* Yuqori qator: Katta arxitektura foiz + O'ngda jonli 7-kunlik seriya kapsulasi */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-pmuted">
            {tt('readinessTitle')}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-display text-[38px] font-black leading-none tracking-[-0.045em] tabular-nums text-pfg">
              {total > 0 ? shown : '—'}
              {total > 0 && <span className="text-[20px] font-extrabold text-[#3557ff] dark:text-[#6e8cff]">%</span>}
            </span>
            <span className="font-mono text-[11.5px] font-bold tabular-nums text-pmuted">
              {summary.mastered}/{total || '…'}
            </span>
          </div>
        </div>

        {/* Jonli 7-kunlik Seriya Kapsulasi */}
        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            onStreakPreview?.()
          }}
          className="kivvi-streak-pod"
          aria-label={isRu ? `Серия: ${streak}` : `Seriya: ${streak}`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums text-pfg">
              <BrilliantStreakIcon size={14} className={streak > 0 ? 'text-[#A8D31D]' : 'text-pmuted'} />
              {streak}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-pmuted">
              {isRu ? 'серия' : 'seriya'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-[5px]" aria-hidden="true">
            {dayLabels.map((letter, idx) => {
              const isToday = idx === todayIdx
              const isDone = streak > 0 && idx <= lastActiveIdx && idx >= activeStartIdx
              return (
                <span
                  key={`${letter}-${idx}`}
                  className={`kivvi-day-dot ${isDone ? 'is-done' : isToday ? 'is-today' : ''}`}
                >
                  {letter}
                </span>
              )
            })}
          </div>
        </button>
      </div>

      {/* 12-segmentli Braun / Swiss Precision Progress Meter */}
      <div className="mt-2.5 grid grid-cols-12 gap-[5px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, idx) => {
          const active = idx < filledSegments
          const isHead = idx === filledSegments - 1 && filledSegments > 0
          return (
            <span
              key={idx}
              className={`h-[6px] rounded-full transition-all duration-500 ${
                isHead
                  ? 'bg-[#A8D31D]'
                  : active
                    ? 'bg-[#3557ff]'
                    : 'bg-pline/80 dark:bg-psurface'
              }`}
            />
          )
        })}
      </div>
    </section>
  )
})
