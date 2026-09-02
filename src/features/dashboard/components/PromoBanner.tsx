import { memo, useEffect, useState } from 'react'

// ── Promo banner — VAQTINCHA O'CHIQ. Qayta yoqish: SHOW_PROMO = true ────────
export const SHOW_PROMO = false

// ── Promo Countdown ─────────────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(() => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return Math.floor((end.getTime() - now.getTime()) / 1000)
  })

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export const PromoBanner = memo(function PromoBanner({ text }: { text: string }) {
  const countdown = useCountdown()
  return (
    <div className="relative mx-5 mb-6 overflow-hidden rounded-2xl bg-pcard shadow-xs">
      <div className="relative z-10 flex items-center justify-between gap-4 p-4">
        <p className="max-w-[55%] text-[13px] font-semibold leading-snug text-pfg">
          {text}
        </p>
        <span className="font-display text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-pdanger">
          {countdown}
        </span>
      </div>
    </div>
  )
})
