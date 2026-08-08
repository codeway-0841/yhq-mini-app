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
    <div className="mx-5 mb-4 card-premium rounded-[24px] relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
      <div className="relative z-10 p-4 flex items-center justify-between">
        <p className="text-pfg text-[13px] font-semibold leading-snug max-w-[55%]">
          {text}
        </p>
        <span className="text-pdanger text-[28px] font-bold tracking-wider tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {countdown}
        </span>
      </div>
    </div>
  )
})
