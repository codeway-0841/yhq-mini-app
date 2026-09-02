import { useState, useRef, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react'
import { haptics } from '../../platform/haptics'
import DialogOverlay from './DialogOverlay'

interface ImageZoomModalProps {
  src: string
  alt?: string
  onClose: () => void
}

export default function ImageZoomModal({ src, alt = 'Rasm', onClose }: ImageZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTouchDistRef = useRef<number | null>(null)

  // Reset transform when image changes
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [src])

  // Escape — DialogOverlay (nested stack) boshqaradi; qo'shimcha listener KERAK EMAS

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const next = Math.min(prev + 0.5, 4)
      haptics.impact('light')
      return next
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1)
      if (next === 1) setPosition({ x: 0, y: 0 })
      haptics.impact('light')
      return next
    })
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    haptics.impact('light')
  }, [])

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setScale((prev) => {
      if (prev > 1) {
        setPosition({ x: 0, y: 0 })
        haptics.impact('light')
        return 1
      } else {
        haptics.impact('medium')
        return 2.5
      }
    })
  }, [])

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers (pan & pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastTouchDistRef.current = dist
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      })
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const diff = dist - lastTouchDistRef.current
      if (Math.abs(diff) > 5) {
        setScale((prev) => Math.min(Math.max(prev + diff * 0.01, 1), 4))
        lastTouchDistRef.current = dist
      }
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    lastTouchDistRef.current = null
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 })
    }
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4))
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1)
        if (next === 1) setPosition({ x: 0, y: 0 })
        return next
      })
    }
  }

  return (
    <DialogOverlay
      onClose={onClose}
      position="center"
      zIndex={60}
      labelId="image-zoom-title"
      className="select-none touch-none animate-fadeIn !p-0"
      backdropClassName="bg-black/95 backdrop-blur-md"
    >
      {/* safe-top: yuqori bar (✕ yopish) TG floating tugmalar/status bar ostida
          qolmasligi uchun (fixed overlay — body padding tegmaydi).
          pb calc: pastki control bar gesture bar/home indicator ustida. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-between p-4 safe-top pb-[calc(1rem+var(--safe-bottom,0px))]"
        onClick={onClose}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
      {/* Top Bar: Title & Close Button */}
      <span id="image-zoom-title" className="sr-only">{alt}</span>
      <div className="w-full flex items-center justify-between text-white z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-xs">
            🔍 {Math.round(scale * 100)}%
          </span>
          <span className="text-[11px] text-white/60 hidden sm:inline">
            (2 marta bosib kattalashtiring yoki suring)
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-all shadow-lg"
          aria-label="Yopish"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleTap}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }}
          className="max-w-full max-h-full object-contain pointer-events-auto transition-transform will-change-transform rounded-xl shadow-2xl"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl z-10 mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={zoomOut}
          disabled={scale <= 1}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
          title="Kichraytirish"
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={resetZoom}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold active:scale-90 transition-all flex items-center gap-1.5"
          title="Asliga qaytarish"
        >
          <RotateCcw size={14} />
          <span>100%</span>
        </button>

        <button
          onClick={zoomIn}
          disabled={scale >= 4}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
          title="Kattalashtirish"
        >
          <ZoomIn size={18} />
        </button>
      </div>
      </div>
    </DialogOverlay>
  )
}
