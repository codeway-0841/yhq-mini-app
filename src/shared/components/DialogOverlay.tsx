import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { registerModal } from '../lib/navigation'
import { haptics } from '../../platform/haptics'

export type CloseReason = 'backdrop' | 'escape' | 'back' | 'swipe'

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
  /** Gesture faqat drag-handle yoki header zonasi orqali boshlanishi (default: false — full surface drag) */
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

function findScrollContainer(el: HTMLElement | null, stopEl: HTMLElement | null): HTMLElement | null {
  let curr: HTMLElement | null = el
  while (curr && curr !== stopEl) {
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(curr)
      const overflowY = style.overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
        return curr
      }
    }
    curr = curr.parentElement
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
  dragHandleOnly = false,
  closeOnBackdrop = true,
  canDismiss,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const idRef = useRef<symbol>(Symbol('dialog'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const canDismissRef = useRef(canDismiss)
  canDismissRef.current = canDismiss
  const closeOnBackdropRef = useRef(closeOnBackdrop)
  closeOnBackdropRef.current = closeOnBackdrop
  const prevFocusRef = useRef<Element | null>(null)

  // Overlay boshqaradigan barcha yopilish yo'llari uchun yagona siyosat va commit nuqtasi.
  const closeOnceRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  const isDismissAllowed = useCallback((reason: CloseReason) => {
    if (canDismissRef.current && !canDismissRef.current(reason)) return
    if (closeOnBackdropRef.current === false && reason === 'backdrop') return

    return true
  }, [])

  const commitClose = useCallback(() => {
    if (closeOnceRef.current) return

    closeOnceRef.current = true
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    onCloseRef.current()
  }, [])

  const requestClose = useCallback((reason: CloseReason) => {
    if (!isDismissAllowed(reason)) return
    commitClose()
  }, [commitClose, isDismissAllowed])

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
    samples: { time: number; y: number }[]
    velocityY: number // in px/ms
    axis: 'pending' | 'horizontal' | 'vertical'
    isDragging: boolean
    scrollContainer: HTMLElement | null
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

    // Text inputs & editables himoyasi: matn kiritish / belgilash paytida drag qilinmasin
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return
    }

    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? 0
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? 0

    // Explicit handle yoki header zonasi tekshiruvi:
    const isMarkedHandle = Boolean(
      target.closest?.('[data-drag-handle], [data-sheet-handle], .sheet-drag-handle, .sheet-drag-zone')
    )
    const sheetBox = sheetRef.current?.getBoundingClientRect()
    const isNearTop = sheetBox ? clientY - sheetBox.top <= 56 : false

    if (dragHandleOnly && !isMarkedHandle && !isNearTop) {
      return
    }

    const scrollContainer = findScrollContainer(target, sheetRef.current)

    thresholdCrossedRef.current = false

    dragStateRef.current = {
      pointerId: e.pointerId ?? 0,
      startY: clientY,
      startX: clientX,
      lastY: clientY,
      lastX: clientX,
      samples: [{ time: performance.now(), y: clientY }],
      velocityY: 0,
      axis: 'pending',
      isDragging: false,
      scrollContainer,
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

    // Rolling sample window (oxirgi 100ms ichidagi siljishlarni saqlash — yuqori aniqlikdagi tezlik hisobi)
    state.samples = state.samples.filter((s) => now - s.time < 100)
    state.samples.push({ time: now, y: clientY })

    if (state.samples.length >= 2) {
      const first = state.samples[0]
      const last = state.samples[state.samples.length - 1]
      const dt = last.time - first.time
      if (dt > 0) {
        state.velocityY = (last.y - first.y) / dt // px/ms
      }
    } else {
      state.velocityY = 0
    }

    state.lastY = clientY
    state.lastX = clientX

    // Nested scroll koordinatsiyasi: agar element scroll ro'yxat ichida bo'lsa
    if (state.scrollContainer) {
      const currentScrollTop = state.scrollContainer.scrollTop
      // Ro'yxat o'rtasida/pastida bo'lsa, oddiy scroll ishlashiga imkon berish
      if (currentScrollTop > 0) {
        return
      }
      // Ro'yxat eng tepada (scrollTop <= 0) bo'lib, foydalanuvchi tepaga itarsa, ro'yxat scroll bo'lsin
      if (deltaY < 0 && !state.isDragging) {
        return
      }
    }

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

    // Accidental click himoyasi: 6px dan ortiq harakat bo'lsa keyingi click'ni bloklash
    if (Math.abs(deltaY) > 6) {
      suppressNextClickRef.current = true
    }

    // Rubber banding: tepaga tortilsa 0.12 elastik qarshilik
    let currentY = deltaY
    if (currentY < 0) {
      currentY = deltaY * 0.12
    }

    const sheetHeight = sheetRef.current?.clientHeight || 400
    const thresholdDistance = Math.min(sheetHeight * 0.2, 75)

    // One-shot threshold haptic (domain method)
    if (currentY > thresholdDistance) {
      if (!thresholdCrossedRef.current) {
        thresholdCrossedRef.current = true
        haptics.threshold()
      }
    } else if (currentY < thresholdDistance - 25) {
      thresholdCrossedRef.current = false
    }

    // Direct DOM transform (React rerender'siz 120Hz/144Hz silliq)
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translate3d(0, ${currentY}px, 0)`
    }
    if (backdropRef.current) {
      const opacity = Math.max(0, 1 - Math.max(0, currentY) / (sheetHeight * 1.2))
      backdropRef.current.style.opacity = `${opacity}`
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return

    // Pointer koordinatalarini va tezligini pointerup vaqtida yakuniy hisoblash
    const clientY = e.clientY ?? (e.nativeEvent as MouseEvent)?.clientY ?? state.lastY
    const clientX = e.clientX ?? (e.nativeEvent as MouseEvent)?.clientX ?? state.lastX
    const now = performance.now()

    state.samples = state.samples.filter((s) => now - s.time < 100)
    state.samples.push({ time: now, y: clientY })

    if (state.samples.length >= 2) {
      const first = state.samples[0]
      const last = state.samples[state.samples.length - 1]
      const dt = last.time - first.time
      if (dt > 0) {
        state.velocityY = (last.y - first.y) / dt // px/ms
      }
    }

    state.lastY = clientY
    state.lastX = clientX

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
    const thresholdDistance = Math.min(sheetHeight * 0.2, 75)

    // Senior-level gesture trigger:
    // 1) Distance threshold: 75px yoki sheetHeight*0.2 dan ortiq tortilganda
    // 2) Flick threshold: velocity > 0.35 px/ms bo'lib, kamida 15px pastga harakat bo'lganda (chaqqon va yengil)
    const shouldClose =
      isDismissAllowed('swipe') &&
      (finalY > thresholdDistance || (finalVelocity > 0.35 && finalY > 15))

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (shouldClose) {
      isClosingRef.current = true
      // Chaqqon chiqish vaqti: tez flick'da 140ms gacha tushadi, sekin drag'da 200ms
      const exitDuration = prefersReduced
        ? 0
        : Math.max(
            140,
            Math.min(
              210,
              Math.round(
                (sheetHeight - Math.max(0, finalY)) / Math.max(0.6, finalVelocity || 0.6)
              )
            )
          )

      if (sheet) {
        sheet.style.transition = prefersReduced
          ? 'none'
          : `transform ${exitDuration}ms cubic-bezier(.32, 0, .67, 0)`
        sheet.style.transform = `translate3d(0, ${sheetHeight + 80}px, 0)`
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced
          ? 'none'
          : `opacity ${Math.min(200, exitDuration)}ms ease-out`
        backdrop.style.opacity = '0'
      }

      if (exitDuration === 0) {
        commitClose()
      } else {
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = null
          commitClose()
        }, exitDuration)
      }
    } else {
      // Natural spring snap-back qaytishi (220ms silliq)
      const snapDuration = prefersReduced ? 0 : 220
      if (sheet) {
        sheet.style.transition = prefersReduced
          ? 'none'
          : `transform ${snapDuration}ms cubic-bezier(.2, .9, .3, 1)`
        sheet.style.transform = 'translate3d(0, 0px, 0)'
      }
      if (backdrop) {
        backdrop.style.transition = prefersReduced ? 'none' : 'opacity 180ms ease-out'
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
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    const snapDuration = prefersReduced ? 0 : 220
    if (sheet) {
      sheet.style.transition = prefersReduced
        ? 'none'
        : `transform ${snapDuration}ms cubic-bezier(.2, .9, .3, 1)`
      sheet.style.transform = 'translate3d(0, 0px, 0)'
    }
    if (backdrop) {
      backdrop.style.transition = prefersReduced ? 'none' : 'opacity 180ms ease-out'
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
