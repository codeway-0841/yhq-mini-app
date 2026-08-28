import { X } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { useT } from '../../../shared/i18n'
import { useAppStore } from '../../../shared/store/useAppStore'
import { ModeGridCard } from './GridCards'

export interface ModeItem {
  icon: React.ElementType
  label: string
  onClick: () => void
}

/**
 * ModesSheet — "Rejimlar" karuselidagi "Yana" bosilganda ochiladigan
 * to'liq panjara (payme/usluga tanlash uslubida 3-ustunli grid).
 * Karta bosilsa sheet yopilib, rejim navigatsiyasi ishga tushadi.
 */
export default function ModesSheet({ title, items, onClose }: {
  title: string
  items: ModeItem[]
  onClose: () => void
}) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  return (
    <DialogOverlay onClose={onClose} labelId="modes-sheet-title">
      <div className="relative w-full bg-psurface rounded-t-sheet border-t border-pline p-4 pb-8 max-h-[85dvh] overflow-y-auto">
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4 px-1">
          <p id="modes-sheet-title" className="font-display text-[17px] font-bold tracking-[-0.01em] text-pfg">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('close')}
            className="w-8 h-8 rounded-full bg-pcard border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {items.map((it) => (
            <ModeGridCard
              key={it.label}
              icon={it.icon}
              label={it.label}
              onClick={() => { onClose(); it.onClick() }}
            />
          ))}
        </div>
      </div>
    </DialogOverlay>
  )
}
