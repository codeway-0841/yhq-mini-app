import { memo, useRef, useState } from 'react'
import { Flame, Star, Trophy, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import SubjectSheet from '../../../shared/components/SubjectSheet'
import StatInfoSheet from '../../../shared/components/StatInfoSheet'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { cn } from '../../../shared/lib/cn'

// ── Interaktiv StatButton (Streak, XP, Reyting bir xil premium hover & active shaklda) ──
const StatButton = memo(function StatButton({
  icon: Icon,
  value,
  label,
  onClick,
  onLongPress,
  ariaLabel,
}: {
  icon: typeof Flame | typeof Star | typeof Trophy
  value: string
  label: string
  onClick?: () => void
  onLongPress?: () => void
  ariaLabel: string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (!fired.current && onClick) {
          playSound('click')
          haptics.impact('light')
          onClick()
        }
        fired.current = false
      }}
      onPointerDown={() => {
        fired.current = false
        cancel()
        if (onLongPress) timer.current = setTimeout(() => { fired.current = true; onLongPress() }, 700)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className={cn(
        'flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 text-left shadow-2xs',
        'transition-all duration-[120ms] ease-out active:scale-[0.97]',
        'hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      <Icon size={19} strokeWidth={1.75} className="shrink-0 text-white/85" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold leading-tight tabular-nums text-white">{value}</p>
        <p className="truncate text-[10px] font-medium text-white/65">{label}</p>
      </div>
    </button>
  )
})

/** progress.league (server) → i18n kalit — LeaderboardPage'dagi tarjimalar bilan bir xil. */
const LEAGUE_TT_KEY = {
  bronze: 'leagueBronze', silver: 'leagueSilver', gold: 'leagueGold', platinum: 'leaguePlat',
} as const

// ── Hero: umumiy progress ───────────────────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ totalAnswered, streak, totalPool, lang, onStreakPreview }: {
  totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const navigate = useNavigate()
  const total = totalPool > 0 ? totalPool : 0
  const subject = useSubjectStore((s) => s.subject)
  const [showSubjects, setShowSubjects] = useState(false)
  const [xpInfoOpen, setXpInfoOpen] = useState(false)
  const [leagueInfoOpen, setLeagueInfoOpen] = useState(false)

  // Baza bo'yicha yechilgan testlar foizi: 0 ta = 0%, 1 ta = 1% ... 1000/1000 = 100%
  const progressPct = total > 0
    ? (totalAnswered === 0 ? 0 : Math.min(100, Math.max(1, Math.round((totalAnswered / total) * 100))))
    : 0
  // XP endi SERVER hisobi (o'rganish hodisasiga qarab) — avval bu yerda
  // totalCorrect * 10 edi, ya'ni XP javob sonining ko'paytmasi bo'lib qolardi
  const xp = useAppStore((s) => s.xp)
  // Liga endi SERVER progress.league'dan (haftalik cron) — avval bu yerda
  // totalCorrect chegaralaridan "o'ylab topilardi", reyting sahifasidagi
  // haqiqiy liga bilan mos kelmasligi mumkin edi (FIXPLAN #60).
  const league = useAppStore((s) => s.league)

  // Count-up animatsiya — sahifa ochilganda foiz "o'sib" chiqadi
  const shown = useCountUp(progressPct, 900)

  return (
    <>
      <div className="hero-gradient-card mx-4 mb-5 p-4 sm:p-5">
        {/* Sarlavha qatori: Bugungi progress (chapda) va Fan tanlash toggle (o'ngda) */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-medium text-white/80">{tt('todayProgress')}</p>

          {/* Fan tanlash toggle chipi */}
          <button
            type="button"
            onClick={() => {
              playSound('click')
              haptics.impact('light')
              setShowSubjects(true)
            }}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-xl bg-black/30 px-2.5 text-[11.5px] font-semibold text-white backdrop-blur-sm shadow-2xs',
              'transition-[background-color,transform] duration-[120ms] ease-out hover:bg-black/45 active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
            )}
            aria-label={tt('subjectSelect')}
          >
            <subject.icon size={14} strokeWidth={1.75} className="shrink-0 text-white/90" />
            <span className="max-w-[120px] truncate">{subject.name}</span>
            <ChevronDown size={12} strokeWidth={1.75} className="text-white/70" />
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-white">
            {shown}
          </span>
          <span className="font-display text-[22px] font-semibold text-white/75">%</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-[700ms] ease-out"
              style={{ width: `${shown}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/90">
            {totalAnswered} / {total || '…'}
          </span>
        </div>

        {/* Pastki statistika: Seriya / XP / Reyting — 3 ta alohida toza shisha pill kartalar */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {/* Streak — bosilsa "Intizom" sahifasi; 700ms bosib turilsa → milestone PREVIEW (demo) */}
          <StatButton
            icon={Flame}
            value={`${streak} ${tt('daysWord')}`}
            label={tt('streakDays')}
            onClick={() => navigate('/streak')}
            onLongPress={onStreakPreview}
            ariaLabel={tt('intizomTitle')}
          />
          {/* XP — bosilsa XP ma'lumot sheet'i */}
          <StatButton
            icon={Star}
            value={`${xp} XP`}
            label={tt('totalXp')}
            onClick={() => setXpInfoOpen(true)}
            ariaLabel={tt('xpInfoTitle')}
          />
          {/* Reyting — bosilsa Reyting sahifasi; 700ms bosib turilsa → liga qoidalari sheet'i */}
          <StatButton
            icon={Trophy}
            value={tt(LEAGUE_TT_KEY[league])}
            label={tt('ratingWord')}
            onClick={() => navigate('/reyting')}
            onLongPress={() => setLeagueInfoOpen(true)}
            ariaLabel={tt('leagueInfoTitle')}
          />
        </div>
      </div>

      {/* Fan tanlash modal oynasi */}
      {showSubjects && <SubjectSheet onClose={() => setShowSubjects(false)} />}

      {xpInfoOpen && (
        <StatInfoSheet
          icon={<Star size={20} strokeWidth={1.75} />}
          title={tt('xpInfoTitle')}
          body={tt('xpInfoBody')}
          onClose={() => setXpInfoOpen(false)}
        />
      )}
      {leagueInfoOpen && (
        <StatInfoSheet
          icon={<Trophy size={20} strokeWidth={1.75} />}
          title={tt('leagueInfoTitle')}
          body={tt('leagueInfoBody')}
          onClose={() => setLeagueInfoOpen(false)}
        />
      )}
    </>
  )
})
