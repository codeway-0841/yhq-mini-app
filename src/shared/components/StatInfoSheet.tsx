import type { ReactNode } from 'react'
import DialogOverlay from './DialogOverlay'
import ModalMathGrid from './ModalMathGrid'
import ModalHeaderRow from './ModalHeaderRow'
import { Button } from './ui/button'
import { useT } from '../i18n'
import { useAppStore } from '../store/useAppStore'

/** Level/XP/Coin/Liga statistikalari uchun bosilganda ochiladigan tushuntirish sheet. */
export default function StatInfoSheet({ icon, title, body, extra, onClose }: {
  icon?:   ReactNode
  title:  string
  body:   string
  extra?: ReactNode
  onClose: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  return (
    <DialogOverlay onClose={onClose} labelId="stat-info-title" zIndex={60} swipeToDismiss backdropClassName="bg-black/60">
      <div className="relative w-full bg-psurface rounded-t-sheet px-4 pt-4 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl overflow-hidden">
        <ModalMathGrid glow={false} height={340} />
        <div data-drag-handle className="w-10 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none relative z-10" />

        <ModalHeaderRow onClose={onClose} label={tt('close') || 'Yopish'}>
          <h2 id="stat-info-title" data-drag-handle className="flex items-center justify-center gap-2 text-lg font-bold text-pfg select-none">
            {icon && <span className="text-pprimary">{icon}</span>}
            {title}
          </h2>
        </ModalHeaderRow>

        <div className="rounded-2xl bg-pcard p-4 shadow-2xs relative z-10 space-y-3">
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-pmuted">{body}</p>
          {extra && (
            <div className="pt-3 border-t border-pline text-[13px] font-semibold text-pfg">
              {extra}
            </div>
          )}
        </div>

        <div className="mt-5 relative z-10">
          <Button block onClick={onClose}>
            {tt('gotItBtn')}
          </Button>
        </div>
      </div>
    </DialogOverlay>
  )
}
