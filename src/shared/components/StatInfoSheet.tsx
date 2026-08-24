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
    <DialogOverlay onClose={onClose} labelId="stat-info-title" zIndex={60}>
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-4 pb-8">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-5" />

        <p id="stat-info-title" className="flex items-center justify-center gap-2 text-base font-black mb-4 text-fg">
          <span className="text-pprimary">{icon}</span>
          {title}
        </p>

        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{body}</p>

        {extra && (
          <div className="mt-4 rounded-2xl border border-line bg-canvas p-3 text-[13px] font-semibold text-fg">
            {extra}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-pprimary py-3 text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
        >
          {tt('gotItBtn')}
        </button>
      </div>
    </DialogOverlay>
  )
}
