import { ShieldAlert, AlertTriangle, AlertOctagon } from 'lucide-react'
import ModalMathGrid from '../../../shared/components/ModalMathGrid'
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md animate-in slide-in-from-bottom duration-200"
      role="alertdialog" aria-modal="true" aria-labelledby="anticheat-title" aria-describedby="anticheat-desc">
      <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-psurface px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] text-center shadow-2xl relative overflow-hidden">
        <ModalMathGrid glow={false} height={280} />
        <div data-drag-handle className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-4 cursor-grab active:cursor-grabbing touch-none select-none relative z-10" />

        <div className="relative z-10">
          <div className="size-14 rounded-2xl bg-pcard shadow-2xs flex items-center justify-center mx-auto mb-3.5 text-pdanger">
            {isFinalWarning ? <AlertOctagon size={30} /> : <ShieldAlert size={30} />}
          </div>

          <h3 id="anticheat-title" className="text-[17px] font-bold text-pfg tracking-tight mb-1.5">
            {tt('antiCheatWarningTitle')}
          </h3>

          <p id="anticheat-desc" className="text-xs text-pmuted leading-relaxed mb-4">
            {tt('antiCheatWarningDesc')}
          </p>

          {/* Ogohlantirish indikatori */}
          <div className="bg-pcard rounded-2xl p-3.5 mb-4 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-semibold text-pmuted flex items-center gap-1.5">
              <AlertTriangle size={14} className={isFinalWarning ? 'text-pdanger' : 'text-pwarning'} />
              {tt('antiCheatStrikeCount')}:
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: maxStrikes }).map((_, i) => (
                <span
                  key={i}
                  className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    i < strike
                      ? 'bg-pdanger text-white shadow-2xs'
                      : 'bg-psurface text-psubtle'
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[12px] font-semibold text-pdanger mb-5">
            {isFinalWarning ? tt('antiCheatStrikeHint2') : tt('antiCheatStrikeHint1')}
          </p>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full min-h-11 py-3 rounded-2xl bg-pdanger text-white font-bold text-sm shadow-xs hover:brightness-[1.06] active:scale-[0.98] transition-all"
          >
            {tt('antiCheatUnderstood')}
          </button>
        </div>
      </div>
    </div>
  )
}
