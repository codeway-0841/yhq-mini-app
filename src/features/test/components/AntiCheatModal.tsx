import { AlertTriangle } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import type { Lang } from '../../../shared/i18n'
import { ConfirmMascot } from '../../../shared/components/ui/confirm-mascot'

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
      <div className="w-full max-w-lg mx-auto rounded-t-sheet bg-[#050308] text-white pt-3 pb-[calc(1rem+var(--safe-bottom,0px))] text-center shadow-2xl relative overflow-hidden">
        <div data-drag-handle className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing touch-none select-none relative z-10" />

        <div className="relative z-10">
          <div className="px-6">
            <h3 id="anticheat-title" className="font-display text-[21px] font-black uppercase leading-tight tracking-tight text-white mb-2">
              {tt('antiCheatWarningTitle')}
            </h3>

            <p id="anticheat-desc" className="text-[13px] text-white/55 leading-snug mb-1">
              {tt('antiCheatWarningDesc')}
            </p>
          </div>

          <ConfirmMascot emotion={isFinalWarning ? 'danger' : 'warning'} className="-mb-12 w-full max-w-[380px] pointer-events-none" />

          {/* Maskot ko'ksida suzib turuvchi qora ogohlantirish va tugma kartasi */}
          <div className="relative z-20 mx-3.5 rounded-3xl bg-[#07050c]/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="bg-white/[0.06] rounded-2xl p-3 mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/75 flex items-center gap-1.5">
                <AlertTriangle size={14} className={isFinalWarning ? 'text-pdanger' : 'text-pwarning'} />
                {tt('antiCheatStrikeCount')}:
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: maxStrikes }).map((_, i) => (
                  <span
                    key={i}
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      i < strike
                        ? 'bg-pdanger text-white shadow-2xs'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[12px] font-semibold text-pdanger mb-3">
              {isFinalWarning ? tt('antiCheatStrikeHint2') : tt('antiCheatStrikeHint1')}
            </p>

            <button
              type="button"
              onClick={onDismiss}
              className="flex h-12 w-full items-center justify-between rounded-full bg-white pl-5 pr-1.5 font-mono text-[13px] font-bold uppercase tracking-[0.05em] text-[#09070e] shadow-md hover:brightness-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="mx-auto pl-6">{tt('antiCheatUnderstood')}</span>
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#09070e] text-white"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="3" r="1.25" fill="currentColor" />
                  <circle cx="7" cy="11" r="1.25" fill="currentColor" />
                  <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                  <circle cx="11" cy="7" r="1.25" fill="currentColor" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
