import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn } from 'lucide-react'
import { haptics } from '../../platform/haptics'
import { cn } from '../lib/cn'

export interface PinchableImageProps {
  src: string
  alt?: string
  className?: string
  containerClassName?: string
  zoomLabel?: string
  onOpenModal?: () => void
}

export default function PinchableImage({
  src,
  alt = 'Savol rasmi',
  className,
  containerClassName,
  zoomLabel,
  onOpenModal,
}: PinchableImageProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const lastTouchDistRef = useRef<number | null>(null)
  const startMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const startPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const startScaleRef = useRef(1)
  const lastTapTimeRef = useRef(0)
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const singleTapTimerRef = useRef<number | null>(null)

  // Reset when src changes
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsInteracting(false)
  }, [src])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setIsInteracting(false)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Ikki barmoq bilan pinch-to-zoom boshlanishi
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current)
        singleTapTimerRef.current = null
      }
      setIsInteracting(true)
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      lastTouchDistRef.current = dist
      startScaleRef.current = scale
      startMidpointRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
      startPositionRef.current = { ...position }
    } else if (e.touches.length === 1 && scale > 1) {
      // Kattalashtirilgan holatda bir barmoq bilan surish (pan)
      setIsInteracting(true)
      const t = e.touches[0]
      startMidpointRef.current = { x: t.clientX, y: t.clientY }
      startPositionRef.current = { ...position }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      const ratio = dist / (lastTouchDistRef.current || 1)
      const nextScale = Math.min(Math.max(startScaleRef.current * ratio, 1), 4.5)
      setScale(nextScale)

      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2
      const deltaX = midX - startMidpointRef.current.x
      const deltaY = midY - startMidpointRef.current.y

      setPosition({
        x: startPositionRef.current.x + deltaX * 0.8,
        y: startPositionRef.current.y + deltaY * 0.8,
      })
    } else if (e.touches.length === 1 && scale > 1) {
      const t = e.touches[0]
      const deltaX = t.clientX - startMidpointRef.current.x
      const deltaY = t.clientY - startMidpointRef.current.y
      const maxOffset = 180 * (scale - 1)
      setPosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, startPositionRef.current.x + deltaX)),
        y: Math.max(-maxOffset, Math.min(maxOffset, startPositionRef.current.y + deltaY)),
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      lastTouchDistRef.current = null

      // Agar ikki barmoq bilan pinch qilingan bo'lsa, barmoq ko'tarilganda o'z joyiga silliq qaytarish
      if (scale !== 1 && startScaleRef.current === 1) {
        haptics.impact('light')
        resetZoom()
      } else {
        setIsInteracting(false)
      }
    } else if (e.touches.length === 1) {
      lastTouchDistRef.current = null
    }
  }

  // Double-tap orqali 2.2x zoom yoki 1x ga qaytish
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = performance.now()
    const clientX = 'clientX' in e ? e.clientX : (e as React.TouchEvent).changedTouches?.[0]?.clientX ?? 0
    const clientY = 'clientY' in e ? e.clientY : (e as React.TouchEvent).changedTouches?.[0]?.clientY ?? 0

    const timeDiff = now - lastTapTimeRef.current
    const distDiff = Math.hypot(clientX - lastTapPosRef.current.x, clientY - lastTapPosRef.current.y)

    lastTapTimeRef.current = now
    lastTapPosRef.current = { x: clientX, y: clientY }

    if (timeDiff < 300 && distDiff < 30) {
      // Double tap aniqlandi!
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current)
        singleTapTimerRef.current = null
      }
      if (scale > 1) {
        haptics.impact('light')
        resetZoom()
      } else {
        haptics.impact('medium')
        setScale(2.2)
        setPosition({ x: 0, y: 0 })
      }
    } else {
      // Single tap — biroz kutib modalni ochish (double tap emasligiga ishonch hosil qilish)
      if (scale === 1 && onOpenModal) {
        if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current)
        singleTapTimerRef.current = window.setTimeout(() => {
          singleTapTimerRef.current = null
          onOpenModal()
        }, 300)
      }
    }
  }

  const isZoomed = scale > 1.02

  return (
    <>
      {/* Zoom paytidagi yarim shaffof qoraytirilgan fon */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs transition-opacity duration-200"
          onClick={resetZoom}
          aria-hidden="true"
        />
      )}

      <div
        ref={containerRef}
        data-no-swipe="true"
        className={cn(
          'relative flex items-center justify-center overflow-visible select-none rounded-2xl bg-psurface shadow-xs cursor-zoom-in group',
          isZoomed ? 'z-50' : 'z-10',
          containerClassName,
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetZoom}
        onClick={handleTap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (scale > 1) resetZoom()
            else onOpenModal?.()
          }
        }}
        aria-label={alt}
      >
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isInteracting ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
            transformOrigin: 'center center',
          }}
          className="flex items-center justify-center w-full h-full"
        >
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            draggable={false}
            className={cn(
              'block h-auto w-auto max-w-full max-h-[min(30svh,240px)] lg:max-h-[min(40svh,320px)] shrink-0 object-contain pointer-events-none select-none',
              className,
            )}
          />
        </div>

        {/* Kattalashtirish indikatori chipi (faqat oddiy holatda ko'rinadi) */}
        {!isZoomed && (
          <div className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-xs shadow-xs transition-colors group-hover:bg-black/85">
            <ZoomIn size={11} strokeWidth={1.75} />
            <span>{zoomLabel ?? 'Kattalashtirish'}</span>
          </div>
        )}
      </div>
    </>
  )
}
