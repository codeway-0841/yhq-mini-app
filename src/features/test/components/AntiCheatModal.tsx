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
      <div className="w-full max-w-sm rounded-2xl bg-psurface p-6 text-center shadow-2xl relative overflow-hidden ring-2 ring-pdanger/50">
        {/* Yuqori aksent nuri */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-36 bg-pdanger/25 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--p-danger-rgb)/0.12)] flex items-center justify-center mx-auto mb-4 text-pdanger">
          {isFinalWarning ? <AlertOctagon size={34} /> : <ShieldAlert size={34} />}
        </div>

        <h3 id="anticheat-title" className="text-lg font-semibold text-pfg mb-1">
          {tt('antiCheatWarningTitle')}
        </h3>

        <p id="anticheat-desc" className="text-xs text-psubtle leading-relaxed mb-4">
          {tt('antiCheatWarningDesc')}
        </p>

        {/* Ogohlantirish indikatori */}
        <div className="bg-pcard rounded-2xl p-3.5 mb-5 flex items-center justify-between shadow-xs">
          <span className="text-xs font-semibold text-pmuted flex items-center gap-1.5">
            <AlertTriangle size={14} className={isFinalWarning ? 'text-pdanger' : 'text-pwarning'} />
            {tt('antiCheatStrikeCount')}:
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxStrikes }).map((_, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                  i < strike
                    ? 'bg-pdanger text-white scale-110 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'bg-plineStrong text-psubtle'
                }`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[12px] font-semibold text-pdanger mb-6">
          {isFinalWarning ? tt('antiCheatStrikeHint2') : tt('antiCheatStrikeHint1')}
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 rounded-2xl bg-pdanger text-white font-semibold text-sm shadow-md hover:bg-pdanger/90 active:scale-[0.98] transition-all"
        >
          {tt('antiCheatUnderstood')}
        </button>
      </div>
    </div>
  )
}
