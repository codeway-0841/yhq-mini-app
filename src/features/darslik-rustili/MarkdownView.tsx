import { memo, useMemo } from 'react'
import { cn } from '../../shared/lib/cn'
import { parseInline, parseMarkdown, type MdBlock, type MdInline } from './markdown'

function Inline({ parts, className }: { parts: MdInline[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.bold) {
          return (
            <strong key={i} className="font-semibold text-pfg">
              {part.text}
            </strong>
          )
        }
        if (part.italic) {
          return (
            <em key={i} className="italic">
              {part.text}
            </em>
          )
        }
        if (part.code) {
          return (
            <code key={i} className="rounded bg-psurface px-1 py-0.5 text-[0.92em] text-pprimary">
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
  if (level <= 2) {
    return (
      <h3
        id={anchor}
        className={cn(
          'scroll-mt-20 text-pfg',
          level === 1 ? 'mt-7 text-[17px] font-bold leading-snug' : 'mt-6 text-[15.5px] font-bold leading-snug',
        )}
      >
        <InlineText text={text} />
      </h3>
    )
  }
  return (
    <h4 className={cn('mt-4 text-[14px] font-semibold leading-snug text-pfg', level === 4 && 'text-[13px] text-pmuted')}>
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
        <p className="whitespace-pre-line text-[14px] leading-[1.75] text-pmuted">
          <InlineText text={block.lines.join('\n')} />
        </p>
      )

    case 'list':
      return block.ordered ? (
        <ol className="flex flex-col gap-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-[1.7] text-pmuted">
              <span className="mt-0.5 min-w-4 flex-none text-right text-[12px] font-semibold text-pprimary">{i + 1}.</span>
              <span className="whitespace-pre-line">
                <InlineText text={item.text} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="flex flex-col gap-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-[1.7] text-pmuted">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[9px] size-1.5 flex-none rounded-full',
                  item.checked === true ? 'bg-emerald-500' : 'bg-[rgb(var(--p-primary-rgb)/0.55)]',
                )}
              />
              <span className="whitespace-pre-line">
                <InlineText text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      )

    case 'quote':
      return (
        <blockquote className="rounded-xl border-l-[3px] border-pprimary bg-[rgb(var(--p-primary-rgb)/0.06)] px-3.5 py-2.5">
          <span className="whitespace-pre-line text-[13.5px] leading-[1.7] text-pfg">
            <InlineText text={block.lines.join('\n')} />
          </span>
        </blockquote>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-pline">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-psurface">
                {block.head.map((cell, i) => (
                  <th key={i} className="border-b border-pline px-3 py-2 font-semibold text-pfg">
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="align-top">
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-pline px-3 py-2 text-pmuted">
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

/** Markdown matnini ilova dizayn tilidagi bloklarga aylantirib ko'rsatadi. */
export const MarkdownView = memo(function MarkdownView({ source, className }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source])
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} anchor={`md-h-${index}`} />
      ))}
    </div>
  )
})
