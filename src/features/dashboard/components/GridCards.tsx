import { memo } from 'react'
import React from 'react'

// ── Grid Card (rejimlar — eski vertikal) ───────────────────────────────────────
/* Rang intizomi (v2.1): default ikonlar NEYTRAL kulrang — faqat AI/Premium binafsha,
   badge'lar esa semantik (qizil = xato soni). Ranglar CSS-token (var(--p-*)),
   shuning uchun alpha color-mix bilan aralashadi, hex-konkatenatsiya bilan EMAS. */
export const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = 'var(--p-subtle)', onClick }: {
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
      className="btn-premium-secondary relative flex items-center gap-2.5 rounded-2xl px-3.5 py-3 w-full"
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--p-danger)' }}>
          {badge}
        </span>
      )}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${iconColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${iconColor} 18%, transparent)`,
          boxShadow: `0 0 16px color-mix(in srgb, ${iconColor} 20%, transparent)`,
        }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <span className="text-[12px] font-semibold text-pfg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Service Carousel Card — kvadrat, kichkina (auto-scroll uchun) ───────────────
export const ServiceCard = memo(function ServiceCard({ icon: Icon, label, onClick }: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex flex-col items-center justify-center gap-2.5 rounded-[16px] shrink-0 snap-start w-[100px] h-[100px] sm:w-[108px] sm:h-[108px] p-2.5 active:scale-[0.97] transition-transform"
      style={{
        background: 'var(--p-card)',
        border: '1px solid var(--p-line)',
        boxShadow: '0 6px 16px rgba(2,6,16,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <Icon size={26} strokeWidth={1.8} style={{ color: 'var(--p-subtle)' }} />
      <span className="text-[11px] font-medium text-pfg text-center leading-[1.25] line-clamp-2 min-h-[28px] flex items-center justify-center px-0.5">
        {label}
      </span>
    </button>
  )
})

// ── Asosiy grid kartasi (Testlar / Mavzular / AI Tutor ...) ────────────────
export const MockGridCard = memo(function MockGridCard({ icon: Icon, label, subtitle, iconColor = 'var(--p-subtle)', badge, comingSoon, onClick }: {
  icon: React.ElementType
  label: string
  subtitle: string
  iconColor?: string
  badge?: number | null
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}${comingSoon ? ' (tez orada)' : ''}`}
      className={`card-premium relative flex flex-col items-center justify-center text-center gap-2 p-2.5 sm:p-3.5 min-h-[96px] sm:min-h-[104px] active:scale-[0.97] transition-transform ${comingSoon ? 'opacity-70' : ''}`}
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--p-danger)' }}>
          {badge}
        </span>
      )}
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] sm:rounded-[14px] flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${iconColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${iconColor} 18%, transparent)`,
          boxShadow: `0 0 18px color-mix(in srgb, ${iconColor} 25%, transparent)`,
        }}>
        <Icon size={19} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <div className="text-center w-full min-w-0 px-0.5">
        <p className="text-[12px] sm:text-[13px] font-semibold text-pfg leading-tight truncate">{label}</p>
        <p className={`text-[10px] sm:text-[10.5px] font-medium mt-0.5 truncate ${comingSoon ? 'text-ppurple' : 'text-psubtle'}`}>{subtitle}</p>
      </div>
    </button>
  )
})
