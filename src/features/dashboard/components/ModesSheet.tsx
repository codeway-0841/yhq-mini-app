import { ArrowLeft } from 'lucide-react'
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
 * TO'LIQ EKRAN panjara (xizmat tanlash sahifasi uslubida):
 * ← back + sarlavha header + 3-ustunli grid. Karta bosilsa ekran
 * yopilib, rejim navigatsiyasi ishga tushadi.
 * DialogOverlay: Escape + focus-trap + scroll-lock shu yerda ham kafolatlangan.
 */
export default function ModesSheet({ title, items, onClose }: {
  title: string
  items: ModeItem[]
  onClose: () => void
}) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  return (
    <DialogOverlay onClose={onClose} labelId="modes-sheet-title" position="center" className="!p-0" backdropClassName="hidden">
      <div className="relative w-full h-full bg-pcanvas flex flex-col animate-premiumIn">
        {/* Header — ← back + sarlavha (rasmdagi kabi) */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 safe-top">
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('backWord')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-pfg hover:bg-psurface active:scale-95 transition-all"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <p id="modes-sheet-title" className="text-[18px] font-semibold text-pfg">{title}</p>
        </div>

        {/* 3-ustunli rejimlar panjarasi */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 safe-bottom">
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
      </div>
    </DialogOverlay>
  )
}
