import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ChevronRight } from 'lucide-react'
import { type useT } from '../../../shared/i18n'
import { haptics } from '../../../platform/haptics'
import { cn } from '../../../shared/lib/cn'

interface WeeklyActivityCardProps {
  name: string
  xp: number
  streak: number
  tt: ReturnType<typeof useT>
}

export function WeeklyActivityCard({ name, xp, streak, tt }: WeeklyActivityCardProps) {
  const navigate = useNavigate()

  // 0 = Du (Monday), 6 = Ya (Sunday)
  const currentDayIndex = useMemo(() => {
    const jsDay = new Date().getDay()
    return (jsDay + 6) % 7
  }, [])

  const days = useMemo(() => [
    { label: tt('weekMon'), active: streak > 0 && currentDayIndex >= 0 },
    { label: tt('weekTue'), active: streak > 1 && currentDayIndex >= 1 },
    { label: tt('weekWed'), active: streak > 2 && currentDayIndex >= 2 },
    { label: tt('weekThu'), active: streak > 3 && currentDayIndex >= 3 },
    { label: tt('weekFri'), active: streak > 4 && currentDayIndex >= 4 },
    { label: tt('weekSat'), active: streak > 5 && currentDayIndex >= 5 },
    { label: tt('weekSun'), active: streak > 6 && currentDayIndex >= 6 },
  ], [tt, streak, currentDayIndex])

  return (
    <div
      onClick={() => {
        haptics.impact('light')
        navigate('/streak')
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/streak') }}
      className="group relative mx-4 mb-4 cursor-pointer overflow-hidden rounded-2xl bg-pcard p-4 transition-all duration-200 active:scale-[0.99] shadow-xs select-none"
    >
      {/* Background soft glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-psurface blur-2xl opacity-40" />

      {/* 7-Day Dot-Line Timeline Graph */}
      <div className="relative pt-2 pb-1">
        {/* SVG connecting line */}
        <div className="relative h-9 w-full px-2">
          <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Background line */}
            <path
              d="M 0 50 L 100 50"
              fill="none"
              stroke="var(--p-line-strong)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Active progress line up to current day */}
            <path
              d={`M 0 50 L ${(currentDayIndex / 6) * 100} 50`}
              fill="none"
              stroke="var(--p-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* 7 Interactive Node Points */}
          <div className="absolute inset-0 flex items-center justify-between px-2">
            {days.map((_day, idx) => {
              const isToday = idx === currentDayIndex
              const isPassedOrToday = idx <= currentDayIndex

              return (
                <div key={idx} className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      'grid size-3.5 place-items-center rounded-full transition-all duration-300',
                      isPassedOrToday
                        ? 'bg-pprimary shadow-[0_0_8px_rgba(59,130,246,0.6)] ring-2 ring-pcard'
                        : 'bg-psurface border-2 border-plineStrong',
                      isToday && 'size-4.5 ring-2 ring-pprimary animate-pulse',
                    )}
                  >
                    {isPassedOrToday && (
                      <div className="size-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day of week labels (Du, Se, Ch, Pa, Ju, Sh, Ya) */}
        <div className="mt-2 flex items-center justify-between px-1 text-[11.5px] font-semibold">
          {days.map((day, idx) => {
            const isToday = idx === currentDayIndex
            return (
              <span
                key={idx}
                className={cn(
                  'w-6 text-center tabular-nums transition-colors',
                  isToday
                    ? 'font-bold text-pprimary scale-105'
                    : idx <= currentDayIndex
                      ? 'text-pfg font-medium'
                      : 'text-psubtle',
                )}
              >
                {day.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="my-3.5 h-px w-full bg-pline" />

      {/* User Status Bottom Row: ● Ruslan Abl ... 0 XP */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="size-2 rounded-full bg-pprimary animate-pulse shrink-0" />
          <p className="truncate text-[13.5px] font-semibold text-pfg tracking-tight">
            {name}
          </p>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-psurface px-2 py-0.5 text-[11px] font-bold text-porange">
              <Flame size={12} strokeWidth={2.5} />
              {streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[13.5px] font-bold tabular-nums text-pprimary tracking-tight">
            {xp.toLocaleString()} XP
          </span>
          <ChevronRight size={15} strokeWidth={2} className="text-psubtle group-hover:text-pfg group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  )
}
