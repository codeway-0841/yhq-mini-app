import { useEffect, useRef, useState } from 'react'
import { Plus, ScanLine, HelpCircle, X } from 'lucide-react'
import { haptics } from '../../../platform/haptics'

/**
 * Math Board — markaziy FAB action menyu (Faza 3).
 * Past-markaz fixed + safe-bottom. "Tanish" (recognition) va "Yordam" (hint)
 * ALOHIDA action'lar. Escape yopadi, focus menyuga o'tadi (keyboard nav).
 * Voice — non-goal, umuman yo'q.
 */

interface BoardActionFabProps {
  recognizeLabel: string
  helpLabel: string
  closeLabel: string
  menuLabel: string
  recognizeDisabled: boolean
  onRecognize: () => void
  onHelp: () => void
}

export default function BoardActionFab({
  recognizeLabel, helpLabel, closeLabel, menuLabel, recognizeDisabled, onRecognize, onHelp,
}: BoardActionFabProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open ])

  const toggle = (): void => {
    haptics.impact('light')
    setOpen((v) => !v)
  }

  return (
    <div className="fixed bottom-[calc(1rem+var(--safe-bottom,0px))] left-1/2 z-40 -translate-x-1/2">
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          className="mb-2.5 flex min-w-52 flex-col gap-1 rounded-2xl bg-pcard p-2 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={recognizeDisabled}
            onClick={() => {
              setOpen(false)
              onRecognize()
            }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-pfg transition-colors hover:bg-psurface disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <ScanLine size={18} strokeWidth={1.75} className="shrink-0 text-pmuted" />
            {recognizeLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onHelp()
            }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-pfg transition-colors hover:bg-psurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
          >
            <HelpCircle size={18} strokeWidth={1.75} className="shrink-0 text-pmuted" />
            {helpLabel}
          </button>
        </div>
      )}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? closeLabel : menuLabel}
          className="grid size-14 place-items-center rounded-full bg-pprimary text-white shadow-2xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas"
        >
          {open ? <X size={24} strokeWidth={2} /> : <Plus size={24} strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}
