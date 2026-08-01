import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

export interface PickerOption {
  value:   string
  label:   string
  desc?:   string
  icon?:   ReactNode
}

/**
 * Umumiy bottom-sheet tanlash oynasi (rasmdagidek: sarlavha + variantlar,
 * tanlangan qator yashil border + checkmark bilan).
 */
export default function PickerSheet({ title, titleIcon, options, value, onSelect, onClose }: {
  title:    string
  titleIcon: ReactNode
  options:  PickerOption[]
  value:    string
  onSelect: (value: string) => void
  onClose:  () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-[#161b22] rounded-t-3xl border-t border-[#30363d] p-4 pb-8">
        <div className="w-10 h-1 bg-[#30363d] rounded-full mx-auto mb-5" />

        <p className="flex items-center justify-center gap-2 text-base font-black mb-5">
          <span className="text-[#1f6feb]">{titleIcon}</span>
          {title}
        </p>

        <div className="flex flex-col gap-3">
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); onClose() }}
                className={`flex items-center gap-3 w-full rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98] ${
                  selected
                    ? 'border-[#22c55e] bg-[#22c55e]/15'
                    : 'border-[#30363d] bg-[#0d1117] active:border-[#484f58]'
                }`}
              >
                {opt.icon && (
                  <div className="w-10 h-10 rounded-full bg-[#21262d] flex items-center justify-center flex-none">
                    {opt.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-[#e6edf3]'}`}>
                    {opt.label}
                  </p>
                  {opt.desc && (
                    <p className="text-[11px] text-[#8b949e] mt-0.5">{opt.desc}</p>
                  )}
                </div>
                {selected && <Check size={18} className="text-[#22c55e] flex-none" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
