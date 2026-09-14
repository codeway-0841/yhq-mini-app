import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import MathText from '../../../shared/components/MathText'
import { graphExpressionToLatex } from '../lib/math'
import { curveColor } from '../curve-colors'
import type { StoredExpression } from '../useGraphStore'

export interface ExprIssue {
  message: string
  /** ASL matndagi xato pozitsiyasi (null — pozitsiya yo'q) */
  pos: number | null
}

interface Props {
  language: 'uz' | 'ru'
  expressions: StoredExpression[]
  errors: Record<string, ExprIssue | null>
  registerInput: (id: string, el: HTMLInputElement | null) => void
  onFocusInput: (id: string) => void
  onBlurInput?: (id: string) => void
  onChange: (id: string, expr: string) => void
  onToggleVisible: (id: string) => void
  onCycleColor: (id: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  canAdd: boolean
  readOnly?: boolean
}

export default function ExpressionList({
  language, expressions, errors, registerInput, onFocusInput, onBlurInput,
  onChange, onToggleVisible, onCycleColor, onRemove, onAdd, canAdd, readOnly = false,
}: Props) {
  const tt = useT(language)

  return (
    <div className="flex flex-col gap-2.5">
      {expressions.map((e) => {
        const error = errors[e.id]
        const latex = error ? null : graphExpressionToLatex(e.expr)
        return (
          <div key={e.id}>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onCycleColor(e.id)}
                  aria-label={tt('graphColor')}
                  className="grid size-8 flex-shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                >
                  <span className="size-4 rounded-full" style={{ background: curveColor(e.colorIdx) }} />
                </button>
              )}
              <div className="relative min-w-0 flex-1">
                <input
                  ref={(el) => registerInput(e.id, el)}
                  value={e.expr}
                  onChange={(ev) => onChange(e.id, ev.target.value)}
                  onFocus={() => onFocusInput(e.id)}
                  onBlur={() => onBlurInput?.(e.id)}
                  readOnly={readOnly}
                  placeholder={tt('graphExprPlaceholder')}
                  aria-label={tt('graphTitle')}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `expr-err-${e.id}` : undefined}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`h-11 w-full rounded-xl bg-psurface px-3 font-mono text-[14px] text-pfg outline-none placeholder:text-psubtle focus:ring-2 ${
                    error ? 'ring-2 ring-[rgb(var(--p-danger-rgb)/0.7)]' : 'focus:ring-pprimary'
                  }`}
                />
                {error?.pos != null && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 font-mono text-[14px]"
                  >
                    <span className="invisible whitespace-pre">{e.expr.slice(0, error.pos)}</span>
                    <span className="whitespace-pre underline decoration-pdanger decoration-2 underline-offset-4">
                      {e.expr.slice(error.pos, error.pos + 1) || ' '}
                    </span>
                  </div>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onToggleVisible(e.id)}
                  aria-label={tt('graphToggleVisible')}
                  className="grid size-8 flex-shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                >
                  {e.visible ? <Eye size={16} strokeWidth={1.75} /> : <EyeOff size={16} strokeWidth={1.75} />}
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  aria-label={tt('graphDelete')}
                  className="grid size-8 flex-shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-psurface hover:text-pdanger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              )}
            </div>
            {error && (
              <p id={`expr-err-${e.id}`} className="mt-1 pl-10 text-[11px] text-pdanger">
                {error.message}
              </p>
            )}
            {latex && (
              <div className="mt-1.5 overflow-x-auto pl-10 pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                <MathText text={`$$${latex}$$`} className="text-[13px] text-pmuted" />
              </div>
            )}
          </div>
        )
      })}

      {canAdd && !readOnly && (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-psurface text-[13.5px] font-semibold text-pmuted transition-colors hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
        >
          <Plus size={16} strokeWidth={1.75} />
          {tt('graphAddFunction')}
        </button>
      )}
    </div>
  )
}
