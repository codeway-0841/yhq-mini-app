import { memo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getAccentTheme } from '../config/themes'
import { cn } from '../lib/cn'

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return hex
}

export interface ModalMathGridProps {
  /** Markaziy/burchakdagi ambient glow rangi. 'theme' bo'lsa joriy tema rangi olinadi. 'none' bo'lsa glow bo'lmaydi */
  glowColor?: string
  /** Glow yoqilgan/o'chirilgan (default: false — sof toza kataklar) */
  glow?: boolean
  /** Kataklar balandligi (default: 460px) */
  height?: number | string
  /** Mask qayerda so'nishi (default: 95%) */
  maskEnd?: string
  className?: string
}

/**
 * ModalMathGrid — Kivvi'ning signatura "kataklar" (Apple / Taphey 28px math grid)
 * foni. Barcha modal va pastki sheet'lar uchun yagona ko'rinish va o'lcham kafolatlaydi.
 */
export const ModalMathGrid = memo(function ModalMathGrid({
  glowColor = 'none',
  glow = false,
  height = 460,
  maskEnd = '95%',
  className,
}: ModalMathGridProps) {
  const theme = useAppStore((s) => s.settings.theme)
  const accent = useAppStore((s) => s.accent)
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const activeGlowColor = glowColor === 'theme' ? getAccentTheme(accent).color : glowColor
  const gridLine = isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.035)'
  const glowAlpha1 = isDark ? 0.28 : 0.16
  const glowAlpha2 = isDark ? 0.07 : 0.04

  const hasGlow = glow && activeGlowColor !== 'none'
  const bgImage = hasGlow
    ? `radial-gradient(circle at 80% 10%, ${hexToRgba(activeGlowColor, glowAlpha1)} 0%, ${hexToRgba(activeGlowColor, glowAlpha2)} 45%, transparent 70%), linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`
    : `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`

  const bgSize = hasGlow ? 'auto, 28px 28px, 28px 28px' : '28px 28px, 28px 28px'

  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-x-0 top-0 pointer-events-none z-0 transition-opacity duration-300', className)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundImage: bgImage,
        backgroundSize: bgSize,
        WebkitMaskImage: `linear-gradient(to bottom, black 0%, black 60%, transparent ${maskEnd})`,
        maskImage: `linear-gradient(to bottom, black 0%, black 60%, transparent ${maskEnd})`,
      }}
    />
  )
})

export default ModalMathGrid
