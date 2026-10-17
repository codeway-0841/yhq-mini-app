import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

// ── Section wrapper ─────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-psubtle">{title}</p>
      <div className="mx-5 overflow-hidden rounded-2xl bg-pcard divide-y divide-pline shadow-xs">
        {children}
      </div>
    </div>
  )
}

// ── List Item ───────────────────────────────────────────────────────────
// Rang intizomi (v3): barcha ikonkalar NEYTRAL va bir xil (text-pmuted, 20px)
export interface ItemProps {
  icon: React.ElementType
  iconColor?: string
  label: string
  right?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
}
export function Item({ icon: Icon, label, right, onPress, disabled }: ItemProps) {
  const Comp = onPress ? 'button' : 'div'
  return (
    <Comp
      type={onPress ? 'button' : undefined}
      onClick={disabled ? undefined : onPress}
      disabled={Comp === 'button' && disabled ? true : undefined}
      className={cn(
        // 50px — touch target (ModeRow bilan bir xil ritm)
        'flex min-h-[50px] w-full items-center gap-3.5 px-4 py-3.5 text-left',
        'transition-colors duration-150 ease-out',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && onPress && 'cursor-pointer hover:bg-psurface active:bg-psurface',
        onPress && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pprimary',
      )}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        className="shrink-0 text-pmuted"
      />
      <span className="flex-1 text-left text-[14.5px] font-medium text-pfg">{label}</span>
      {right !== undefined ? right : <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-psubtle" />}
    </Comp>
  )
}
