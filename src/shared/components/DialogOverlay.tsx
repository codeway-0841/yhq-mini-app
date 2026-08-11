import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  labelId?: string
  children: ReactNode
  position?: 'bottom' | 'center'
}

/**
 * Accessible modal overlay — wraps sheet/dialog content.
 * Provides: role="dialog", aria-modal, focus-trap, Escape to close.
 */
export default function DialogOverlay({ onClose, labelId, children, position = 'bottom' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus trap: Tab cycles within dialog
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length) focusable[0].focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className={`fixed inset-0 z-50 flex ${position === 'center' ? 'items-center justify-center p-4' : 'items-end'}`}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      {children}
    </div>
  )
}
