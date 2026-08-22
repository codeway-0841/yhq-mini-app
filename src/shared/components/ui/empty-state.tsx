import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * KIWI EmptyState — maskot YO'Q. Ikonka grid'idan qurilgan geometrik line-art:
 * lucide ikonkasi katta o'lchamda, aksent rangida, past opacity bilan.
 *
 * Har bo'sh holat uchta narsani beradi: NIMA yo'q, NEGA yo'q, va NIMA qilish
 * kerak. Faqat "Ma'lumot yo'q" — yetarli emas.
 */
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  /** Nega bo'sh ekanini tushuntiradi — ayblov emas, yo'nalish */
  description?: string
  /** Bitta asosiy amal (ko'p tugma qo'ymang) */
  action?: React.ReactNode
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-7 text-center', className)}>
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="mb-3.5 size-14 text-pprimary opacity-55"
      />
      <h4 className="font-display text-[17px] font-semibold text-pfg">{title}</h4>
      {description && (
        <p className="mx-auto mt-1.5 max-w-[34ch] text-sm text-pmuted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
