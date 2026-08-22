import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import DialogOverlay from './DialogOverlay'

export interface PickerOption {
  value:   string
  label:   string
  desc?:   string
  icon?:   ReactNode
}

export default function PickerSheet({ title, titleIcon, options, value, onSelect, onClose }: {
  title:    string
  titleIcon: ReactNode
  options:  PickerOption[]
  value:    string
  onSelect: (value: string) => void
  onClose:  () => void
}) {
  return (
    <DialogOverlay onClose={onClose} labelId="picker-title">
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />

        <p id="picker-title" className="flex items-center justify-center gap-2 text-base font-black mb-5">
          <span className="text-pblue">{titleIcon}</span>
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
                    ? 'border-pprimary bg-[rgb(var(--p-primary-rgb)/0.15)]'
                    : 'border-line bg-canvas active:border-lineStrong'
                }`}
              >
                {opt.icon && (
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center flex-none">
                    {opt.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-fg">
                    {opt.label}
                  </p>
                  {opt.desc && (
                    <p className="text-[11px] text-muted mt-0.5">{opt.desc}</p>
                  )}
                </div>
                {selected && <Check size={18} className="text-pprimary flex-none" />}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
