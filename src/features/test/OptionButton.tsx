import { Check, X } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import MathText from '../../shared/components/MathText'

export type Option = { id: string; text: string }

/**
 * Test javob varianti.
 *
 * v3: neon glow (`boxShadow: 0 0 20px`) va ✓/✗ matn belgilari olib tashlandi.
 * Holat 1px chegara + yumshoq semantik fon + lucide ikonka bilan beriladi;
 * "kalit" chipi (A/B/C/D) holat rangiga to'ladi.
 */
export default function OptionButton({ option, state, onSelect, answered, indexLabel }: {
  option: Option
  state: 'correct' | 'wrong' | 'pending' | 'default'
  onSelect: () => void
  answered: boolean
  indexLabel?: string
}) {
  const handleClick = () => {
    if (!answered) {
      playSound('click')
      haptics.impact('light')
      onSelect()
    }
  }

  const base = cn(
    'mb-2.5 w-full rounded-2xl p-3.5 text-left shadow-xs',
    'transition-[transform,background-color,box-shadow] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    'disabled:cursor-not-allowed',
  )
  let style = 'bg-pcard hover:bg-psurface active:scale-[0.99]'
  let chip  = 'bg-psurface text-psubtle'
  let icon  = null

  if (state === 'correct') {
    style = 'ring-2 ring-pprimary bg-pwash motion-safe:animate-correctPop'
    chip  = 'bg-pprimary text-ponprimary'
    icon  = <Check size={18} strokeWidth={2} className="flex-none text-pprimary" />
  } else if (state === 'wrong') {
    style = 'ring-2 ring-pdanger bg-[rgb(var(--p-danger-rgb)/0.10)]'
    chip  = 'bg-pdanger text-white'
    icon  = <X size={18} strokeWidth={2} className="flex-none text-pdanger" />
  } else if (state === 'pending') {
    // Server javobi kutilmoqda (yoki offline — keyin tasdiqlanadi)
    style = 'ring-2 ring-pblue bg-[rgb(var(--p-blue-rgb)/0.08)] motion-safe:animate-pulse'
    chip  = 'bg-[rgb(var(--p-blue-rgb)/0.16)] text-pblue'
  }

  return (
    <button
      type="button"
      className={cn(base, style)}
      onClick={handleClick}
      disabled={answered}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('flex size-8 flex-none items-center justify-center rounded-xl text-xs font-semibold shadow-2xs', chip)}>
            {indexLabel ?? option.id.toUpperCase()}
          </span>
          <MathText text={option.text} className="text-base text-pfg" />
        </div>
        {icon}
      </div>
    </button>
  )
}
