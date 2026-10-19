import { useState } from 'react'
import { Check, Eraser, Volume2 } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { useT } from '../../shared/i18n'
import { useAppStore } from '../../shared/store/useAppStore'
import type { DarslikAnswerValue, DarslikPublicExercise } from '../../../shared/darslik-mastery'

interface LessonExerciseProps {
  exercise: DarslikPublicExercise
  value: DarslikAnswerValue | undefined
  onChange: (value: DarslikAnswerValue) => void
  disabled?: boolean
  onSpeak?: (text: string) => void
  speaking?: boolean
  /** Natija ekranida javobni ko'rsatish uchun (o'zgartirish o'chiriladi). */
  readOnly?: boolean
}

function numberLabel(index: number): string {
  return String(index + 1)
}

function usedRightValues(value: DarslikAnswerValue | undefined): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(value.filter(Boolean))
}

export default function LessonExercise({
  exercise,
  value,
  onChange,
  disabled = false,
  onSpeak,
  speaking = false,
  readOnly = false,
}: LessonExerciseProps) {
  const lang = useAppStore((state) => state.settings.language)
  const tt = useT(lang)
  const [activeLeft, setActiveLeft] = useState<number | null>(null)
  const locked = disabled || readOnly

  if (exercise.kind === 'mcq' || exercise.kind === 'listening') {
    const selected = typeof value === 'string' ? value : ''
    return (
      <div className="flex flex-col gap-2">
        {exercise.kind === 'listening' && (
          <div className="mb-1 flex items-center gap-3 rounded-2xl bg-psurface px-3.5 py-3">
            <button
              type="button"
              disabled={locked}
              onClick={() => onSpeak?.(exercise.audioText)}
              aria-label={tt('rusDarslikLessonListen')}
              className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-pprimary text-ponprimary shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Volume2 size={22} strokeWidth={2.2} className={cn(speaking && 'animate-pulse')} />
            </button>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-pfg">{tt('rusDarslikLessonListen')}</p>
              <p className="text-[11.5px] leading-snug text-pmuted">{tt('rusDarslikLessonReplay')}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2" role="group" aria-label={exercise.prompt}>
          {exercise.options.map((option, optionIndex) => {
            const isSelected = selected === String(optionIndex)
            return (
              <button
                key={exercise.id + ':' + optionIndex}
                type="button"
                disabled={locked}
                onClick={() => onChange(String(optionIndex))}
                aria-pressed={isSelected}
                aria-label={option}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left text-[14px] leading-snug transition-all active:scale-[0.99] disabled:cursor-default',
                  isSelected
                    ? 'border-pprimary bg-[rgb(var(--p-primary-rgb)/0.10)] text-pfg'
                    : 'border-pline bg-pcard text-pfg',
                )}
              >
                <span className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                  isSelected ? 'bg-pprimary text-ponprimary' : 'bg-psurface text-pmuted',
                )}>
                  {numberLabel(optionIndex)}
                </span>
                <span className="min-w-0 flex-1 break-words">{option}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (exercise.kind === 'input') {
    const text = typeof value === 'string' ? value : ''
    return (
      <div>
        <input
          type="text"
          disabled={locked}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            try { event.currentTarget.scrollIntoView?.({ block: 'center', behavior: 'smooth' }) } catch { /* eski webview */ }
          }}
          placeholder={tt('rusDarslikCheckInputPlaceholder')}
          aria-label={exercise.prompt}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          className="w-full rounded-2xl border border-pline bg-pcanvas px-4 py-3.5 text-[16px] text-pfg outline-none transition-colors placeholder:text-psubtle focus:border-pprimary disabled:opacity-70"
        />
      </div>
    )
  }

  if (exercise.kind === 'word_bank') {
    const chosen = Array.isArray(value) ? value : []
    const used = new Map<string, number>()
    for (const token of chosen) used.set(token, (used.get(token) ?? 0) + 1)
    return (
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            'flex min-h-[64px] flex-wrap content-start gap-2 rounded-2xl border border-dashed px-3 py-3',
            chosen.length ? 'border-[rgb(var(--p-primary-rgb)/0.4)] bg-[rgb(var(--p-primary-rgb)/0.05)]' : 'border-pline bg-[rgb(var(--p-surface-rgb)/0.5)]',
          )}
          aria-label={tt('rusDarslikLessonWordBankHint')}
        >
          {chosen.length === 0 && (
            <span className="self-center text-[12.5px] text-psubtle">{tt('rusDarslikLessonWordBankHint')}</span>
          )}
          {chosen.map((token, index) => (
            <button
              key={token + ':' + index}
              type="button"
              disabled={locked}
              onClick={() => onChange(chosen.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={tt('rusDarslikLessonRemoveToken').replace('{token}', token)}
              className="flex items-center gap-1.5 rounded-xl bg-pprimary px-2.5 py-1.5 text-[13.5px] font-medium text-ponprimary active:scale-95 disabled:opacity-70"
            >
              <Check size={12} strokeWidth={3} />
              {token}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {exercise.tokens.map((token, index) => {
            const limit = exercise.tokens.filter(item => item === token).length
            const isUsed = (used.get(token) ?? 0) >= limit
            return (
              <button
                key={token + ':' + index}
                type="button"
                disabled={locked || isUsed}
                onClick={() => onChange([...chosen, token])}
                className={cn(
                  'rounded-xl border px-3 py-2 text-[14px] font-medium transition-all active:scale-95',
                  isUsed
                    ? 'border-transparent bg-psurface text-psubtle opacity-45'
                    : 'border-pline bg-pcard text-pfg shadow-2xs',
                )}
              >
                {token}
              </button>
            )
          })}
        </div>
        {chosen.length > 0 && !locked && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-[12px] font-semibold text-pmuted active:opacity-70"
          >
            <Eraser size={13} strokeWidth={2.5} />
            {tt('rusDarslikLessonClear')}
          </button>
        )}
      </div>
    )
  }

  const selection = Array.isArray(value) ? value : []
  const chosenRights = usedRightValues(value)
  const assignRight = (leftIndex: number, right: string) => {
    const next = exercise.left.map((_, index) => selection[index] ?? '')
    const previous = next.findIndex((item, index) => item === right && index !== leftIndex)
    if (previous >= 0) next[previous] = ''
    next[leftIndex] = right
    onChange(next)
    const nextUnmatched = next.findIndex(item => !item)
    setActiveLeft(nextUnmatched >= 0 ? nextUnmatched : null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] leading-snug text-pmuted">{tt('rusDarslikLessonMatchHint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {exercise.left.map((left, leftIndex) => {
            const matched = selection[leftIndex] ?? ''
            return (
              <button
                key={'left:' + leftIndex}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (matched) {
                    const next = [...selection]
                    next[leftIndex] = ''
                    onChange(next)
                  }
                  setActiveLeft(activeLeft === leftIndex ? null : leftIndex)
                }}
                aria-pressed={activeLeft === leftIndex}
                className={cn(
                  'flex min-h-[58px] flex-col justify-center rounded-xl border px-2.5 py-2 text-left transition-all active:scale-[0.99]',
                  activeLeft === leftIndex
                    ? 'border-pprimary bg-[rgb(var(--p-primary-rgb)/0.10)]'
                    : matched
                      ? 'border-[rgb(var(--p-success-rgb)/0.4)] bg-[rgb(var(--p-success-rgb)/0.08)]'
                      : 'border-pline bg-pcard',
                )}
              >
                <span className="text-[13px] font-semibold leading-snug text-pfg break-words">{left}</span>
                <span className={cn('mt-0.5 text-[11px] leading-snug', matched ? 'text-psuccess' : 'text-psubtle')}>
                  {matched || tt('rusDarslikLessonPickPair')}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2">
          {exercise.right.map((right, rightIndex) => {
            const isUsed = chosenRights.has(right)
            return (
              <button
                key={'right:' + rightIndex}
                type="button"
                disabled={locked || isUsed}
                onClick={() => {
                  const target = activeLeft ?? selection.findIndex(item => !item)
                  if (target < 0) return
                  assignRight(target, right)
                }}
                className={cn(
                  'flex min-h-[58px] items-center rounded-xl border px-2.5 py-2 text-left text-[13px] leading-snug transition-all active:scale-[0.99]',
                  isUsed
                    ? 'border-transparent bg-psurface text-psubtle opacity-45'
                    : 'border-pline bg-pcard text-pfg',
                )}
              >
                <span className="break-words">{right}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
