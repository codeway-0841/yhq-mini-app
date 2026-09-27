import { useState, useRef, useCallback, useEffect, memo } from 'react'
import type { AchievementDef } from '../config/achievements'
import { getBadgeUrl } from '../config/achievements'
import { useT } from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

interface MilestonePlaque3DProps {
  achievement: AchievementDef
  unlocked?: boolean
  progress?: { current: number; target: number; unlocked: boolean }
  className?: string
  interactive?: boolean
}

// Convert Hex color to RGBA
export function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  const num = parseInt(c, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const MilestonePlaque3D = memo(function MilestonePlaque3D({
  achievement,
  unlocked = true,
  progress,
  className,
  interactive = true,
}: MilestonePlaque3DProps) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  // 3D rotation angle: strictly horizontal (Y-axis only)
  const [rotateY, setRotateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const dragStartRef = useRef({ x: 0, startRotY: 0, moved: false })
  const animFrameRef = useRef<number | null>(null)
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null)

  const badgeUrl = getBadgeUrl(achievement)
  const title = tt(achievement.titleKey)
  const isCompleted = progress ? progress.unlocked : unlocked

  // Gentle subtle breathing float animation (strictly horizontal left-right sway)
  useEffect(() => {
    let t = 0
    const animate = () => {
      if (!isDragging && !hasInteracted) {
        t += 0.025
        setRotateY(Math.sin(t) * 8)
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [isDragging, hasInteracted])

  // Pointer drag gestures (mouse + touch) - strictly left/right, no vertical tilt
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    setIsDragging(true)
    setHasInteracted(true)
    dragStartRef.current = {
      x: e.clientX,
      startRotY: rotateY,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [interactive, rotateY])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    if (Math.abs(dx) > 3) {
      dragStartRef.current.moved = true
    }

    // Horizontal tilt only: clamped to max +-40 deg so back face never appears
    const nextY = Math.max(-40, Math.min(40, dragStartRef.current.startRotY + dx * 0.45))
    setRotateY(nextY)
  }, [isDragging])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    // Smoothly spring back to center (0deg)
    setRotateY(0)

    // After 1.5s idle, resume gentle swaying
    resetTimerRef.current = setTimeout(() => {
      setHasInteracted(false)
    }, 1500)
  }, [isDragging])

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center select-none touch-none py-6',
        interactive && 'cursor-grab active:cursor-grabbing',
        className,
      )}
      style={{ perspective: '900px', WebkitPerspective: '900px' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* ── PLAQUE & ORBIT ANCHOR (232x248) ── */}
      <div className="relative flex items-center justify-center" style={{ width: 232, height: 248 }}>
        {/* ── Soft Dotted Hexagon Orbit (Taphey Showcase Style - strictly concentric with 3D badge) ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
          <svg
            viewBox="0 0 280 300"
            className={cn(
              'w-[276px] h-[296px] pointer-events-none transition-opacity duration-300 shrink-0',
              isCompleted ? 'text-black/25 dark:text-white/25 opacity-90' : 'text-black/10 dark:text-white/10 opacity-40',
            )}
            aria-hidden="true"
          >
            <path
              d="M 158.8 38.4 L 235.2 84.5 Q 254.0 95.9 254.0 117.9 L 254.0 182.1 Q 254.0 204.1 235.2 215.5 L 158.8 261.6 Q 140.0 273.0 121.2 261.6 L 44.8 215.5 Q 26.0 204.1 26.0 182.1 L 26.0 117.9 Q 26.0 95.9 44.8 84.5 L 121.2 38.4 Q 140.0 27.0 158.8 38.4 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeDasharray="0.1 5.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* 3D ROOT OBJECT: Rotates strictly on Y-axis (left/right only, no up/down, no back face) */}
        <div
          className="w-full h-full relative"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotateY}deg)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
        {/* ── 3D PHYSICAL DEPTH EXTRUSION SLICES (Optimized to 3 lightweight slices for instant GPU rendering) ── */}
        {badgeUrl && [-4, 0, 3].map((z) => (
          <div
            key={z}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{
              transform: `translateZ(${z}px)`,
              filter: isCompleted
                ? 'brightness(0.82) contrast(1.05)'
                : 'grayscale(1) contrast(0.8) brightness(1.02)',
              opacity: isCompleted ? 0.95 : 0.22,
            }}
          >
            <img
              src={badgeUrl}
              alt=""
              loading="eager"
              decoding="async"
              draggable={false}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>
        ))}

        {/* ── FRONT FACE: THE VIBRANT BADGE ARTWORK OR SLEEK MONOCHROME SILVER at translateZ(7px) ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{
            transform: 'translateZ(7px)',
            filter: isCompleted
              ? 'drop-shadow(0 14px 22px rgba(0,0,0,0.14))'
              : 'drop-shadow(0 8px 18px rgba(0,0,0,0.06))',
          }}
        >
          {badgeUrl ? (
            <img
              src={badgeUrl}
              alt={title}
              loading="eager"
              decoding="async"
              draggable={false}
              className={cn(
                'w-full h-full object-contain pointer-events-none select-none transition-all duration-300',
                !isCompleted && 'grayscale opacity-40 contrast-80 brightness-100',
              )}
            />
          ) : (
            <div className="size-44 rounded-3xl bg-pprimary flex items-center justify-center text-white text-5xl font-black">
              🏆
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  )
})
