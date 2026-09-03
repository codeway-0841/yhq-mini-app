import { ArrowLeft } from 'lucide-react'
import { createPortal } from 'react-dom'
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
 * createPortal orqali document.body'ga chiqariladi (Dashboard stacking context'dan qochish).
 * DialogOverlay: Escape + focus-trap + scroll-lock shu yerda ham kafolatlangan.
 */
export default function ModesSheet({ title, items, onClose }: {
  title: string
  items: ModeItem[]
  onClose: () => void
}) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  const content = (
    <DialogOverlay onClose={onClose} labelId="modes-sheet-title" position="center" className="!p-0" backdropClassName="hidden" zIndex={60}>
      <div className="relative w-full h-full bg-pcanvas flex flex-col animate-premiumIn">
        {/* Header — SSOT safe-top header (to'liq ekranda manfiy marginsiz) */}
        <header className="shrink-0 flex items-center gap-3 px-4 pb-3 pt-[calc(var(--safe-top,0px)+0.75rem)] bg-pcanvas border-b border-pline">
          <button
            type="button"
            onClick={onClose}
            aria-label={tt('backWord')}
            className="size-9 rounded-xl bg-psurface flex items-center justify-center text-pfg active:scale-95 shadow-xs transition-all"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <p id="modes-sheet-title" className="text-[17px] font-bold text-pfg">{title}</p>
        </header>

        {/* 3-ustunli rejimlar panjarasi */}
        <div className="flex-1 overflow-y-auto px-4 py-4 safe-bottom">
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

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
