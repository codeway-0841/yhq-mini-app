import { useState, useRef, useCallback, memo } from 'react'
import type { AchievementDef, AchievementTier } from '../config/achievements'
import { getBadgeUrl } from '../config/achievements'
import { cn } from '../lib/cn'

interface BadgeCard3DProps {
  achievement: AchievementDef
  unlocked?: boolean
  size?: 'sm' | 'md' | 'lg' | 'hero'
  interactive?: boolean
  showTierGlow?: boolean
  className?: string
  onClick?: () => void
}

const TIER_THEMES: Record<AchievementTier, {
  glowColor: string
  haloGradient: string
  badgeRing: string
  textGradient: string
  label: string
}> = {
  bronze: {
    glowColor: 'rgba(200, 90, 23, 0.45)',
    haloGradient: 'from-amber-700/30 via-orange-800/20 to-transparent',
    badgeRing: 'ring-amber-700/40 border-amber-600/30',
    textGradient: 'from-amber-300 to-amber-600',
    label: 'Bronza',
  },
  silver: {
    glowColor: 'rgba(148, 163, 184, 0.55)',
    haloGradient: 'from-slate-300/35 via-slate-500/20 to-transparent',
    badgeRing: 'ring-slate-300/50 border-slate-200/40',
    textGradient: 'from-slate-100 to-slate-400',
    label: 'Kumush',
  },
  gold: {
    glowColor: 'rgba(234, 179, 8, 0.65)',
    haloGradient: 'from-yellow-400/40 via-amber-500/25 to-transparent',
    badgeRing: 'ring-yellow-400/60 border-yellow-300/50',
    textGradient: 'from-yellow-200 via-amber-300 to-yellow-500',
    label: 'Oltin',
  },
  mythic: {
    glowColor: 'rgba(168, 85, 247, 0.75)',
    haloGradient: 'from-purple-500/45 via-indigo-600/30 to-transparent',
    badgeRing: 'ring-purple-400/70 border-fuchsia-400/60',
    textGradient: 'from-fuchsia-300 via-purple-300 to-indigo-400',
    label: 'Afsonaviy',
  },
}

const SIZES = {
  sm:   { card: 'size-14',  img: 'size-12', icon: 24, glow: 'inset-[-8px]' },
  md:   { card: 'size-24',  img: 'size-20', icon: 38, glow: 'inset-[-12px]' },
  lg:   { card: 'size-32',  img: 'size-28', icon: 54, glow: 'inset-[-18px]' },
  hero: { card: 'size-44 sm:size-52', img: 'size-36 sm:size-44', icon: 76, glow: 'inset-[-26px]' },
}

export const BadgeCard3D = memo(function BadgeCard3D({
  achievement,
  unlocked = true,
  size = 'md',
  interactive = true,
  showTierGlow = true,
  className,
  onClick,
}: BadgeCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotate, setRotate] = useState({ x: 0, y: 0 })
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const theme = TIER_THEMES[achievement.tier]
  const sizeConfig = SIZES[size]
  const badgeUrl = getBadgeUrl(achievement)
  const Icon = achievement.icon

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    const el = cardRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const tiltX = (0.5 - y) * 26 // max 13deg
    const tiltY = (x - 0.5) * 26

    setRotate({ x: tiltX, y: tiltY })
    setGlare({ x: x * 100, y: y * 100, opacity: 0.55 })
  }, [interactive])

  const handlePointerEnter = useCallback(() => {
    if (!interactive) return
    setIsHovered(true)
  }, [interactive])

  const handlePointerLeave = useCallback(() => {
    if (!interactive) return
    setIsHovered(false)
    setRotate({ x: 0, y: 0 })
    setGlare({ x: 50, y: 50, opacity: 0 })
  }, [interactive])

  return (
    <div
      ref={cardRef}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 900 }}
      className={cn(
        'relative inline-flex items-center justify-center select-none touch-none',
        interactive && 'cursor-pointer',
        className,
      )}
    >
      {/* 3D Transform Wrapper */}
      <div
        style={{
          transform: isHovered
            ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.06, 1.06, 1.06)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'relative flex items-center justify-center rounded-3xl',
          sizeConfig.card,
        )}
      >
        {/* Tier Halo / Aura Glow */}
        {showTierGlow && unlocked && (
          <div
            style={{
              background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
              filter: size === 'hero' ? 'blur(20px)' : 'blur(12px)',
            }}
            className={cn(
              'absolute rounded-full pointer-events-none transition-opacity duration-500',
              sizeConfig.glow,
              isHovered ? 'opacity-100 scale-110' : 'opacity-70',
            )}
          />
        )}

        {/* Specular Glare / Shimmer Glass Overlay */}
        <div
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.08) 35%, transparent 65%)`,
            opacity: glare.opacity,
            transition: 'opacity 0.25s ease',
          }}
          className="absolute inset-0 rounded-3xl pointer-events-none z-20"
        />

        {/* Shimmer sweep animation (avtomatik qatlam) */}
        {unlocked && (
          <div
            className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none z-10 opacity-30"
          >
            <div
              className="w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite_linear]"
            />
          </div>
        )}

        {/* Badge Main Body (Image or Icon) */}
        <div
          className={cn(
            'relative z-10 flex items-center justify-center transition-all duration-300',
            sizeConfig.img,
            !unlocked && 'grayscale opacity-40 brightness-75',
          )}
        >
          {badgeUrl ? (
            <img
              src={badgeUrl}
              alt=""
              loading="lazy"
              draggable={false}
              className={cn(
                'w-full h-full object-contain filter drop-shadow-[0_10px_16px_rgba(0,0,0,0.35)] pointer-events-none',
                unlocked && size === 'hero' && 'animate-[float_4s_ease-in-out_infinite]',
              )}
            />
          ) : Icon ? (
            <div
              style={{ color: unlocked ? achievement.color : 'var(--p-subtle)' }}
              className="grid place-items-center rounded-2xl bg-[rgb(var(--p-surface-rgb)/0.8)] p-3 shadow-inner"
            >
              <Icon size={sizeConfig.icon} strokeWidth={2} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})
