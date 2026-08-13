import { memo } from 'react'
import React from 'react'

// ── Grid Card (rejimlar) ────────────────────────────────────────────────────
/* Rang intizomi (v2.1): default ikonlar NEYTRAL kulrang — faqat AI/Premium binafsha,
   badge'lar esa semantik (qizil = xato soni). */
export const GridCard = memo(function GridCard({ icon: Icon, label, badge, iconColor = '#94a3b8', onClick }: {
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
        style={{ backgroundColor: iconColor + '1A', border: `1px solid ${iconColor}2E`, boxShadow: `0 0 16px ${iconColor}33` }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: iconColor }} />
      </div>
      <span className="text-[12px] font-semibold text-pfg text-left leading-tight">{label}</span>
    </button>
  )
})

// ── Asosiy grid kartasi (Testlar / Mavzular / AI Tutor ...) ────────────────
export const MockGridCard = memo(function MockGridCard({ icon: Icon, label, subtitle, iconColor = '#94a3b8', badge, comingSoon, onClick }: {
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
      className={`card-premium relative flex flex-col items-center justify-center text-center gap-2.5 p-3.5 min-h-[104px] active:scale-[0.97] transition-transform ${comingSoon ? 'opacity-70' : ''}`}
    >
      {badge != null && (
        <span className="absolute -top-2 -right-1 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--p-danger)' }}>
          {badge}
        </span>
      )}
      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor + '1A', border: `1px solid ${iconColor}2E`, boxShadow: `0 0 18px ${iconColor}40` }}>
        <Icon size={20} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-pfg leading-tight">{label}</p>
        <p className={`text-[10.5px] font-medium mt-0.5 ${comingSoon ? 'text-ppurple' : 'text-psubtle'}`}>{subtitle}</p>
      </div>
    </button>
  )
})
