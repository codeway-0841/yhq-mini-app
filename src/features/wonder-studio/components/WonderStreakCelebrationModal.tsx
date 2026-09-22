import { useEffect, useState } from 'react'
import { Flame, ShieldCheck, Sparkles } from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'

interface WonderStreakCelebrationModalProps {
  streakCount: number
  freezeUsed?: boolean
  onClose: () => void
}

/**
 * 1:1 StreakWeekView extracted from Wondering bundle (line 1976644)
 * Displays a 7-day rolling window with completed days filled with flame badges.
 */
function StreakWeekView({
  streakCount,
  animate,
}: {
  streakCount: number
  animate: boolean
}) {
  const days = ['D', 'S', 'Ch', 'P', 'J', 'Sh', 'Ya']
  const todayIndex = (new Date().getDay() + 6) % 7 // Monday = 0, Sunday = 6

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 sm:gap-3">
        {days.map((dayLabel, idx) => {
          const isToday = idx === todayIndex
          // Mark today and previous consecutive days (up to streakCount) as filled
          const daysFromToday = (todayIndex - idx + 7) % 7
          const isFilled = daysFromToday < streakCount

          return (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-8 sm:size-9 items-center justify-center rounded-full transition-all duration-300 ${
                  isFilled
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-xs'
                    : 'bg-stone-200/80 dark:bg-stone-800 text-stone-400 dark:text-stone-600'
                } ${
                  isToday
                    ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-2 ring-offset-[#FFFDF8] dark:ring-offset-[#1C1411]'
                    : ''
                } ${animate ? 'scale-100' : 'scale-95'}`}
              >
                {isFilled ? (
                  <Flame size={18} fill="currentColor" className="text-white drop-shadow-xs" />
                ) : (
                  <span className="size-2 rounded-full bg-stone-300 dark:bg-stone-700" />
                )}
              </div>
              <span
                className={`text-[11px] font-mono font-bold ${
                  isToday
                    ? 'text-amber-600 dark:text-amber-400'
                    : isFilled
                      ? 'text-stone-800 dark:text-stone-200'
                      : 'text-stone-400 dark:text-stone-600'
                }`}
              >
                {dayLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 1:1 StreakCelebrationSheet / StreakCelebration modal from Wondering
 * Matches bundle lines 2060439, 1876001, and 5776000.
 */
export default function WonderStreakCelebrationModal({
  streakCount,
  freezeUsed = false,
  onClose,
}: WonderStreakCelebrationModalProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    haptics.notify('success')
    playSound('chime')
    const timer = setTimeout(() => {
      setAnimated(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl border-2 border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200 select-none">
        {/* Glow behind flame */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 size-36 bg-amber-400/20 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Animated Fire Mascot */}
        <div className="relative mx-auto mb-6 flex size-28 items-center justify-center">
          <div
            className={`relative flex size-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300 shadow-[0_6px_0_0_#C2410C] transition-transform duration-500 ${
              animated ? 'scale-100 rotate-0' : 'scale-75 -rotate-6'
            }`}
          >
            <Flame size={54} fill="currentColor" className="text-white drop-shadow-md animate-bounce" />

            {/* Sparkle badge */}
            <div className="absolute -top-2 -right-2 size-7 rounded-full bg-amber-200 text-amber-950 flex items-center justify-center shadow-xs">
              <Sparkles size={14} className="text-amber-800" />
            </div>

            {/* Freeze protected badge if applicable */}
            {freezeUsed && (
              <div
                className="absolute -bottom-2 -right-2 rounded-full bg-sky-500 p-1.5 text-white shadow-md"
                title="Streak was protected with a freeze"
              >
                <ShieldCheck size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Heading & Streak Counter */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <Flame size={13} fill="currentColor" />
            <span>KIVVI STREAK</span>
          </div>

          <h2 className="text-3xl font-black text-stone-900 dark:text-stone-100 font-display tracking-tight">
            {streakCount} {streakCount === 1 ? 'DAY' : 'DAYS'} STREAK!
          </h2>

          <p className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-xs mx-auto">
            {freezeUsed
              ? 'Your streak was protected with a freeze!'
              : "Kept alive by today's practice. You're building unstoppable momentum!"}
          </p>
        </div>

        {/* 7-Day Rolling Streak View */}
        <div className="my-6 py-4 px-2 rounded-2xl bg-[#FAF8F2] dark:bg-[#150E0C] border border-stone-200/80 dark:border-stone-800">
          <StreakWeekView streakCount={streakCount} animate={animated} />
        </div>

        {/* 3D Action Button (1:1 with Wondering) */}
        <button
          type="button"
          onClick={() => {
            haptics.impact('light')
            onClose()
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] font-mono font-bold text-xs sm:text-sm uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}
