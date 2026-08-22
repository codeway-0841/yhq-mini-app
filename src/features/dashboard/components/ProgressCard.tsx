import { memo, useRef, useState } from 'react'
import { Flame, Star, Trophy, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import SubjectSheet from '../../../shared/components/SubjectSheet'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { cn } from '../../../shared/lib/cn'

// ── Streak tugmasi (long-press = milestone demo preview) ────────────────────
const StreakButton = memo(function StreakButton({ streak, onOpen, onLongPress, tt, ariaLabel }: {
  streak: number; onOpen: () => void; onLongPress?: () => void
  tt: (k: Parameters<ReturnType<typeof useT>>[0]) => string
  ariaLabel: string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  return (
    <button aria-label={ariaLabel}
      onClick={() => { if (!fired.current) onOpen(); fired.current = false }}
      onPointerDown={() => {
        fired.current = false
        cancel()
        if (onLongPress) timer.current = setTimeout(() => { fired.current = true; onLongPress() }, 700)
      }}
      onPointerUp={cancel} onPointerLeave={cancel}
      className={cn(
        'flex items-center gap-2 rounded-control p-1 text-left',
        'transition-all duration-[120ms] ease-out active:scale-[0.97]',
        'hover:bg-psurface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary',
      )}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pwarning/15 text-pwarning">
        <Flame size={15} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight tabular-nums text-pfg">{streak} {tt('daysWord')}</p>
        <p className="truncate text-[10px] font-medium text-psubtle">{tt('streakDays')}</p>
      </div>
    </button>
  )
})

/** Pastki statistika ustuni — Seriya / XP / Reyting bir xil shaklda. */
function StatItem({ icon: Icon, value, label, iconBg, tone }: {
  icon: typeof Star; value: string; label: string; iconBg?: string; tone?: string
}) {
  return (
    <div className="flex items-center gap-2 p-1 text-left">
      <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', iconBg ?? 'bg-psurface text-psubtle', tone)}>
        <Icon size={15} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight tabular-nums text-pfg">{value}</p>
        <p className="truncate text-[10px] font-medium text-psubtle">{label}</p>
      </div>
    </div>
  )
}

// ── Hero: umumiy progress ───────────────────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ totalCorrect, totalAnswered, streak, totalPool, lang, onStreakPreview }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const navigate = useNavigate()
  const total = totalPool > 0 ? totalPool : 0
  const subject = useSubjectStore((s) => s.subject)
  const [showSubjects, setShowSubjects] = useState(false)

  // Baza bo'yicha yechilgan testlar foizi: 0 ta = 0%, 1 ta = 1% ... 1000/1000 = 100%
  const progressPct = total > 0
    ? (totalAnswered === 0 ? 0 : Math.min(100, Math.max(1, Math.round((totalAnswered / total) * 100))))
    : 0
  const xp = totalCorrect * 10
  const league = totalCorrect >= 1000 ? 'Platinum' : totalCorrect >= 500 ? 'Gold' : totalCorrect >= 100 ? 'Silver' : 'Bronze'

  // Count-up animatsiya — sahifa ochilganda foiz "o'sib" chiqadi
  const shown = useCountUp(progressPct, 900)

  return (
    <>
      <div className="mx-5 mb-6 rounded-container border border-pline bg-pcard p-5">
        {/* Sarlavha qatori: Bugungi progress (chapda) va Fan tanlash toggle (o'ngda) */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-psubtle">{tt('todayProgress')}</p>

          {/* Fan tanlash toggle chipi */}
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setShowSubjects(true)
            }}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-control border px-2.5 text-[11.5px] font-semibold',
              'transition-[background-color,border-color,transform] duration-[120ms] ease-out active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary'
            )}
            style={{
              background: `${subject.color}14`,
              borderColor: `${subject.color}38`,
              color: subject.color,
            }}
            aria-label={tt('subjectSelect')}
          >
            <subject.icon size={13} strokeWidth={2} />
            <span className="max-w-[120px] truncate">{subject.name}</span>
            <ChevronDown size={12} strokeWidth={2} className="opacity-70" />
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-pfg">
            {shown}
          </span>
          <span className="font-display text-[20px] font-semibold text-pmuted">%</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-plineStrong">
            <div
              className="h-full rounded-[2px] bg-pprimary transition-[width] duration-[700ms] ease-out"
              style={{ width: `${shown}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-pmuted">
            {totalAnswered} / {total || '…'}
          </span>
        </div>

        {/* Pastki statistika: Seriya / XP / Reyting */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-pline pt-4">
          {/* Streak — bosilsa "Intizom" sahifasi; 1s bosib turilsa → milestone PREVIEW (demo) */}
          <StreakButton streak={streak} onOpen={() => navigate('/streak')} onLongPress={onStreakPreview}
            tt={tt} ariaLabel={tt('intizomTitle')} />
          <StatItem icon={Star} value={`${xp} XP`} label={tt('totalXp')} iconBg="bg-pgold/15 text-pgold" />
          <StatItem icon={Trophy} value={league} label={tt('ratingWord')} iconBg="bg-pblue/15 text-pblue" />
        </div>
      </div>

      {/* Fan tanlash modal oynasi */}
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}
    </>
  )
})
