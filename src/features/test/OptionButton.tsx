import { Check, X } from 'lucide-react'
import { cn } from '../../shared/lib/cn'

export type Option = { id: string; text: string }

/**
 * Test javob varianti.
 *
 * v3: neon glow (`boxShadow: 0 0 20px`) va ✓/✗ matn belgilari olib tashlandi.
 * Holat 1px chegara + yumshoq semantik fon + lucide ikonka bilan beriladi;
 * "kalit" chipi (A/B/C/D) holat rangiga to'ladi.
 */
export default function OptionButton({ option, state, onSelect, answered, fontSize }: {
  option: Option
  state: 'correct' | 'wrong' | 'pending' | 'default'
  onSelect: () => void
  answered: boolean
  fontSize: string
}) {
  const base = cn(
    'mb-2.5 w-full rounded-container border p-3 text-left',
    'transition-[transform,border-color,background-color] duration-[120ms] ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    'disabled:cursor-not-allowed',
  )
  let style = 'border-pline bg-pcard hover:border-plineStrong active:scale-[0.99]'
  let chip  = 'border-plineStrong bg-psurface text-psubtle'
  let icon  = null

  if (state === 'correct') {
    style = 'border-pprimary bg-pwash motion-safe:animate-correctPop'
    chip  = 'border-pprimary bg-pprimary text-ponprimary'
    icon  = <Check size={18} strokeWidth={2} className="flex-none text-pprimary" />
  } else if (state === 'wrong') {
    style = 'border-pdanger bg-[rgb(var(--p-danger-rgb)/0.10)]'
    chip  = 'border-pdanger bg-pdanger text-white'
    icon  = <X size={18} strokeWidth={2} className="flex-none text-pdanger" />
  } else if (state === 'pending') {
    // Server javobi kutilmoqda (yoki offline — keyin tasdiqlanadi)
    style = 'border-pblue bg-[rgb(var(--p-blue-rgb)/0.08)] motion-safe:animate-pulse'
    chip  = 'border-pblue bg-[rgb(var(--p-blue-rgb)/0.16)] text-pblue'
  }

  const fontClass =
    fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <button
      type="button"
      className={cn(base, style)}
      onClick={onSelect}
      disabled={answered}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('flex size-8 flex-none items-center justify-center rounded-control border text-xs font-semibold', chip)}>
            {option.id}
          </span>
          <span className={cn(fontClass, 'text-pfg')}>{option.text}</span>
        </div>
        {icon}
      </div>
    </button>
  )
}
