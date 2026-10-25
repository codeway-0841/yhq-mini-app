import { memo, useMemo } from 'react'
import { cn } from '../../shared/lib/cn'
import { parseInline, parseMarkdown, type MdBlock, type MdInline } from './markdown'

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

    default:
      return null
  }
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
