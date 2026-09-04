import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { registerModal } from '../lib/navigation'
import { haptics } from '../../platform/haptics'

export type CloseReason = 'backdrop' | 'escape' | 'back' | 'swipe' | 'button'

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
  /** Backdrop bosilganda modalni yopish (default: true) */
  closeOnBackdrop?: boolean
  /** Har bir yopilish sababi bo'yicha ruxsatni tekshirish (masalan, dirty form himoyasi) */
  canDismiss?: (reason: CloseReason) => boolean
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
  closeOnBackdrop = true,
  canDismiss,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<symbol>(Symbol('dialog'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const prevFocusRef = useRef<Element | null>(null)

  // Barcha yopilish yo'llarini birlashtiruvchi markaziy yopilish mexanizmi
  const closeOnceRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  const requestClose = useCallback((reason: CloseReason) => {
    if (closeOnceRef.current) return
    if (canDismiss && !canDismiss(reason)) return
    if (closeOnBackdrop === false && reason === 'backdrop') return

    closeOnceRef.current = true
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    onCloseRef.current()
  }, [canDismiss, closeOnBackdrop])

  // Gesture refs (React re-render'siz direct DOM manipulyatsiyasi uchun)
  const isClosingRef = useRef(false)
  const thresholdCrossedRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const dragStateRef = useRef<{
    pointerId: number
    startY: number
    startX: number
    lastY: number
    lastX: number
    lastTime: number
    velocityY: number // in px/ms
    axis: 'pending' | 'horizontal' | 'vertical'
    isDragging: boolean
  } | null>(null)

  // Stack ro'yxati + body scroll-lock + modal stack ro'yxati + focus restore
  useEffect(() => {
    const id = idRef.current
    dialogStack.push(id)
    lockScroll()
    prevFocusRef.current = document.activeElement

    // Global navigation modal stack ro'yxatiga qo'shish (Telegram BackButton & Android hardware back uchun)
    const unregister = registerModal(id, () => {
      requestClose('back')
    })

    return () => {
      unregister()
      const i = dialogStack.indexOf(id)
      if (i >= 0) dialogStack.splice(i, 1)
      unlockScroll()

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      // Fokusni trigger elementga qaytarish (element hali DOM'da bo'lsa)
      const prev = prevFocusRef.current
      if (prev instanceof HTMLElement && document.contains(prev)) prev.focus()
    }
  }, [requestClose])

  // Escape — FAQAT eng yuqoridagi overlay (nested'da pastki yopilmaydi)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop(idRef.current)) {
        e.stopPropagation()
        requestClose('escape')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [requestClose])

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

    // Interactive element himoyasi: agar pointer tugma, havola yoki input ustida boshlansa drag qilinmasin
    if (target.closest('button, a, input, select, textarea, [role="button"]')) {
      return
    }

    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? 0
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? 0

    // Handle + Header zonasi tekshiruvi:
    // 1) Explicit handle marker: [data-drag-handle], [data-sheet-handle], .sheet-drag-handle, .sheet-drag-zone
    // 2) Yoki sheet tepasidan 56px gacha bo'lgan header zonasi (interactive elementlar bundan mustasno)
    const isMarkedHandle = Boolean(
      target.closest?.('[data-drag-handle], [data-sheet-handle], .sheet-drag-handle, .sheet-drag-zone')
    )
    const sheetBox = sheetRef.current?.getBoundingClientRect()
    const isNearTop = sheetBox ? clientY - sheetBox.top <= 56 : false

    if (dragHandleOnly && !isMarkedHandle && !isNearTop) {
      return
    }

    thresholdCrossedRef.current = false

    dragStateRef.current = {
      pointerId: e.pointerId ?? 0,
      startY: clientY,
      startX: clientX,
      lastY: clientY,
      lastX: clientX,
      lastTime: performance.now(),
      velocityY: 0,
      axis: 'pending',
      isDragging: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || (e.pointerId !== undefined && state.pointerId !== e.pointerId) || isClosingRef.current) return

    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? state.lastY
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? state.lastX

    const deltaX = clientX - state.startX
    const deltaY = clientY - state.startY
    const now = performance.now()
    const dt = now - state.lastTime

    if (dt > 0) {
      state.velocityY = (clientY - state.lastY) / dt // px/ms
    }
    state.lastY = clientY
    state.lastX = clientX
    state.lastTime = now

    // State machine: yo'nalishni 6-8px slopdan keyin BIR MARTA aniqlash
    if (state.axis === 'pending') {
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      if (absX > 6 || absY > 6) {
        if (absX > absY) {
          state.axis = 'horizontal'
          return
        } else {
          state.axis = 'vertical'
        }
      } else {
        return
      }
    }

    // Horizontal harakat aniqlansa, gesture oxirigacha sheetga tegmaslik
    if (state.axis === 'horizontal') {
      return
    }

    // Vertical drag aktivlashuvi
    if (!state.isDragging) {
      state.isDragging = true
      try {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        // pointer capture unsupported / already captured
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

    // One-shot threshold haptic (domain method)
    if (currentY > thresholdDistance) {
      if (!thresholdCrossedRef.current) {
        thresholdCrossedRef.current = true
        haptics.threshold()
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

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return

    // Pointer koordinatalarini pointerup vaqtida ham yangilash
    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? state.lastY
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? state.lastX
    const now = performance.now()
    const dt = now - state.lastTime
    if (dt > 0 && clientY !== state.lastY) {
      state.velocityY = (clientY - state.lastY) / dt
    }
    state.lastY = clientY
    state.lastX = clientX
    state.lastTime = now

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

    const canSwipeDismiss = canDismiss ? canDismiss('swipe') : true
    const shouldClose = canSwipeDismiss && (finalY > thresholdDistance || (finalVelocity > 0.75 && finalY > 20))
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (shouldClose) {
      isClosingRef.current = true
      const exitDuration = prefersReduced ? 0 : 260
      if (sheet) {
        sheet.style.transition = prefersReduced
          ? 'none'
          : `transform ${exitDuration}ms cubic-bezier(.32, 0, .67, 0)`
        sheet.style.transform = `translate3d(0, ${sheetHeight + 80}px, 0)`
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced ? 'none' : 'opacity 240ms ease-out'
        backdrop.style.opacity = '0'
      }

      if (exitDuration === 0) {
        requestClose('swipe')
      } else {
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = null
          requestClose('swipe')
        }, exitDuration)
      }
    } else {
      // Spring snap-back qaytishi
      const snapDuration = prefersReduced ? 0 : 320
      if (sheet) {
        sheet.style.transition = prefersReduced
          ? 'none'
          : `transform ${snapDuration}ms cubic-bezier(.22, 1.2, .36, 1)`
        sheet.style.transform = 'translate3d(0, 0px, 0)'
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced ? 'none' : 'opacity 200ms ease-out'
        backdrop.style.opacity = '1'
      }
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return

    try {
      const target = e.target as HTMLElement
      if (target.hasPointerCapture?.(e.pointerId)) {
        target.releasePointerCapture?.(e.pointerId)
      }
    } catch {
      // noop
    }

    const wasDragging = state.isDragging
    dragStateRef.current = null

    if (!wasDragging) return

    // pointercancel da HECH QACHON dismiss bo'lmaydi, faqat snap-back
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    const snapDuration = prefersReduced ? 0 : 320
    if (sheet) {
      sheet.style.transition = prefersReduced
        ? 'none'
        : `transform ${snapDuration}ms cubic-bezier(.22, 1.2, .36, 1)`
      sheet.style.transform = 'translate3d(0, 0px, 0)'
    }
    if (backdrop) {
      backdrop.style.transition = prefersReduced ? 'none' : 'opacity 200ms ease-out'
      backdrop.style.opacity = '1'
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
      <div
        ref={backdropRef}
        className={`absolute inset-0 ${backdropClassName}`}
        onClick={() => requestClose('backdrop')}
      />
      {swipeToDismiss && position === 'bottom' ? (
        <div
          ref={sheetRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
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

