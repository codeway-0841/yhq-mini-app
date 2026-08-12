import { memo, useRef } from 'react'
import { Flame, Star, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../../shared/i18n'
import { useCountUp } from '../../../shared/hooks/useCountUp'

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
      className="flex items-center gap-2 active:scale-95 transition-transform">
      <Flame size={16} className="text-pwarning" fill="currentColor" />
      <div className="text-left">
        <p className="text-[13px] font-semibold text-pfg leading-none tabular-nums">{streak} {tt('daysWord')}</p>
        <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('streakDays')}</p>
      </div>
    </button>
  )
})

// ── Hero: bugungi progress (ring + minimal statistika) ──────────────────────
export const ProgressCard = memo(function ProgressCard({ totalCorrect, totalAnswered, streak, totalPool, lang, onStreakPreview }: {
  totalCorrect: number; totalWrong: number; totalAnswered: number; streak: number
  totalPool: number
  lang: 'uz' | 'ru'
  onStreakPreview?: () => void
}) {
  const tt = useT(lang)
  const navigate = useNavigate()
  const total    = totalPool > 0 ? totalPool : 0
  const accuracy = totalAnswered > 0 ? Math.min(100, Math.round((totalCorrect / totalAnswered) * 100)) : 0
  const xp       = totalCorrect * 10
  const league   = totalCorrect >= 1000 ? 'Platinum' : totalCorrect >= 500 ? 'Gold' : totalCorrect >= 100 ? 'Silver' : 'Bronze'

  // Count-up animatsiya — sahifa ochilganda foiz "o'sib" chiqadi
  const shown    = useCountUp(accuracy, 900)

  // Ring chart geometriyasi (SVG)
  const R = 36, C = 2 * Math.PI * R
  const ringOffset = C * (1 - shown / 100)

  return (
    <div className="mx-5 mb-6 card-premium rounded-[28px] p-5 relative overflow-hidden"
      style={{ boxShadow: '0 0 44px -12px var(--p-glow), inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 28px rgba(2,6,16,0.30)' }}>
      <div className="flex items-center justify-between gap-4">
        {/* Chap: foiz + ma'lumot */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-psubtle mb-1.5">{tt('todayProgress')}</p>
          <p className="text-[36px] font-bold text-pfg leading-none tracking-tight tabular-nums">{shown}%</p>
          <p className="text-[12px] font-medium text-pmuted mt-2">
            {totalAnswered} / {total || '…'} {tt('question').toLowerCase()}
          </p>
        </div>
        {/* O'ng: ring chart (aksent rang) */}
        <svg width="96" height="96" viewBox="0 0 96 96" className="flex-shrink-0"
          style={{ filter: 'drop-shadow(0 0 12px var(--p-glow))' }}>
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--p-line)" strokeWidth="8" />
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--p-primary)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={ringOffset}
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dashoffset 700ms ease-out' }} />
          <text x="48" y="53" textAnchor="middle" fill="var(--p-fg)" fontSize="17" fontWeight="700">{shown}%</text>
        </svg>
      </div>
      {/* Pastki statistika: Seriya / XP / Reyting */}
      <div className="flex items-center justify-around mt-5 pt-4 border-t border-pline">
        {/* Streak — bosilsa "Intizom" sahifasi; 1s bosib turilsa → milestone PREVIEW (demo) */}
        <StreakButton streak={streak} onOpen={() => navigate('/streak')} onLongPress={onStreakPreview}
          tt={tt} ariaLabel={tt('intizomTitle')} />
        <div className="flex items-center gap-2">
          <Star size={16} className="text-pgold" fill="currentColor" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-pfg leading-none tabular-nums">{xp} XP</p>
            <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('totalXp')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-psubtle" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-pfg leading-none">{league}</p>
            <p className="text-[10px] font-medium text-psubtle mt-0.5">{tt('ratingWord')}</p>
          </div>
        </div>
      </div>
    </div>
  )
})
