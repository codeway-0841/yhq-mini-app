import { useEffect, useRef, type ReactNode } from 'react'
import { registerModal } from '../lib/navigation'

interface Props {
  onClose: () => void
  labelId?: string
  children: ReactNode
  position?: 'bottom' | 'center'
  /** Nested/celebration overlay'lar uchun (default 50; celebrations 70, ichki modallar 60) */
  zIndex?: number
  /** Qo'shimcha klasslar (masalan, animate-premiumIn) */
  className?: string
  /** Backdrop klassi (default: bg-black/70 backdrop-blur-sm) */
  backdropClassName?: string
}

/**
 * Accessible modal overlay — barcha sheet/dialog'lar uchun YAGONA primitive.
 * Ta'minlaydi: role="dialog", aria-modal, focus-trap, Escape, body scroll-lock,
 * nested stack (faqat eng yuqori overlay Escape/Tab'ga javob beradi), focus restore,
 * hamda Android hardware/sensor orqaga surishda botdan chiqib ketmasdan modalni yopish.
 */

// Nested overlay stack — id'lar ochilish tartibida; Escape/Tab faqat OXIRGISIGA tegishli
const dialogStack: symbol[] = []
// Body scroll-lock — nested overlay'lar hisoblagich bilan
let scrollLocks = 0
let savedOverflow: string | null = null

function lockScroll() {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLocks++
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1)
  if (scrollLocks === 0 && savedOverflow !== null) {
    document.body.style.overflow = savedOverflow
    savedOverflow = null
  }
}

const isTop = (id: symbol) => dialogStack[dialogStack.length - 1] === id

export default function DialogOverlay({ onClose, labelId, children, position = 'bottom', zIndex = 50, className, backdropClassName = 'bg-black/70 backdrop-blur-sm' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<symbol>(Symbol('dialog'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const prevFocusRef = useRef<Element | null>(null)

  // Stack ro'yxati + body scroll-lock + modal stack ro'yxati + focus restore
  useEffect(() => {
    const id = idRef.current
    dialogStack.push(id)
    lockScroll()
    prevFocusRef.current = document.activeElement

    // Global navigation modal stack ro'yxatiga qo'shish (Telegram BackButton & Android hardware back uchun)
    const unregister = registerModal(id, () => {
      onCloseRef.current()
    })

    return () => {
      unregister()
      const i = dialogStack.indexOf(id)
      if (i >= 0) dialogStack.splice(i, 1)
      unlockScroll()

      // Fokusni trigger elementga qaytarish (element hali DOM'da bo'lsa)
      const prev = prevFocusRef.current
      if (prev instanceof HTMLElement && document.contains(prev)) prev.focus()
    }
  }, [])

  // Escape — FAQAT eng yuqoridagi overlay (nested'da pastki yopilmaydi)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop(idRef.current)) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus trap: Tab faqat dialog ichida aylanadi. DOM o'zgarishiga bardoshli —
  // focusable'lar HAR Tab bosishda qayta qidiriladi (dynamic kontent uchun).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(SELECTOR))
        .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
    // Ochilganda birinchi interaktiv elementga fokus
    focusables()[0]?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !isTop(idRef.current)) return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
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
      style={{ zIndex }}
      className={`fixed inset-0 flex ${position === 'center' ? 'items-center justify-center p-4' : 'items-end justify-center'} ${className ?? ''}`}
    >
      <div className={`absolute inset-0 ${backdropClassName}`} onClick={() => onCloseRef.current()} />
      {children}
    </div>
  )
}
