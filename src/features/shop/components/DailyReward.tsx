import { useState, useEffect, useCallback } from 'react'
import { Gift, Coins } from 'lucide-react'

interface Props {
  lang: 'uz' | 'ru'
  nextRewardTokens: number
  onClaim?: () => void | Promise<void>
}

function useCountdown() {
  const [time, setTime] = useState(() => getTimeToMidnight())
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeToMidnight()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function getTimeToMidnight() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  const diff = tomorrow.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { h, m, s }
}

const DAILY_KEY = 'yhq-daily-reward-last'

function isClaimedToday(): boolean {
  try {
    const last = localStorage.getItem(DAILY_KEY)
    if (!last) return false
    const today = new Date().toISOString().slice(0, 10)
    return last === today
  } catch { return false }
}

function markClaimed(): void {
  try {
    localStorage.setItem(DAILY_KEY, new Date().toISOString().slice(0, 10))
  } catch { /* ignore */ }
}

export function DailyReward({ lang, nextRewardTokens, onClaim }: Props) {
  const { h, m, s } = useCountdown()
  const [claimed, setClaimed] = useState(isClaimedToday)

  const handleClaim = useCallback(async () => {
    if (claimed) return
    setClaimed(true)
    markClaimed()
    await onClaim?.()
  }, [claimed, onClaim])

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden min-h-[120px] sm:w-[280px] flex flex-col justify-between"
      style={{
        background: 'linear-gradient(135deg, rgba(250,204,21,0.08) 0%, var(--p-card) 50%)',
        border: '1px solid rgba(250,204,21,0.25)',
      }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="text-[13px] font-bold text-pfg">
            {lang === 'ru' ? 'Ежедневный подарок' : "Kunlik sovg'a"}
          </h3>
          <p className="text-[10.5px] text-pmuted mt-0.5 leading-snug">
            {lang === 'ru' ? 'Заходите каждый день и получайте токены!' : 'Har kuni kirib token oling!'}
          </p>
        </div>
        <Gift size={24} className="text-pgold flex-shrink-0" />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-psubtle mb-1.5">
            {lang === 'ru' ? 'Следующий подарок:' : "Keyingi sovg'a:"}
          </p>
          <div className="flex items-center gap-1">
            <span className="bg-pcanvas px-2.5 py-1.5 rounded-lg text-[16px] font-bold text-pfg tabular-nums min-w-[40px] text-center">
              {String(h).padStart(2, '0')}
            </span>
            <span className="text-psubtle text-[14px] font-bold">:</span>
            <span className="bg-pcanvas px-2.5 py-1.5 rounded-lg text-[16px] font-bold text-pfg tabular-nums min-w-[40px] text-center">
              {String(m).padStart(2, '0')}
            </span>
            <span className="text-psubtle text-[14px] font-bold">:</span>
            <span className="bg-pcanvas px-2.5 py-1.5 rounded-lg text-[16px] font-bold text-pfg tabular-nums min-w-[40px] text-center">
              {String(s).padStart(2, '0')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClaim}
          disabled={claimed}
          aria-label={claimed ? (lang === 'ru' ? 'Уже получено' : 'Olingan') : (lang === 'ru' ? 'Получить подарок' : "Sovg'ani olish")}
          className="btn-neon w-full py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {claimed
            ? (lang === 'ru' ? 'Получено ✓' : 'Olingan ✓')
            : (lang === 'ru' ? 'Получить подарок' : "Sovg'ani olish")
          }
        </button>

        <div className="pt-2 border-t border-pline/50">
          <p className="text-[9.5px] text-pmuted mb-1">
            {lang === 'ru' ? 'Награда следующего уровня' : 'Keyingi daraja mukofoti'}
          </p>
          <div className="flex items-center gap-1">
            <Coins size={14} className="text-pgold" />
            <span className="text-[14px] font-black text-pgold">{nextRewardTokens.toLocaleString()} token</span>
          </div>
        </div>
      </div>
    </div>
  )
}
