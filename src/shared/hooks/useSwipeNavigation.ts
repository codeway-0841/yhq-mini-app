import { useState, useRef, useCallback, useEffect } from 'react'
import { haptics } from '../../platform/haptics'

export interface UseSwipeNavigationOptions {
  /** Chapga surilganda (Swipe Left) chaqiriladigan callback (masalan, keyingi savol) */
  onSwipeLeft?: () => void
  /** O'ngga surilganda (Swipe Right) chaqiriladigan callback (masalan, oldingi savol) */
  onSwipeRight?: () => void
  /** Chapga surish mumkinmi (masalan, joriy savol oxirgisi emasmi) */
  canSwipeLeft?: boolean
  /** O'ngga surish mumkinmi (masalan, joriy savol birinchisi emasmi) */
  canSwipeRight?: boolean
  /** Swipe funksiyasi yoqilganmi */
  enabled?: boolean
  /** O'tish uchun minimal gorizontal masofa (px, default: 50) */
  threshold?: number
  /** Tezkor siltash (flick) uchun minimal tezlik (px/ms, default: 0.3) */
  velocityThreshold?: number
  /** Ekran chetidagi tizim gesture'lari bilan to'qnashmaslik uchun chekka zona (px, default: 24) */
  edgeGuardWidth?: number
}

interface TouchSample {
  time: number
  x: number
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  enabled = true,
  threshold = 50,
  velocityThreshold = 0.3,
  edgeGuardWidth = 24,
}: UseSwipeNavigationOptions = {}) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)

  const trackingRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const currentXRef = useRef(0)
  const currentYRef = useRef(0)
  const axisRef = useRef<'pending' | 'horizontal' | 'vertical'>('pending')
  const samplesRef = useRef<TouchSample[]>([])

  const optionsRef = useRef({
    onSwipeLeft,
    onSwipeRight,
    canSwipeLeft,
    canSwipeRight,
    enabled,
    threshold,
    velocityThreshold,
    edgeGuardWidth,
  })

  useEffect(() => {
    optionsRef.current = {
      onSwipeLeft,
      onSwipeRight,
      canSwipeLeft,
      canSwipeRight,
      enabled,
      threshold,
      velocityThreshold,
      edgeGuardWidth,
    }
  })

  const resetState = useCallback(() => {
    trackingRef.current = false
    axisRef.current = 'pending'
    samplesRef.current = []
    setDragOffset(0)
    setIsSwiping(false)
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const opts = optionsRef.current
    if (!opts.enabled) return

    // Faqat bitta barmoq bilan teginilganda (multi-touch zoom'ga xalaqit bermaslik)
    if (e.touches.length !== 1) return

    const target = e.target as HTMLElement | null
    if (!target) return

    // Matn kiritish maydonlari, chizish kanvasi yoki no-swipe elementlar ustida ishlamaslik
    if (target.closest('input, textarea, select, canvas, [data-no-swipe], [contenteditable]:not([contenteditable="false"])')) {
      return
    }

    const touch = e.touches[0]
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360

    // Ekran chetlaridan (iOS back swipe yoki TG swipe-to-close zonasi) boshlangan teginishlarni inobatga olmaslik
    if (touch.clientX < opts.edgeGuardWidth || touch.clientX > screenWidth - opts.edgeGuardWidth) {
      return
    }

    trackingRef.current = true
    startXRef.current = touch.clientX
    startYRef.current = touch.clientY
    currentXRef.current = touch.clientX
    currentYRef.current = touch.clientY
    axisRef.current = 'pending'
    samplesRef.current = [{ time: performance.now(), x: touch.clientX }]
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!trackingRef.current || e.touches.length !== 1) return

    const touch = e.touches[0]
    currentXRef.current = touch.clientX
    currentYRef.current = touch.clientY

    const deltaX = touch.clientX - startXRef.current
    const deltaY = touch.clientY - startYRef.current
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // O'qni (axis) aniqlash: vertikal scroll yoki gorizontal swipe
    if (axisRef.current === 'pending') {
      if (absY >= 10 && absY > absX) {
        // Foydalanuvchi vertikal scroll qilmoqda — swipe gesture bekor qilinadi
        axisRef.current = 'vertical'
        trackingRef.current = false
        resetState()
        return
      }

      if (absX >= 10 && absX > absY * 1.25) {
        // Aniq gorizontal harakat — swipe qulflanadi
        axisRef.current = 'horizontal'
        setIsSwiping(true)
      } else {
        return
      }
    }

    if (axisRef.current === 'horizontal') {
      const opts = optionsRef.current

      // Chegara qarshiligi (rubber-band resistance)
      let effectiveDelta = deltaX
      if (deltaX < 0 && !opts.canSwipeLeft) {
        effectiveDelta = deltaX * 0.18 // oxirgi savolda chapga tortganda
      } else if (deltaX > 0 && !opts.canSwipeRight) {
        effectiveDelta = deltaX * 0.18 // birinchi savolda o'ngga tortganda
      }

      // Max siljish chegarasi
      const clamped = Math.max(-140, Math.min(140, effectiveDelta))
      setDragOffset(clamped)

      // Rolling sample window (oxirgi 100ms tezlik hisobi uchun)
      const now = performance.now()
      samplesRef.current = samplesRef.current.filter((s) => now - s.time < 100)
      samplesRef.current.push({ time: now, x: touch.clientX })
    }
  }, [resetState])

  const onTouchEnd = useCallback(() => {
    if (!trackingRef.current) {
      resetState()
      return
    }

    const opts = optionsRef.current

    if (axisRef.current === 'horizontal') {
      const deltaX = currentXRef.current - startXRef.current
      const absDeltaX = Math.abs(deltaX)

      // Tezlik (velocity) hisobi
      let velocityX = 0
      const samples = samplesRef.current
      if (samples.length >= 2) {
        const first = samples[0]
        const last = samples[samples.length - 1]
        const dt = last.time - first.time
        if (dt > 0) {
          velocityX = (last.x - first.x) / dt // px/ms
        }
      }

      const isQuickFlick = Math.abs(velocityX) >= opts.velocityThreshold && absDeltaX >= 28
      const isDeepSwipe = absDeltaX >= opts.threshold

      if (isQuickFlick || isDeepSwipe) {
        if (deltaX < 0 && opts.canSwipeLeft) {
          // Chapga surish -> Keyingi savol
          haptics.impact('light')
          opts.onSwipeLeft?.()
        } else if (deltaX > 0 && opts.canSwipeRight) {
          // O'ngga surish -> Oldingi savol
          haptics.impact('light')
          opts.onSwipeRight?.()
        }
      }
    }

    resetState()
  }, [resetState])

  const onTouchCancel = useCallback(() => {
    resetState()
  }, [resetState])

  return {
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
    dragOffset,
    isSwiping,
  }
}
