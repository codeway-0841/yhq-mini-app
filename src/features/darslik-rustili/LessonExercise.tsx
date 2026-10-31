import { useState } from 'react'
import { Check, Eraser, Link2, Volume2, X } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { useT } from '../../shared/i18n'
import { useAppStore } from '../../shared/store/useAppStore'
import type { DarslikAnswerValue, DarslikPublicExercise } from '../../../shared/darslik-mastery'

interface LessonExerciseProps {
  exercise: DarslikPublicExercise
  value: DarslikAnswerValue | undefined
  onChange: (value: DarslikAnswerValue) => void
  disabled?: boolean
  outcome?: 'correct' | 'wrong' | 'revealed'
  onSpeak?: (text: string) => void
  speaking?: boolean
  /** Natija ekranida javobni ko'rsatish uchun (o'zgartirish o'chiriladi). */
  readOnly?: boolean
}

const CYRILLIC_HELPER_KEYS = ['ё', 'ъ', 'ь', 'й', 'э', 'ю', 'я'] as const

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
  outcome,
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
      <div className="flex flex-col gap-3">
        {exercise.kind === 'listening' && (
          <div className="flex items-center gap-4 rounded-3xl bg-pcard p-4 shadow-xs">
            <button
              type="button"
              disabled={locked}
              onClick={() => onSpeak?.(exercise.audioText)}
              aria-label={tt('rusDarslikLessonListen')}
              className={cn(
                'grid size-16 shrink-0 cursor-pointer place-items-center rounded-2xl bg-pprimary text-ponprimary shadow-[0_4px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)] transition-all active:translate-y-[2px] active:shadow-[0_2px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)] disabled:cursor-not-allowed disabled:opacity-50',
                speaking && 'ring-4 ring-[rgb(var(--p-primary-rgb)/0.24)]',
              )}
            >
              <Volume2 size={28} strokeWidth={2.25} className={cn(speaking && 'animate-pulse')} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5" aria-hidden="true">
                {[14, 22, 18, 26, 16, 20, 12].map((h, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'w-1 rounded-full transition-all duration-300',
                      speaking ? 'animate-pulse bg-pprimary' : 'bg-[rgb(var(--p-primary-rgb)/0.28)]',
                    )}
                    style={{ height: speaking ? `${h}px` : `${Math.max(8, Math.round(h * 0.55))}px` }}
                  />
                ))}
              </div>
              <p className="text-[14px] font-bold text-pfg">{tt('rusDarslikLessonListen')}</p>
              <p className="text-[12px] leading-snug text-pmuted">{tt('rusDarslikLessonReplay')}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5" role="group" aria-label={exercise.prompt}>
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
                  'group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold leading-snug transition-all active:translate-y-[2px] disabled:cursor-default',
                  isSelected && outcome === 'correct'
                    ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-pfg ring-2 ring-psuccess'
                    : isSelected && outcome === 'wrong'
                    ? 'bg-[rgb(var(--p-warning-rgb)/0.14)] text-pfg ring-2 ring-pwarning'
                    : isSelected && outcome === 'revealed'
                    ? 'bg-psurface text-pfg ring-2 ring-pmuted'
                    : isSelected
                    ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pfg ring-2 ring-pprimary shadow-[0_3px_0_var(--p-primary)]'
                    : 'bg-pcard text-pfg ring-1 ring-pline shadow-[0_3px_0_var(--p-line)] hover:bg-psurface',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-xl text-[12px] font-extrabold tabular-nums transition-colors',
                    isSelected
                      ? 'bg-pprimary text-ponprimary shadow-2xs'
                      : 'bg-psurface text-pmuted group-hover:text-pfg',
                  )}
                >
                  {numberLabel(optionIndex)}
                </span>
                <span className="min-w-0 flex-1 break-words">{option}</span>
                {isSelected && outcome && (outcome === 'wrong' ? <X aria-hidden="true" className="text-pwarning" /> : <Check aria-hidden="true" className={outcome === 'correct' ? 'text-psuccess' : 'text-pmuted'} />)}
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
      <div className="flex flex-col gap-2.5 rounded-3xl bg-pcard p-3.5 shadow-xs">
        <div className="relative">
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
            className="w-full rounded-2xl bg-psurface px-4 py-3.5 text-[16px] font-semibold text-pfg outline-none ring-2 ring-transparent transition-all placeholder:font-normal placeholder:text-psubtle focus:bg-pcanvas focus:ring-pprimary disabled:opacity-70"
          />
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5" aria-hidden="true">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-psubtle">
                {tt('rusDarslikCyrillicHint')}:
              </span>
              {CYRILLIC_HELPER_KEYS.map((char) => (
                <button
                  key={char}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onChange(text + char)}
                  className="grid size-8 cursor-pointer place-items-center rounded-xl bg-psurface text-[13.5px] font-bold text-pfg shadow-[0_2px_0_var(--p-line)] transition-all active:translate-y-[1px] active:shadow-none"
                >
                  {char}
                </button>
              ))}
            </div>
            {text.length > 0 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onChange('')}
                className="flex cursor-pointer items-center gap-1 rounded-xl bg-psurface px-2.5 py-1.5 text-[11.5px] font-semibold text-pmuted active:scale-95"
              >
                <Eraser size={12} strokeWidth={2.25} />
                {tt('rusDarslikLessonClear')}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (exercise.kind === 'word_bank') {
    const chosen = Array.isArray(value) ? value : []
    const used = new Map<string, number>()
    for (const token of chosen) used.set(token, (used.get(token) ?? 0) + 1)
    return (
      <div className="flex flex-col gap-3.5">
        <div
          className={cn(
            'relative flex min-h-[88px] flex-wrap content-start gap-2 rounded-3xl p-3.5 transition-colors',
            chosen.length
              ? 'bg-[rgb(var(--p-primary-rgb)/0.07)] ring-2 ring-[rgb(var(--p-primary-rgb)/0.35)]'
              : 'bg-pcard shadow-xs',
          )}
          aria-label={tt('rusDarslikLessonWordBankHint')}
        >
          {chosen.length === 0 && (
            <div className="flex w-full flex-col justify-center gap-2 py-2">
              <span className="text-[12.5px] font-medium text-psubtle">
                {tt('rusDarslikLessonWordBankHint')}
              </span>
              <div className="h-px w-full border-b border-dashed border-pline" aria-hidden="true" />
              <div className="h-px w-3/4 border-b border-dashed border-pline" aria-hidden="true" />
            </div>
          )}
          {chosen.map((token, index) => (
            <button
              key={token + ':' + index}
              type="button"
              disabled={locked}
              onClick={() => onChange(chosen.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={tt('rusDarslikLessonRemoveToken').replace('{token}', token)}
              className="flex cursor-pointer items-center rounded-xl bg-pprimary px-3 py-2 text-[14px] font-bold text-ponprimary shadow-[0_3px_0_color-mix(in_srgb,var(--p-primary)_62%,#0f172a)] transition-all active:translate-y-[1px] active:shadow-none disabled:opacity-70"
            >
              {token}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-1">
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
                  'rounded-xl px-3.5 py-2.5 text-[14px] font-bold transition-all',
                  isUsed
                    ? 'cursor-default bg-psurface text-psubtle opacity-40'
                    : 'cursor-pointer bg-pcard text-pfg ring-1 ring-pline shadow-[0_3px_0_var(--p-line)] hover:bg-psurface active:translate-y-[2px] active:shadow-none',
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
            className="flex w-fit cursor-pointer items-center gap-1.5 self-end rounded-xl bg-psurface px-2.5 py-1.5 text-[12px] font-semibold text-pmuted transition-opacity active:opacity-70"
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
  const matchedCount = selection.filter(Boolean).length
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium leading-snug text-pmuted">{tt('rusDarslikLessonMatchHint')}</p>
        <span className="shrink-0 rounded-full bg-psurface px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-pprimary">
          {tt('rusDarslikMatchedCount')
            .replace('{done}', String(matchedCount))
            .replace('{total}', String(exercise.left.length))}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-2.5">
          {exercise.left.map((left, leftIndex) => {
            const matched = selection[leftIndex] ?? ''
            const isActive = activeLeft === leftIndex
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
                  setActiveLeft(isActive ? null : leftIndex)
                }}
                aria-pressed={isActive}
                className={cn(
                  'flex min-h-[64px] cursor-pointer flex-col justify-center rounded-2xl px-3 py-2.5 text-left transition-all active:translate-y-[2px]',
                  isActive
                    ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] ring-2 ring-pprimary shadow-[0_3px_0_var(--p-primary)]'
                    : matched
                      ? 'bg-[rgb(var(--p-success-rgb)/0.10)] ring-2 ring-[rgb(var(--p-success-rgb)/0.45)] shadow-[0_3px_0_rgb(var(--p-success-rgb)/0.45)]'
                      : 'bg-pcard ring-1 ring-pline shadow-[0_3px_0_var(--p-line)] hover:bg-psurface',
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[13.5px] font-bold leading-snug text-pfg break-words">{left}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold',
                      matched
                        ? 'bg-psuccess text-white'
                        : isActive
                          ? 'bg-pprimary text-ponprimary'
                          : 'bg-psurface text-psubtle',
                    )}
                  >
                    {leftIndex + 1}
                  </span>
                </div>
                <span
                  className={cn(
                    'mt-1 flex items-center gap-1 text-[11px] font-semibold leading-snug',
                    matched ? 'text-psuccess' : isActive ? 'text-pprimary' : 'text-psubtle',
                  )}
                >
                  {matched && <Link2 size={11} strokeWidth={2.5} className="shrink-0" />}
                  <span className="truncate">{matched || tt('rusDarslikLessonPickPair')}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {exercise.right.map((right, rightIndex) => {
            const isUsed = chosenRights.has(right)
            const pairIdx = selection.findIndex((item) => item === right)
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
                  'flex min-h-[64px] items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-[13.5px] font-semibold leading-snug transition-all',
                  isUsed
                    ? 'cursor-default bg-[rgb(var(--p-success-rgb)/0.08)] text-psuccess opacity-65'
                    : 'cursor-pointer bg-pcard text-pfg ring-1 ring-pline shadow-[0_3px_0_var(--p-line)] hover:bg-psurface active:translate-y-[2px] active:shadow-none',
                )}
              >
                <span className="break-words">{right}</span>
                {isUsed && pairIdx >= 0 && (
                  <span
                    aria-hidden="true"
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-psuccess text-[10px] font-extrabold text-white"
                  >
                    {pairIdx + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
