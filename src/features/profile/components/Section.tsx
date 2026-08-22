import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

// ── Section wrapper ─────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-psubtle">{title}</p>
      <div className="mx-5 overflow-hidden rounded-container border border-pline bg-pcard divide-y divide-pline">
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
export function Item({ icon: Icon, iconColor = 'var(--p-subtle)', label, right, onPress, disabled }: ItemProps) {
  const Comp = onPress ? 'button' : 'div'
  return (
    <Comp
      type={onPress ? 'button' : undefined}
      onClick={disabled ? undefined : onPress}
      disabled={Comp === 'button' && disabled ? true : undefined}
      className={cn(
        // 52px — touch target (44px minimum + ro'yxat zichligi)
        'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left',
        'transition-colors duration-[120ms] ease-out',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && onPress && 'cursor-pointer hover:bg-psurface active:bg-psurface',
        onPress && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pprimary',
      )}
    >
      {/* v3: ikonka qutisi squircle (doira EMAS) — ui/Avatar va IconChip bilan bir ritm */}
      <div
        className="flex size-8 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{
          background: `color-mix(in srgb, ${iconColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${iconColor} 20%, transparent)`,
        }}
      >
        <Icon size={15} strokeWidth={1.75} style={{ color: iconColor }} />
      </div>
      <span className="flex-1 text-left text-[14px] text-pfg">{label}</span>
      {right !== undefined ? right : <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-psubtle" />}
    </Comp>
  )
}
