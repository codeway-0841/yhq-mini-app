import React from 'react'
import { ChevronRight } from 'lucide-react'

// ── Section wrapper ─────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-muted uppercase tracking-[0.12em] px-4 mb-1.5">{title}</p>
      <div className="card-neon mx-4 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ── List Item ───────────────────────────────────────────────────────────
// Rang intizomi: ikonkalar NEYTRAL, faqat semantik ma'nolilar rangli (danger=qizil)
export interface ItemProps {
  icon: React.ElementType
  iconColor?: string
  label: string
  right?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
}
export function Item({ icon: Icon, iconColor = '#94a3b8', label, right, onPress, disabled }: ItemProps) {
  const Comp = onPress ? 'button' : 'div'
  return (
    <Comp
      type={onPress ? 'button' : undefined}
      onClick={disabled ? undefined : onPress}
      className={`flex items-center gap-3 w-full px-4 py-3.5 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : onPress ? 'active:bg-elevated cursor-pointer' : ''
      }`}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}1A`, border: `1px solid ${iconColor}2E` }}>
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <span className="flex-1 text-[14px] text-left text-fg">{label}</span>
      {right !== undefined ? right : <ChevronRight size={16} className="text-lineStrong" />}
    </Comp>
  )
}
