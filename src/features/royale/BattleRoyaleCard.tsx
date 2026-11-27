import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Clock3, Shield, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { Button } from '../../shared/components/ui/button'
import { secondsUntilNextDailyShow, ROYALE_ROUNDS } from '../../../shared/battle-royale'

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function BattleRoyaleCard() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const ru = lang === 'ru'
  const [leftSec, setLeftSec] = useState(() => secondsUntilNextDailyShow())

  useEffect(() => {
    const id = window.setInterval(() => setLeftSec(secondsUntilNextDailyShow()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="rounded-3xl border-2 border-pline bg-pcard p-4 shadow-[0_3px_0_var(--p-line)]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--p-primary-rgb)/0.14)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-pprimary">
          <Crown size={13} strokeWidth={2.4} />
          Battle Royale · 21:00
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold tabular-nums text-pmuted">
          <Clock3 size={13} />
          {formatCountdown(leftSec)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold text-pfg leading-snug">
            {ru ? 'Живой турнир (100+ игроков)' : 'Jonli turnir (100+ o‘yinchi)'}
          </h3>
          <p className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold text-pmuted">
            <span>{ROYALE_ROUNDS} {ru ? 'вопросов' : 'savol'}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Shield size={12} className="text-psuccess" />
              {ru ? '1 щит · без монет' : '1 qalqon · coinsiz'}
            </span>
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={() => {
            playSound('click')
            haptics.impact('light')
            navigate('/royale')
          }}
        >
          <span>{ru ? 'Войти' : 'Kirish'}</span>
          <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  )
}
