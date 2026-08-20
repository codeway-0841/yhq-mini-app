import { ShieldAlert, AlertTriangle, AlertOctagon } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import type { Lang } from '../../../shared/i18n'

interface AntiCheatModalProps {
  strike: number
  maxStrikes?: number
  language?: Lang
  onDismiss: () => void
}

export default function AntiCheatModal({
  strike,
  maxStrikes = 3,
  language = 'uz',
  onDismiss,
}: AntiCheatModalProps) {
  const tt = useT(language)
  const isFinalWarning = strike === maxStrikes - 1

  return (
    // QASDDAN DialogOverlay'siz: ogohlantirish faqat "Tushundim" tugmasi bilan yopiladi
    // (Escape/backdrop-yopish anti-cheat ogohlantirishini aylanib o'tishga yo'l qo'ymasligi shart)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-premiumIn"
      role="alertdialog" aria-modal="true" aria-labelledby="anticheat-title" aria-describedby="anticheat-desc">
      <div className="w-full max-w-sm rounded-3xl bg-surface border-2 border-duo-red/60 p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Yuqori aksent nuri */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-36 bg-duo-red/25 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-duo-red/15 border border-duo-red/40 flex items-center justify-center mx-auto mb-4 text-duo-red animate-pulse">
          {isFinalWarning ? <AlertOctagon size={34} /> : <ShieldAlert size={34} />}
        </div>

        <h3 id="anticheat-title" className="text-lg font-black text-fg mb-1">
          {tt('antiCheatWarningTitle')}
        </h3>

        <p id="anticheat-desc" className="text-xs text-subtle leading-relaxed mb-4">
          {tt('antiCheatWarningDesc')}
        </p>

        {/* Ogohlantirish indikatori */}
        <div className="bg-elevated border border-line rounded-2xl p-3.5 mb-5 flex items-center justify-between">
          <span className="text-xs font-bold text-muted flex items-center gap-1.5">
            <AlertTriangle size={14} className={isFinalWarning ? 'text-duo-red' : 'text-duo-yellow'} />
            {tt('antiCheatStrikeCount')}:
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxStrikes }).map((_, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  i < strike
                    ? 'bg-duo-red text-white scale-110 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'bg-line text-subtle'
                }`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[12px] font-semibold text-duo-red mb-6">
          {isFinalWarning ? tt('antiCheatStrikeHint2') : tt('antiCheatStrikeHint1')}
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 rounded-2xl bg-duo-red text-white font-black text-sm shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:bg-duo-red/90 active:scale-[0.98] transition-all"
        >
          {tt('antiCheatUnderstood')}
        </button>
      </div>
    </div>
  )
}
