import { memo, useLayoutEffect, useRef, useState } from 'react'
import { Flame, Star, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../shared/store/useAppStore'
import StatInfoSheet from '../../../shared/components/StatInfoSheet'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { cn } from '../../../shared/lib/cn'
import { initWaveGrid } from '../../../shared/lib/wave-grid'
import type { LearningSummary } from '../../../shared/api'

// ── Interaktiv StatButton (Streak, XP, Reyting bir xil sodda va toza shaklda) ──
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
        'flex min-w-0 items-center gap-1.5 rounded-xl bg-black/20 backdrop-blur-xs border border-white/10 px-2 py-2 text-left shadow-2xs sm:gap-2 sm:px-2.5',
        'transition-[background-color,border-color] duration-150 ease-out',
        '[@media(hover:hover)]:hover:bg-black/30 [@media(hover:hover)]:hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      <Icon size={19} strokeWidth={1.75} className="shrink-0 text-white/85" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold leading-tight tabular-nums text-white">{value}</p>
        <p className="truncate text-[12px] font-medium text-white/80">{label}</p>
      </div>
    </button>
  )
})

/** progress.league (server) → i18n kalit — LeaderboardPage'dagi tarjimalar bilan bir xil. */
const LEAGUE_TT_KEY = {
  bronze: 'leagueBronze', silver: 'leagueSilver', gold: 'leagueGold', platinum: 'leaguePlat',
} as const

// ── Hero: umumiy progress ───────────────────────────────────────────────────
export const ProgressCard = memo(function ProgressCard({ summary, streak, lang, onStreakPreview }: {
  summary: LearningSummary
  streak: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const navigate = useNavigate()
  const total = summary.totalQuestions > 0 ? summary.totalQuestions : 0
  const [xpInfoOpen, setXpInfoOpen] = useState(false)
  const [leagueInfoOpen, setLeagueInfoOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Server joriy fan bo'yicha hisoblaydi: yechilgan UNIQUE savollar minus
  // hozir ochiq qolgan xatolar. Umumiy akkaunt counterlaridan guess qilinmaydi.
  const progressPct = total > 0 ? summary.readinessPercent : 0
  // XP endi SERVER hisobi (o'rganish hodisasiga qarab) — avval bu yerda
  // totalCorrect * 10 edi, ya'ni XP javob sonining ko'paytmasi bo'lib qolardi
  const xp = useAppStore((s) => s.xp)
  // Liga endi SERVER progress.league'dan (haftalik cron) — avval bu yerda
  // totalCorrect chegaralaridan "o'ylab topilardi", reyting sahifasidagi
  // haqiqiy liga bilan mos kelmasligi mumkin edi (FIXPLAN #60).
  const league = useAppStore((s) => s.league)

  // Count-up animatsiya — sahifa ochilganda foiz "o'sib" chiqadi
  const shown = useCountUp(progressPct, 900)

  // Organik 3D to'lqin to'ri: karta ko'rinayotganda 60 FPS o'ynaydi,
  // sahifani pastga skroll qilganda CPU/batareyani tejash uchun to'xtaydi.
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
    <>
      <div className="hero-gradient-card relative mx-4 mb-4 overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
        {/* Organik to'lqinli to'r: Canvas 2D liquid mesh */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full block"
            aria-hidden="true"
          />
        </div>

        {/* Kontent — to'r ustida ravshan va toza ko'rinishi uchun nisbiy z-[2] qatlam */}
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

          <p className="mt-2 text-[12px] leading-relaxed text-white/80">{tt('readinessHint')}</p>

          {/* Pastki statistika: Seriya / XP / Reyting — bir xil bosiluvchi mini-panellar */}
          <div className="mt-2 grid grid-cols-3 gap-2">
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
      </div>

      {xpInfoOpen && (
        <StatInfoSheet
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
