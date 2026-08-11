import { useState, useEffect, useCallback } from 'react'
import { Gift } from 'lucide-react'

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
    <div className="mx-4 mt-4 rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(250,204,21,0.08) 0%, var(--p-card) 50%)',
        border: '1px solid rgba(250,204,21,0.2)',
      }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-pfg">
            {lang === 'ru' ? 'Ежедневный подарок' : 'Kunlik sovg\'a'}
          </p>
          <p className="text-[11px] text-pmuted mt-0.5">
            {lang === 'ru' ? 'Заходите каждый день и получайте токены!' : 'Har kuni kirib token oling!'}
          </p>
        </div>
        <Gift size={28} className="text-pgold flex-shrink-0" />
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-psubtle">
            {lang === 'ru' ? 'Следующий:' : 'Keyingi:'}
          </span>
          <div className="flex gap-1">
            <span className="bg-pcanvas px-2 py-1 rounded-lg text-[13px] font-bold text-pfg tabular-nums">
              {String(h).padStart(2, '0')}
            </span>
            <span className="text-psubtle self-center">:</span>
            <span className="bg-pcanvas px-2 py-1 rounded-lg text-[13px] font-bold text-pfg tabular-nums">
              {String(m).padStart(2, '0')}
            </span>
            <span className="text-psubtle self-center">:</span>
            <span className="bg-pcanvas px-2 py-1 rounded-lg text-[13px] font-bold text-pfg tabular-nums">
              {String(s).padStart(2, '0')}
            </span>
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={claimed}
          className="btn-neon px-4 py-2 rounded-xl text-[12px] font-bold disabled:opacity-40"
        >
          {claimed
            ? (lang === 'ru' ? 'Получено' : 'Olingan')
            : (lang === 'ru' ? 'Получить' : 'Olish')
          }
        </button>
      </div>

      <p className="text-[10.5px] text-pgold font-semibold mt-2">
        {lang === 'ru' ? `Награда: ${nextRewardTokens} токенов` : `Mukofot: ${nextRewardTokens} token`}
      </p>
    </div>
  )
}
