import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalHeaderRow from './ModalHeaderRow'
import { cn } from '../lib/cn'

export interface PickerOption {
  value:   string
  label:   string
  desc?:   string
  icon?:   ReactNode
}

export default function PickerSheet({ title, titleIcon: _titleIcon, options, value, onSelect, onClose }: {
  title:    string
  titleIcon?: ReactNode
  options:  PickerOption[]
  value:    string
  onSelect: (value: string) => void
  onClose:  () => void
}) {
  return (
    <DialogOverlay onClose={onClose} labelId="picker-title" swipeToDismiss>
      <div className="relative w-full bg-psurface rounded-t-sheet px-5 pt-3 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={360} />
        <div data-drag-handle className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10" />

        {/* Minimalist Centered Header */}
        <ModalHeaderRow onClose={onClose} label="Yopish">
          <h2 id="picker-title" className="text-[19px] font-bold text-pfg tracking-tight">
            {title}
          </h2>
        </ModalHeaderRow>

        <div className="flex flex-col gap-2.5 relative z-10">
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(opt.value); onClose() }}
                className={cn(
                  'flex items-center justify-between w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] cursor-pointer bg-pcard',
                  selected
                    ? 'ring-2 ring-pprimary shadow-md'
                    : 'shadow-2xs hover:shadow-xs'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {opt.icon && (
                    <div className="size-9 rounded-xl bg-psurface flex items-center justify-center flex-none text-pfg">
                      {opt.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-pfg">
                      {opt.label}
                    </p>
                    {opt.desc && (
                      <p className="text-[11.5px] text-pmuted mt-0.5">{opt.desc}</p>
                    )}
                  </div>
                </div>
                {selected && (
                  <Check size={18} strokeWidth={2.4} className="text-pprimary flex-none" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </DialogOverlay>
  )
}
