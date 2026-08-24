import React, { memo } from 'react'
import { cn } from '../../../shared/lib/cn'

/* Rang intizomi (v3): default ikonlar NEYTRAL — kategoriya rangi FAQAT
   ma'lumotdan kelganda (fan/modul) ishlatiladi. Badge'lar semantik
   (qizil = xato soni). Glow tizimdan chiqarildi: ikonka qutisi sirt +
   hairline bilan ajraladi. */

// ── Icon chip — GridCard/ServiceCard/MockGridCard'ning umumiy ikonka qutisi.
// Bitta joyda: o'lcham/stroke/tint bir xil intizomga bo'ysunadi.
const CHIP_SCALE = {
  sm: { box: 'size-9',                     radius: 'rounded-[10px]', icon: 18 },
  md: { box: 'size-10 sm:size-11',         radius: 'rounded-[12px]', icon: 20 },
  lg: { box: 'size-11 sm:size-12',         radius: 'rounded-[14px]', icon: 22 },
} as const

function IconChip({ icon: Icon, color, size }: { icon: React.ElementType; color: string; size: keyof typeof CHIP_SCALE }) {
  const s = CHIP_SCALE[size]
  return (
    <div
      className={cn(s.box, s.radius, 'flex flex-shrink-0 items-center justify-center')}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <Icon size={s.icon} strokeWidth={1.75} style={{ color }} />
    </div>
  )
}

function BadgeDot({ count }: { count: number }) {
  return (
    <span
      className="absolute -right-1 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums text-white"
      style={{ background: 'var(--p-danger)' }}
    >
      {count}
    </span>
  )
}

/** Interaktiv karta uchun umumiy holat klasslari (hover/active/focus). */
const cardInteractive = cn(
  'transition-[transform,border-color] duration-[120ms] ease-out',
  'hover:border-plineStrong active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
)

// ── Grid Card (rejimlar — gorizontal) ──────────────────────────────────────
export const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = 'var(--p-primary)', onClick }: {
  icon: React.ElementType
  label: string
  badge?: number | null
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative flex w-full items-center gap-2.5 rounded-container border border-pline bg-pcard px-3.5 py-3',
        cardInteractive,
      )}
    >
      {badge != null && badge > 0 && <BadgeDot count={badge} />}
      <IconChip icon={Icon} color={iconColor} size="sm" />
      <span className="text-left text-[12px] font-semibold leading-tight text-pfg">{label}</span>
    </button>
  )
})

// ── Service Carousel Card — kvadrat (auto-scroll karusel uchun) ────────────
export const ServiceCard = memo(function ServiceCard({ icon: Icon, label, iconColor = 'var(--p-primary)', onClick }: {
  icon: React.ElementType
  label: string
  iconColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative flex size-[100px] shrink-0 snap-start flex-col items-center justify-center gap-2.5 p-2.5 sm:size-[108px]',
        'rounded-container border border-pline bg-pcard',
        cardInteractive,
      )}
    >
      <IconChip icon={Icon} color={iconColor} size="lg" />
      <span className="line-clamp-2 flex min-h-[28px] items-center justify-center px-0.5 text-center text-[11px] font-medium leading-[1.25] text-pfg">
        {label}
      </span>
    </button>
  )
})

// ── Asosiy grid kartasi (Testlar / Mavzular / AI Tutor ...) ────────────────
export const MockGridCard = memo(function MockGridCard({ icon: Icon, label, subtitle, iconColor = 'var(--p-primary)', badge, comingSoon, onClick }: {
  icon: React.ElementType
  label: string
  subtitle?: string
  iconColor?: string
  badge?: number | null
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}${comingSoon ? ' (tez orada)' : ''}`}
      className={cn(
        'relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-container border border-pline bg-pcard p-2.5 text-center sm:min-h-[96px] sm:p-3.5',
        cardInteractive,
        comingSoon && 'opacity-70',
      )}
    >
      {badge != null && badge > 0 && <BadgeDot count={badge} />}
      <IconChip icon={Icon} color={iconColor} size="md" />
      <div className="w-full min-w-0 px-0.5 text-center">
        <p className="truncate text-[12px] font-semibold leading-tight text-pfg sm:text-[13px]">{label}</p>
        {subtitle && (
          <p className={cn('mt-0.5 truncate text-[10px] font-medium sm:text-[10.5px]', comingSoon ? 'text-ppurple' : 'text-psubtle')}>
            {subtitle}
          </p>
        )}
      </div>
    </button>
  )
})
