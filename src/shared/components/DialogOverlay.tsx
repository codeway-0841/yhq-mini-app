import { useEffect, useRef, type ReactNode } from 'react'
import { registerModal } from '../lib/navigation'
import { haptics } from '../../platform/haptics'

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
  /** Pastdan chiquvchi sheet'larda pastga surib yopish imkoniyati (opt-in, default: false) */
  swipeToDismiss?: boolean
  /** Gesture faqat drag-handle yoki header zonasi orqali boshlanishi (default: true) */
  dragHandleOnly?: boolean
}

/**
 * Accessible modal overlay — barcha sheet/dialog'lar uchun YAGONA primitive.
 * Ta'minlaydi: role="dialog", aria-modal, focus-trap, Escape, body scroll-lock,
 * nested stack (faqat eng yuqori overlay Escape/Tab'ga javob beradi), focus restore,
 * hamda Android hardware/sensor orqaga surishda botdan chiqib ketmasdan modalni yopish.
 * Qo'shimcha ravishda: opt-in Pointer Events swipe-to-dismiss va spring fizika.
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

/**
 * Pointer boshlangan elementdan tepaga qarab eng yaqin skrollanuvchi elementni topadi.
 * Scroll conflict (ichki ro'yxat skrolli va sheet drag) oldini olish uchun zarur.
 */
function findScrollableAncestor(target: HTMLElement | null, boundary: HTMLElement | null): HTMLElement | null {
  let el = target
  while (el && el !== boundary) {
    try {
      const style = window.getComputedStyle(el)
      const overflowY = style.overflowY
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight
      if (isScrollable) return el
    } catch {
      break
    }
    el = el.parentElement
  }
  return null
}

export default function DialogOverlay({
  onClose,
  labelId,
  children,
  position = 'bottom',
  zIndex = 50,
  className,
  backdropClassName = 'bg-black/70 backdrop-blur-sm',
  swipeToDismiss = false,
  dragHandleOnly = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<symbol>(Symbol('dialog'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const prevFocusRef = useRef<Element | null>(null)

  // Gesture refs (React re-render'siz direct DOM manipulyatsiyasi uchun)
  const isClosingRef = useRef(false)
  const thresholdCrossedRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const dragStateRef = useRef<{
    pointerId: number
    startY: number
    startX: number
    lastY: number
    lastTime: number
    velocityY: number // in px/ms (~750 px/s threshold)
    isDragging: boolean
    scrollableAncestor: HTMLElement | null
  } | null>(null)

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

  // ── Swipe-to-Dismiss Pointer Event Handlers ──
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeToDismiss || position !== 'bottom' || isClosingRef.current) return
    if (e.isPrimary === false) return
    if (e.button !== 0 && e.pointerType === 'mouse') return

    const target = e.target as HTMLElement | null
    if (!target) return
    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? 0
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? 0

    // dragHandleOnly zonasi tekshiruvi (marker yoki sheet tepasi 48px)
    const isMarkedHandle = Boolean(
      target.closest?.('[data-drag-handle], [data-sheet-handle], .sheet-drag-handle, .sheet-drag-zone')
    )
    const sheetBox = sheetRef.current?.getBoundingClientRect()
    const isNearTop = sheetBox ? clientY - sheetBox.top <= 48 : false

    if (dragHandleOnly && !isMarkedHandle && !isNearTop) {
      return
    }

    const scrollableAncestor = findScrollableAncestor(target, sheetRef.current)
    thresholdCrossedRef.current = false

    dragStateRef.current = {
      pointerId: e.pointerId ?? 0,
      startY: clientY,
      startX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      velocityY: 0,
      isDragging: false,
      scrollableAncestor,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || (e.pointerId !== undefined && state.pointerId !== e.pointerId) || isClosingRef.current) return

    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? 0
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? 0

    const deltaX = clientX - state.startX
    const deltaY = clientY - state.startY
    const now = performance.now()
    const dt = now - state.lastTime

    if (dt > 0) {
      state.velocityY = (e.clientY - state.lastY) / dt // px/ms
    }
    state.lastY = e.clientY
    state.lastTime = now

    if (!state.isDragging) {
      // 1) Direction lock: gorizontal harakat bo'lsa aralashmaslik
      if (Math.abs(deltaX) > Math.abs(deltaY)) return

      // 2) Scroll conflict: agar ichki ro'yxat skrollangan bo'lsa, sheet drag boshlanmasin
      if (state.scrollableAncestor && state.scrollableAncestor.scrollTop > 0) return

      // 3) Boshlang'ich siljish chegarasi
      if (Math.abs(deltaY) > 6) {
        state.isDragging = true
        try {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        } catch {
          // pointer capture unsupported / already captured
        }
      } else {
        return
      }
    }

    // Accidental click himoyasi: 8px dan ortiq harakat bo'lsa keyingi click'ni bloklash
    if (Math.abs(deltaY) > 8) {
      suppressNextClickRef.current = true
    }

    // Rubber banding: tepaga tortilsa 0.15 qarshilik
    let currentY = deltaY
    if (currentY < 0) {
      currentY = deltaY * 0.15
    }

    const sheetHeight = sheetRef.current?.clientHeight || 400
    const thresholdDistance = Math.min(sheetHeight * 0.25, 140)

    // One-shot threshold haptic
    if (currentY > thresholdDistance) {
      if (!thresholdCrossedRef.current) {
        thresholdCrossedRef.current = true
        haptics.impact('light')
      }
    } else if (currentY < thresholdDistance - 30) {
      thresholdCrossedRef.current = false
    }

    // Direct DOM transform (React rerender'siz 120Hz silliq)
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translate3d(0, ${currentY}px, 0)`
    }
    if (backdropRef.current) {
      const opacity = Math.max(0, 1 - Math.max(0, currentY) / (sheetHeight * 1.4))
      backdropRef.current.style.opacity = `${opacity}`
    }
  }

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return

    const wasDragging = state.isDragging
    const finalVelocity = state.velocityY // px/ms
    const finalY = state.lastY - state.startY

    try {
      const target = e.target as HTMLElement
      if (target.hasPointerCapture?.(e.pointerId)) {
        target.releasePointerCapture?.(e.pointerId)
      }
    } catch {
      // noop
    }

    dragStateRef.current = null

    if (!wasDragging) return

    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    const sheetHeight = sheet?.clientHeight || 400
    const thresholdDistance = Math.min(sheetHeight * 0.25, 140)

    // Yopilish sharti: masofa thresholdi YOKI tezkor flick (>0.75 px/ms = ~750 px/s)
    const shouldClose = finalY > thresholdDistance || (finalVelocity > 0.75 && finalY > 20)
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (shouldClose) {
      isClosingRef.current = true
      if (sheet) {
        const exitDuration = prefersReduced ? 100 : 260
        sheet.style.transition = prefersReduced
          ? `transform ${exitDuration}ms ease-out`
          : `transform ${exitDuration}ms cubic-bezier(.32, 0, .67, 0)`
        sheet.style.transform = `translate3d(0, ${sheetHeight + 80}px, 0)`
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced ? 'opacity 100ms ease-out' : 'opacity 240ms ease-out'
        backdrop.style.opacity = '0'
      }
      setTimeout(() => {
        onCloseRef.current()
      }, prefersReduced ? 100 : 260)
    } else {
      // Spring snap-back qaytishi
      if (sheet) {
        const snapDuration = prefersReduced ? 120 : 320
        sheet.style.transition = prefersReduced
          ? `transform ${snapDuration}ms ease-out`
          : `transform ${snapDuration}ms cubic-bezier(.22, 1.2, .36, 1)`
        sheet.style.transform = 'translate3d(0, 0px, 0)'
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced ? 'opacity 120ms ease-out' : 'opacity 200ms ease-out'
        backdrop.style.opacity = '1'
      }
    }
  }

  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      style={{ zIndex }}
      className={`fixed inset-0 flex ${position === 'center' ? 'items-center justify-center p-4' : 'items-end justify-center'} ${className ?? ''}`}
    >
      <div ref={backdropRef} className={`absolute inset-0 ${backdropClassName}`} onClick={() => onCloseRef.current()} />
      {swipeToDismiss && position === 'bottom' ? (
        <div
          ref={sheetRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClickCapture={handleClickCapture}
          className="relative z-10 w-full flex justify-center will-change-transform"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

