import { memo, useMemo, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, RotateCcw, Lightbulb, Award } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { useAppStore } from '../../shared/store/useAppStore'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { parseInline, parseMarkdown, type MdBlock, type MdInline, type QuizQuestion } from './markdown'

function Inline({ parts, className }: { parts: MdInline[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.bold) {
          return (
            <strong key={i} className="font-bold text-pfg">
              {part.text}
            </strong>
          )
        }
        if (part.italic) {
          return (
            <em key={i} className="italic text-pfg">
              {part.text}
            </em>
          )
        }
        if (part.code) {
          return (
            <code key={i} className="rounded-md bg-psurface px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-pprimary">
              {part.text}
            </code>
          )
        }
        return <span key={i}>{part.text}</span>
      })}
    </span>
  )
}

function InlineText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => parseInline(text), [text])
  return <Inline parts={parts} className={className} />
}

function HeadingBlock({ level, text, anchor }: { level: 1 | 2 | 3 | 4; text: string; anchor: string }) {
  const lower = text.toLowerCase()
  const isWarning = text.includes('⚠️') || lower.includes('ошибк') || lower.includes('ловушк')
  const isImportant = lower.includes('важно') || lower.includes('главное') || lower.includes('запомн')

  if (level <= 2) {
    return (
      <h3
        id={anchor}
        className={cn(
          'mt-4 scroll-mt-20 border-l-3 border-pprimary pl-3 text-pfg first:mt-0',
          level === 1 ? 'text-[17px] font-extrabold leading-snug' : 'text-[15.5px] font-bold leading-snug',
        )}
      >
        <InlineText text={text} />
      </h3>
    )
  }

  return (
    <h4
      className={cn(
        'mt-3 text-[14px] font-bold leading-snug first:mt-0',
        isWarning
          ? ' rounded-xl bg-[rgb(var(--p-warning-rgb)/0.14)] px-3 py-1.5 text-pwarning'
          : isImportant
            ? 'rounded-xl bg-[rgb(var(--p-primary-rgb)/0.10)] px-3 py-1.5 text-pprimary'
            : level === 4
              ? 'text-[13px] text-pmuted'
              : 'text-pfg',
      )}
    >
      <InlineText text={text} />
    </h4>
  )
}

function BlockView({ block, anchor }: { block: MdBlock; anchor: string }) {
  switch (block.kind) {
    case 'heading':
      return <HeadingBlock level={block.level} text={block.text} anchor={anchor} />

    case 'paragraph':
      return (
        <p className="whitespace-pre-line text-[14.5px] leading-[1.72] text-pmuted">
          <InlineText text={block.lines.join('\n')} />
        </p>
      )

    case 'list':
      return block.ordered ? (
        <ol className="flex flex-col gap-2 pl-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-[1.68] text-pmuted">
              <span className="mt-0.5 grid size-5 flex-none place-items-center rounded-lg bg-[rgb(var(--p-primary-rgb)/0.12)] text-[11px] font-extrabold tabular-nums text-pprimary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-line">
                <InlineText text={item.text} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="flex flex-col gap-2 pl-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-[1.68] text-pmuted">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[9px] size-2 flex-none rounded-full',
                  item.checked === true ? 'bg-psuccess' : 'bg-pprimary',
                )}
              />
              <span className="min-w-0 flex-1 whitespace-pre-line">
                <InlineText text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      )

    case 'quote':
      return (
        <blockquote className="rounded-2xl border-l-4 border-pprimary bg-[rgb(var(--p-primary-rgb)/0.08)] px-4 py-3 shadow-2xs">
          <span className="whitespace-pre-line text-[14px] font-medium leading-[1.68] text-pfg">
            <InlineText text={block.lines.join('\n')} />
          </span>
        </blockquote>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl bg-psurface p-1">
          <table className="w-full border-collapse overflow-hidden rounded-xl text-left text-[13.5px]">
            <thead>
              <tr className="bg-pcard">
                {block.head.map((cell, i) => (
                  <th key={i} className="border-b border-pline px-3.5 py-2.5 font-bold text-pfg">
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="align-top odd:bg-pcanvas even:bg-pcard">
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-pline px-3.5 py-2 text-pmuted last:border-b-0">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'divider':
      return <hr className="border-0 border-t border-pline" />

    case 'quiz':
      return <InteractiveQuizBlock questions={block.questions} />

    default:
      return null
  }
}

function InteractiveQuizBlock({ questions }: { questions: QuizQuestion[] }) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const lang = useAppStore((s) => s.settings.language)
  const ru = lang === 'ru'

  const handleSelect = useCallback((qIndex: number, optIndex: number, correctIdx: number) => {
    setSelectedAnswers((prev) => {
      if (prev[qIndex] !== undefined) return prev
      const isCorrect = optIndex === correctIdx
      if (isCorrect) {
        playSound('success')
        haptics.success()
      } else {
        playSound('error')
        haptics.error()
      }
      return { ...prev, [qIndex]: optIndex }
    })
  }, [])

  const handleReset = () => {
    setSelectedAnswers({})
  }

  const answeredCount = Object.keys(selectedAnswers).length
  const correctCount = Object.entries(selectedAnswers).filter(
    ([qIdx, optIdx]) => questions[Number(qIdx)]?.a === optIdx,
  ).length

  const allAnswered = answeredCount === questions.length && questions.length > 0

  return (
    <div className="my-6 rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/20 to-slate-900/60 p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-purple-500/20 text-purple-300">
            <Award className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-100">
              {ru ? 'Интерактивный тест' : 'Interaktiv test'}
            </h4>
            <p className="text-xs text-slate-400">
              {answeredCount}/{questions.length} {ru ? 'отвечено' : 'yechildi'}
              {answeredCount > 0 && ` • ${correctCount} ${ru ? 'правильно' : "to'g'ri"}`}
            </p>
          </div>
        </div>
        {answeredCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span>{ru ? 'Заново' : 'Qayta'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {questions.map((q, qIdx) => {
          const selected = selectedAnswers[qIdx]
          const isAnswered = selected !== undefined

          return (
            <div
              key={qIdx}
              className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 sm:p-4"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-purple-500/20 text-[11px] font-bold text-purple-300">
                  {qIdx + 1}
                </span>
                <p className="text-sm font-medium text-slate-200 leading-relaxed">
                  {q.q}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {q.o.map((opt, optIdx) => {
                  const isSelected = selected === optIdx
                  const isCorrectOpt = q.a === optIdx

                  let btnStyle =
                    'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'

                  if (isAnswered) {
                    if (isCorrectOpt) {
                      btnStyle =
                        'border-emerald-500/80 bg-emerald-500/15 text-emerald-200 font-semibold shadow-xs'
                    } else if (isSelected) {
                      btnStyle =
                        'border-rose-500/80 bg-rose-500/15 text-rose-200 line-through decoration-rose-400 font-medium'
                    } else {
                      btnStyle = 'border-slate-800/40 bg-slate-900/30 text-slate-500 opacity-60'
                    }
                  }

                  const letter = String.fromCharCode(65 + optIdx)

                  return (
                    <button
                      key={optIdx}
                      disabled={isAnswered}
                      onClick={() => handleSelect(qIdx, optIdx, q.a)}
                      className={cn(
                        'flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs sm:text-[13px] transition-all min-h-[44px]',
                        btnStyle,
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold',
                            isSelected && isCorrectOpt
                              ? 'bg-emerald-500 text-white'
                              : isSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-700/50 text-slate-400',
                          )}
                        >
                          {letter}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </div>
                      {isAnswered && isCorrectOpt && (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                      )}
                      {isAnswered && isSelected && !isCorrectOpt && (
                        <XCircle className="size-4 shrink-0 text-rose-400" />
                      )}
                    </button>
                  )
                })}
              </div>

              {isAnswered && q.e && (
                <div className="mt-1 flex items-start gap-2 rounded-xl border border-purple-500/20 bg-purple-950/20 px-3 py-2 text-xs text-purple-200/90 leading-relaxed">
                  <Lightbulb className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-purple-300">
                      {ru ? 'Объяснение:' : 'Izoh:'}{' '}
                    </span>
                    <span>{q.e}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allAnswered && (
        <div className="mt-5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
          <p className="text-sm font-bold text-slate-100">
            {correctCount === questions.length
              ? ru
                ? '🎉 Превосходно! Все ответы верны!'
                : "🎉 Ajoyib! Barcha javoblar to'g'ri!"
              : `${ru ? 'Тест завершён! Результат:' : 'Test yakunlandi! Natija:'} ${correctCount} / ${questions.length} (${Math.round((correctCount / questions.length) * 100)}%)`}
          </p>
        </div>
      )}
    </div>
  )
}

/** Markdown matnini yoki oldindan ajratilgan bloklarni ilova dizaynida ko'rsatadi. */
export const MarkdownView = memo(function MarkdownView({
  source,
  blocks: providedBlocks,
  className,
}: {
  source?: string
  blocks?: readonly MdBlock[]
  className?: string
}) {
  const blocks = useMemo(
    () => providedBlocks ? [...providedBlocks] : parseMarkdown(source ?? ''),
    [providedBlocks, source],
  )
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} anchor={`md-h-${index}`} />
      ))}
    </div>
  )
})
