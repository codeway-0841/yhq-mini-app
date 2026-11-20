import { memo } from 'react'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { BrilliantStreakIcon } from '../../../shared/components/BrilliantStreakIcon'
import { isSubjectExtendedOnDate, todayStr, useDailyStore } from '../../../shared/store/useDailyStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { haptics } from '../../../platform/haptics'
import type { LearningSummary } from '../../../shared/api'

const DAYS_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'] as const
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

// ── Brilliant 1:1 Haftalik Seriya + Imtihonga Tayyorgarlik kartasi ───────────
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
  const shown = useCountUp(progressPct, 700)
  const barWidth = total > 0 ? Math.max(shown, summary.mastered > 0 ? 4 : 0) : 0

  // Haftaning joriy kuni (0 = Dushanba .. 6 = Yakshanba)
  const jsDay = new Date().getDay()
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1
  const dayLabels = isRu ? DAYS_RU : DAYS_UZ

  // Seriya bo'yicha faol kunlar (bugun uzaytirilgan bo'lsa bugundan, aks holda kechadan orqaga)
  const lastActiveIdx = extendedToday ? todayIdx : todayIdx - 1
  const activeStartIdx = streak > 0 ? Math.max(0, lastActiveIdx - streak + 1) : 99

  return (
    <section className="mx-4 lg:mx-0 mb-3.5">
      <div className="brilliant-progress-card">
        {/* Yuqori qator: Seriya soni + Tayyorgarlik foizi */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              haptics.impact('light')
              onStreakPreview?.()
            }}
            className="flex items-center gap-2 text-left cursor-pointer touch-manipulation active:scale-95 transition-transform"
            aria-label={isRu ? `Серия: ${streak}` : `Seriya: ${streak}`}
          >
            <span className="font-display text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-pfg">
              {streak}
            </span>
            <BrilliantStreakIcon
              size={22}
              className={streak > 0 ? 'text-[#A8D31D]' : 'text-pmuted'}
            />
            <span className="text-[13px] font-bold text-pmuted leading-tight">
              {isRu ? 'дн. серия' : 'kunlik seriya'}
            </span>
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-pline bg-psurface/60 px-3 py-1">
            <span className="text-[13px] font-extrabold tabular-nums text-[#3557ff] dark:text-[#6e8cff]">
              {total > 0 ? `${shown}%` : '—'}
            </span>
            <span className="text-[11.5px] font-bold tabular-nums text-pmuted">
              · {summary.mastered}/{total || '…'}
            </span>
          </div>
        </div>

        {/* 7-kunlik Brilliant haftalik seriya chizig'i */}
        <div className="mt-3.5 grid grid-cols-7 gap-1.5" aria-label={isRu ? 'Недельная серия' : 'Haftalik seriya'}>
          {dayLabels.map((label, idx) => {
            const isToday = idx === todayIdx
            const isDone = streak > 0 && idx <= lastActiveIdx && idx >= activeStartIdx
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <span
                  className={`flex size-9 items-center justify-center rounded-full border-2 transition-colors ${
                    isDone
                      ? 'border-[#8eb812] bg-[#A8D31D] text-white'
                      : isToday
                        ? 'border-dashed border-[#3557ff] bg-pcard text-[#3557ff] dark:border-[#6e8cff] dark:text-[#6e8cff]'
                        : 'border-pline bg-psurface text-pmuted/60'
                  }`}
                >
                  <BrilliantStreakIcon
                    size={15}
                    className={isDone ? 'text-white' : isToday ? 'text-[#3557ff] dark:text-[#6e8cff] opacity-60' : 'opacity-30'}
                  />
                </span>
                <span
                  className={`text-[10.5px] font-extrabold leading-none ${
                    isToday ? 'text-pfg' : 'text-pmuted'
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Pastki imtihon tayyorgarligi chizig'i */}
        <div className="mt-3.5 flex items-center gap-2.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-pmuted shrink-0">
            {tt('readinessTitle')}
          </span>
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-psurface">
            <div
              className="h-full rounded-full bg-[#3557ff] transition-[width] duration-700 ease-out"
              style={{
                width: `${barWidth}%`,
                boxShadow: barWidth > 0 ? 'inset 0 -2px 0 #2643d8' : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
})
