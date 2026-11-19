import { memo, useMemo, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, RotateCcw, Lightbulb, Award, AlertTriangle, BookOpen } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { useAppStore } from '../../shared/store/useAppStore'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { formatImageSrc } from '../test'
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
        <p className="whitespace-pre-line text-[16px] leading-[1.7] text-pfg">
          <InlineText text={block.lines.join('\n')} />
        </p>
      )

    case 'list':
      return block.ordered ? (
        <ol className="flex flex-col gap-2.5 pl-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15.5px] leading-[1.68] text-pfg">
              <span className="mt-1 grid size-5 flex-none place-items-center rounded-full bg-[rgb(var(--p-primary-rgb)/0.12)] text-[11px] font-extrabold tabular-nums text-pprimary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-line">
                <InlineText text={item.text} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="flex flex-col gap-2.5 pl-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15.5px] leading-[1.68] text-pfg">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[10px] size-2 flex-none rounded-full',
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

    case 'quote': {
      const quoteText = block.lines.join('\n')
      const lower = quoteText.toLowerCase()
      const isTrap = lower.includes('ловушк') || lower.includes('ошибк') || quoteText.includes('⚠️')
      const isTip = lower.includes('шпаргалк') || lower.includes('важно') || lower.includes('запомн') || quoteText.includes('💡')
      const isBook = lower.includes('анализ') || lower.includes('сюжет') || quoteText.includes('📖')

      if (isTrap) {
        return (
          <div className="my-2 rounded-2xl border-l-4 border-pwarning bg-[rgb(var(--p-warning-rgb)/0.12)] px-4 py-3.5 text-pfg">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-pwarning">
              <AlertTriangle className="size-4 shrink-0 text-pwarning" />
              <span>Ловушка для экзамена</span>
            </div>
            <div className="text-[15px] leading-[1.65] text-pfg">
              <InlineText text={quoteText.replace(/^(?:⚠️|💡|📖|\s)+/u, '')} />
            </div>
          </div>
        )
      }

      if (isTip) {
        return (
          <div className="my-2 rounded-2xl border-l-4 border-pprimary bg-[rgb(var(--p-primary-rgb)/0.10)] px-4 py-3.5 text-pfg">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-pprimary">
              <Lightbulb className="size-4 shrink-0 text-pprimary" />
              <span>Важная памятка</span>
            </div>
            <div className="text-[15px] leading-[1.65] text-pfg">
              <InlineText text={quoteText.replace(/^(?:⚠️|💡|📖|\s)+/u, '')} />
            </div>
          </div>
        )
      }

      if (isBook) {
        return (
          <div className="my-2 rounded-2xl border-l-4 border-psuccess bg-[rgb(var(--p-success-rgb)/0.10)] px-4 py-3.5 text-pfg">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-psuccess">
              <BookOpen className="size-4 shrink-0 text-psuccess" />
              <span>Разбор произведения</span>
            </div>
            <div className="text-[15px] leading-[1.65] text-pfg">
              <InlineText text={quoteText.replace(/^(?:⚠️|💡|📖|\s)+/u, '')} />
            </div>
          </div>
        )
      }

      return (
        <blockquote className="rounded-2xl border-l-4 border-pprimary bg-psurface px-4 py-3.5 text-pfg">
          <span className="whitespace-pre-line text-[15.5px] font-semibold leading-[1.68] text-pfg">
            <InlineText text={quoteText} />
          </span>
        </blockquote>
      )
    }

    case 'image':
      return (
        <figure className="my-5 flex flex-col items-center">
          <div className="group relative w-full max-w-xs overflow-hidden rounded-2xl bg-psurface shadow-xs sm:max-w-sm">
            <img
              src={formatImageSrc(block.src) ?? block.src}
              alt={block.alt}
              className="max-h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:max-h-80"
              loading="lazy"
            />
            {block.alt && (
              <div className="bg-[rgb(0_0_0/0.55)] px-3 py-2 text-left">
                <span className="text-xs font-bold text-white">
                  {block.alt}
                </span>
              </div>
            )}
          </div>
          {block.caption && (
            <figcaption className="mt-2 max-w-sm text-center text-xs font-medium italic text-pmuted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl bg-psurface p-1.5">
          <table className="w-full border-collapse overflow-hidden rounded-xl text-left text-[14px]">
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
                    <td key={c} className="border-b border-pline px-3.5 py-2.5 text-pfg last:border-b-0">
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
    <div className="my-5 rounded-3xl bg-psurface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-pline pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[rgb(var(--p-primary-rgb)/0.14)] text-pprimary">
            <Award className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-pfg">
              {ru ? 'Интерактивный тест' : 'Interaktiv test'}
            </h4>
            <p className="text-xs text-pmuted">
              {answeredCount}/{questions.length} {ru ? 'отвечено' : 'yechildi'}
              {answeredCount > 0 && ` • ${correctCount} ${ru ? 'правильно' : "to'g'ri"}`}
            </p>
          </div>
        </div>
        {answeredCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-pcard px-3 py-1.5 text-xs font-semibold text-pfg shadow-2xs transition-opacity hover:opacity-85"
          >
            <RotateCcw className="size-3.5" />
            <span>{ru ? 'Заново' : 'Qayta'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, qIdx) => {
          const selected = selectedAnswers[qIdx]
          const isAnswered = selected !== undefined

          return (
            <div
              key={qIdx}
              className="flex flex-col gap-3 rounded-2xl bg-pcard p-3.5 shadow-2xs sm:p-4"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--p-primary-rgb)/0.12)] text-[11px] font-extrabold text-pprimary">
                  {qIdx + 1}
                </span>
                <p className="text-[14.5px] font-semibold leading-relaxed text-pfg">
                  {q.q}
                </p>
              </div>

              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.o.map((opt, optIdx) => {
                  const isSelected = selected === optIdx
                  const isCorrectOpt = q.a === optIdx

                  let btnStyle =
                    'bg-psurface text-pfg hover:bg-[rgb(var(--p-primary-rgb)/0.08)]'

                  if (isAnswered) {
                    if (isCorrectOpt) {
                      btnStyle =
                        'bg-[rgb(var(--p-success-rgb)/0.16)] text-pfg font-semibold'
                    } else if (isSelected) {
                      btnStyle =
                        'bg-[rgb(var(--p-warning-rgb)/0.18)] text-pfg font-medium'
                    } else {
                      btnStyle = 'bg-psurface text-pmuted opacity-55'
                    }
                  }

                  const letter = String.fromCharCode(65 + optIdx)

                  return (
                    <button
                      type="button"
                      key={optIdx}
                      disabled={isAnswered}
                      onClick={() => handleSelect(qIdx, optIdx, q.a)}
                      className={cn(
                        'flex min-h-[44px] cursor-pointer items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-[13.5px] transition-colors duration-150 disabled:cursor-default',
                        btnStyle,
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          className={cn(
                            'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold',
                            isAnswered && isCorrectOpt
                              ? 'bg-psuccess text-white'
                              : isAnswered && isSelected
                                ? 'bg-pwarning text-white'
                                : 'bg-pcard text-pmuted',
                          )}
                        >
                          {letter}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </div>
                      {isAnswered && isCorrectOpt && (
                        <CheckCircle2 className="size-4 shrink-0 text-psuccess" />
                      )}
                      {isAnswered && isSelected && !isCorrectOpt && (
                        <XCircle className="size-4 shrink-0 text-pwarning" />
                      )}
                    </button>
                  )
                })}
              </div>

              {isAnswered && q.e && (
                <div className="mt-1 flex items-start gap-2 rounded-2xl bg-psurface px-3.5 py-2.5 text-[13px] leading-relaxed text-pfg">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-pwarning" />
                  <div>
                    <span className="font-bold">
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
        <div className="mt-4 rounded-2xl bg-[rgb(var(--p-success-rgb)/0.14)] p-4 text-center">
          <p className="text-sm font-bold text-pfg">
            {correctCount === questions.length
              ? ru
                ? 'Превосходно! Все ответы верны!'
                : "Ajoyib! Barcha javoblar to‘g‘ri!"
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
