import type { ReactNode } from 'react'
import DialogOverlay from './DialogOverlay'
import { useT } from '../i18n'
import { useAppStore } from '../store/useAppStore'

/** Level/XP/Coin/Liga statistikalari uchun bosilganda ochiladigan tushuntirish sheet. */
export default function StatInfoSheet({ icon, title, body, extra, onClose }: {
  icon:   ReactNode
  title:  string
  body:   string
  extra?: ReactNode
  onClose: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  return (
    <DialogOverlay onClose={onClose} labelId="stat-info-title" zIndex={60} swipeToDismiss>
      <div className="relative w-full bg-psurface rounded-t-sheet px-4 pt-4 pb-[calc(1.75rem+var(--safe-bottom,0px))] shadow-2xl">
        <div data-drag-handle className="w-10 h-1 bg-pline rounded-full mx-auto mb-5 cursor-grab active:cursor-grabbing touch-none" />

        <p id="stat-info-title" data-drag-handle className="flex items-center justify-center gap-2 text-base font-black mb-4 text-pfg select-none">
          <span className="text-pprimary">{icon}</span>
          {title}
        </p>

        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-pmuted">{body}</p>

        {extra && (
          <div className="mt-4 rounded-2xl bg-pcard p-3.5 text-[13px] font-semibold text-pfg shadow-xs">
            {extra}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-pprimary py-3.5 text-[14px] font-bold text-ponprimary shadow-xs transition-transform active:scale-[0.98]"
        >
          {tt('gotItBtn')}
        </button>
      </div>
    </DialogOverlay>
  )
}
