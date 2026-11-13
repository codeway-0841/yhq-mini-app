import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/cn'
import './brilliant-endstate.css'

export interface BrilliantEndstateShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Rive konteyner va copy bloklari (`BrilliantRiveContainer` + `BrilliantCopyContainer`) */
  children: ReactNode
  /** Asosiy pastki tugma matni */
  primaryLabel: string
  onPrimaryClick: () => void
  primaryVariant?: 'primary' | 'secondary'
  /** Ikkinchi (ixtiyoriy) tugma */
  secondaryLabel?: string
  onSecondaryClick?: () => void
  /** Viewport foni modifikatori (masalan iridescent yoki streak radial glow) */
  viewportClassName?: string
  /** Sticky pastki panel orqasidagi foni */
  footerBgClassName?: string
  /** Tugma ustida ko'rinadigan qo'shimcha kichik eslatma */
  footerCaption?: ReactNode
  /** Yuqori header (masalan Modal/Dars close tugmasi yoki preview tablar) */
  topSlot?: ReactNode
  /** Asosiy konteyner ustidan qo'shimcha dekoratsiya (masalan Confetti) */
  overlaySlot?: ReactNode
}

/**
 * Brilliant.org Endstate Layout (`750350` / `525997` 1:1):
 * - Outer Center: minH 100dvh, minW 100%, desktopda markazlashgan
 * - Inner Flex: h 100dvh, desktopda maxH 852px, safe-area-inset-top bilan
 * - Sticky Footer: overlap aniqlanganda elevate + boxShadow
 * - CTA: maxW 540px (lg: 353px)
 */
export function BrilliantEndstateShell({
  children,
  primaryLabel,
  onPrimaryClick,
  primaryVariant = 'primary',
  secondaryLabel,
  onSecondaryClick,
  viewportClassName,
  footerBgClassName,
  footerCaption,
  topSlot,
  overlaySlot,
  className,
  ...rest
}: BrilliantEndstateShellProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [overlapping, setOverlapping] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOverlapping(!entry.isIntersecting)
      },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      {...rest}
      className={cn(
        'relative flex min-h-[100dvh] w-full flex-col items-center justify-start lg:justify-center bg-pcanvas text-pfg overflow-x-hidden overflow-y-auto overscroll-contain',
        viewportClassName,
        className,
      )}
    >
      {overlaySlot}
      <div className="relative z-10 flex h-[100dvh] lg:max-h-[852px] min-h-fit w-full flex-col justify-between pt-[var(--safe-top,0px)]">
        {topSlot}
        {/* Kontent hududi (safe-area left/right saqlangan) */}
        <div className="flex-1 flex flex-col justify-start pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
          {children}
          <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden="true" />
        </div>

        {/* Sticky Pastki CTA Panel */}
        <footer
          className={cn(
            'sticky bottom-0 mt-auto flex w-full flex-col items-center gap-2.5 z-20',
            'pt-4 lg:pt-5 px-4 pb-[calc(max(env(safe-area-inset-bottom,0px),var(--tg-safe-bottom,0px))+16px)]',
            'transition-shadow duration-200',
            overlapping
              ? cn(footerBgClassName ?? 'bg-pcanvas', 'shadow-[0_0_25px_rgba(0,0,0,0.16)]')
              : 'shadow-none',
          )}
        >
          {footerCaption}
          <div className="w-full max-w-[540px] lg:max-w-[353px] flex flex-col gap-2.5">
            <Button
              type="button"
              variant={primaryVariant}
              size="lg"
              block
              onClick={onPrimaryClick}
            >
              {primaryLabel}
            </Button>
            {secondaryLabel && onSecondaryClick && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                block
                onClick={onSecondaryClick}
              >
                {secondaryLabel}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

/**
 * Brilliant RiveContainer (`0fr06-mqas8-j.js`):
 * maxW: 393px, h: 50dvh, maxH: 426px, minH: 200px, minW: 200px, mx: auto, p: 20px (5)
 */
export function BrilliantRiveContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-[50dvh] max-h-[426px] min-h-[200px] min-w-[200px] w-full max-w-[393px] flex-col justify-center p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Brilliant CopyContainer (`0fr06-mqas8-j.js`):
 * maxW: 393px, minH: 150px (md: 223px), mx: auto
 */
export function BrilliantCopyContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative mx-auto flex min-h-[150px] md:min-h-[223px] w-full max-w-[393px] flex-col items-center justify-start gap-4 px-4 text-center',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Brilliant LevelCheckScreenLayout (`2r5aem_zhr2z1.js`):
 * Tepada InContentNavbar (yopish X + progress bar), o'rtada sahna + 360px karta, pastda sticky tugma
 */
export function BrilliantLevelCheckShell({
  title,
  progressPercent = 100,
  onClose,
  children,
  primaryLabel,
  onPrimaryClick,
  secondaryLabel,
  onSecondaryClick,
}: {
  title: string
  progressPercent?: number
  onClose: () => void
  children: ReactNode
  primaryLabel: string
  onPrimaryClick: () => void
  secondaryLabel?: string
  onSecondaryClick?: () => void
}) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-pcanvas text-pfg pt-[var(--safe-top,0px)]">
      {/* InContentNavbar */}
      <header className="sticky top-[var(--safe-top,0px)] z-20 flex h-14 w-full items-center gap-3 bg-pcanvas px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-pmuted hover:bg-psurface hover:text-pfg transition-colors cursor-pointer"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-psurface">
            <div
              className="h-full rounded-full bg-[#29cc57] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
          <span className="text-[12px] font-bold text-pmuted shrink-0">{title}</span>
        </div>
      </header>

      {/* Asosiy markazlashtirilgan kontent */}
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-6 px-4 py-4">
        {children}
      </main>

      {/* Sticky pastki CTA */}
      <footer className="sticky bottom-0 mt-auto flex w-full flex-col items-center gap-2.5 bg-pcanvas px-4 pt-4 pb-[calc(max(env(safe-area-inset-bottom,0px),var(--tg-safe-bottom,0px))+16px)]">
        <div className="w-full max-w-[540px] lg:max-w-[353px] flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="lg" block onClick={onPrimaryClick}>
            {primaryLabel}
          </Button>
          {secondaryLabel && onSecondaryClick && (
            <Button type="button" variant="secondary" size="lg" block onClick={onSecondaryClick}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
