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
const OPTION_SOUND_MAP: Record<string, Parameters<typeof playSound>[0]> = {
  A: 'assessment-click-option-1',
  '1': 'assessment-click-option-1',
  B: 'assessment-click-option-2',
  '2': 'assessment-click-option-2',
  C: 'assessment-click-option-3',
  '3': 'assessment-click-option-3',
  D: 'assessment-click-option-4',
  '4': 'assessment-click-option-4',
}

export default function OptionButton({ option, state, onSelect, answered, indexLabel, variant = 'classic', phase2 = false, selected = false }: {
  option: Option
  state: 'correct' | 'wrong' | 'pending' | 'default'
  onSelect: () => void
  answered: boolean
  indexLabel?: string
  variant?: 'classic' | 'brilliant'
  phase2?: boolean
  selected?: boolean
}) {
  const handleClick = () => {
    if (!answered) {
      const sound = (indexLabel && OPTION_SOUND_MAP[indexLabel.trim().toUpperCase()]) || 'lightweight-choice'
      playSound(sound)
      haptics.impact('light')
      onSelect()
    }
  }

  const isBrilliant = variant === 'brilliant'
  const base = cn(
    isBrilliant
      ? 'mb-3 w-full rounded-2xl px-4 py-3.5 text-left transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out'
      : 'mb-2.5 w-full rounded-2xl p-3.5 text-left shadow-xs transition-[transform,background-color,box-shadow] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas',
    isBrilliant ? 'disabled:cursor-default' : 'disabled:cursor-not-allowed',
  )
  let style = isBrilliant
    ? answered
      ? 'bg-pcard opacity-55 shadow-none'
      : selected
        ? 'border-2 border-pprimary bg-[rgb(var(--p-primary-rgb)/0.11)] shadow-[0_2px_0_0_var(--p-primary)] active:translate-y-[1px] active:shadow-none'
        : 'bg-pcard shadow-[0_2px_0_0_rgb(0_0_0/0.06)] dark:shadow-[0_2px_0_0_rgb(0_0_0/0.35)] hover:bg-psurface active:translate-y-[1px] active:shadow-none'
    : 'bg-pcard hover:bg-psurface active:scale-[0.99]'
  let chip  = 'bg-psurface text-psubtle'
  let icon  = null

  if (state === 'correct') {
    style = isBrilliant
      ? 'border-2 border-[#21c65b] bg-[rgb(var(--p-success-rgb)/0.14)] shadow-none motion-safe:animate-correctPop'
      : 'ring-2 ring-pprimary bg-pwash motion-safe:animate-correctPop'
    chip  = isBrilliant ? 'bg-[#21c65b] text-white' : 'bg-pprimary text-ponprimary'
    icon  = <Check size={18} strokeWidth={2.4} className={cn('flex-none', isBrilliant ? 'text-[#21c65b]' : 'text-pprimary')} />
  } else if (state === 'wrong') {
    style = isBrilliant
      ? phase2
        ? 'border-2 border-[rgb(var(--p-danger-rgb)/0.6)] bg-psurface shadow-none'
        : 'border-2 border-[#eab308] bg-[rgb(234_179_8/0.14)] dark:bg-[rgb(234_179_8/0.18)] shadow-none'
      : 'ring-2 ring-pdanger bg-[rgb(var(--p-danger-rgb)/0.10)]'
    chip  = isBrilliant ? (phase2 ? 'bg-[rgb(var(--p-danger-rgb)/0.85)] text-white' : 'bg-[#eab308] text-[#2b1d00]') : 'bg-pdanger text-white'
    icon  = <X size={18} strokeWidth={2.2} className={cn('flex-none', isBrilliant ? 'text-pwarning' : 'text-pdanger')} />
  } else if (state === 'pending') {
    // Server javobi kutilmoqda (yoki offline — keyin tasdiqlanadi)
    style = isBrilliant
      ? 'border-2 border-pblue bg-[rgb(var(--p-blue-rgb)/0.08)] shadow-none motion-safe:animate-pulse'
      : 'ring-2 ring-pblue bg-[rgb(var(--p-blue-rgb)/0.08)] shadow-none motion-safe:animate-pulse'
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
        <div className="flex min-w-0 items-center gap-3.5">
          {isBrilliant ? (
            <span
              className={cn(
                'flex size-6 flex-none items-center justify-center rounded-full text-[11.5px] font-bold transition-colors',
                state === 'correct'
                  ? 'bg-[#21c65b] text-white'
                  : state === 'wrong'
                    ? phase2
                      ? 'bg-[rgb(var(--p-danger-rgb)/0.85)] text-white'
                      : 'bg-[#eab308] text-[#2b1d00]'
                    : state === 'pending'
                      ? 'border-[1.5px] border-pblue bg-[rgb(var(--p-blue-rgb)/0.16)] text-pblue'
                      : selected
                        ? 'bg-pprimary text-ponprimary'
                        : 'border-[1.5px] border-plineStrong text-pmuted',
              )}
            >
              {state === 'correct'
                ? <Check size={13} strokeWidth={3} />
                : state === 'wrong'
                  ? <X size={13} strokeWidth={3} />
                  : (indexLabel ?? option.id.toUpperCase())}
            </span>
          ) : (
            <span className={cn('flex size-8 flex-none items-center justify-center rounded-xl text-xs font-semibold shadow-2xs', chip)}>
              {indexLabel ?? option.id.toUpperCase()}
            </span>
          )}
          <MathText text={option.text} className={cn('text-[15.5px] leading-snug text-pfg', isBrilliant ? 'font-semibold' : 'font-medium')} />
        </div>
        {!isBrilliant && icon}
      </div>
    </button>
  )
}
