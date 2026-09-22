import React, { useMemo } from 'react'
import MathText from './MathText'
import { haptics } from '../../platform/haptics'
import { playSound } from '../lib/sounds'

export interface QuizOption {
  key: string
  text: string
  raw: string
}

export interface ParsedQuiz {
  hasQuiz: boolean
  before: string
  options: QuizOption[]
  after: string
}

/**
 * Parses message text to see if it contains a multiple-choice question.
 * Supports A), B), C), D) and A., B., C., D. as well as Cyrillic А, Б, В, Г.
 */
export function parseQuizOptions(text: string): ParsedQuiz {
  if (!text) return { hasQuiz: false, before: '', options: [], after: '' }
  const lines = text.split('\n')
  const optionRegex = /^\s*([A-Da-dА-Гa-г1-4])[).]\s+(.+)$/
  let optStart = -1
  let optEnd = -1
  const options: QuizOption[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(optionRegex)
    if (match) {
      if (optStart === -1) optStart = i
      optEnd = i
      options.push({
        key: match[1].toUpperCase(),
        text: match[2].trim(),
        raw: match[0].trim(),
      })
    } else if (optStart !== -1 && lines[i].trim() !== '') {
      // Non-empty line after option block ends options
      break
    }
  }

  if (options.length >= 2) {
    const before = lines.slice(0, optStart).join('\n').trim()
    const after = lines.slice(optEnd + 1).join('\n').trim()
    return { hasQuiz: true, before, options, after }
  }

  return { hasQuiz: false, before: text, options: [], after: '' }
}

/**
 * Handles inline bold (**text**), inline code (`code`), and passes tokens to MathText.
 */
function InlineMarkdown({ text }: { text: string }) {
  if (!text) return null

  // Split by bold (**...**) and inline code (`...`)
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[\s\S]+?\*\*|`[^`\n]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index)
      parts.push(<MathText key={`m-${lastIndex}`} text={plain} />)
    }

    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      const boldContent = token.slice(2, -2)
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-stone-900 dark:text-stone-100">
          <MathText text={boldContent} />
        </strong>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const codeContent = token.slice(1, -1)
      parts.push(
        <code
          key={`c-${match.index}`}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-stone-200/70 dark:bg-stone-700/60 font-mono text-[11px] text-stone-900 dark:text-stone-200"
        >
          {codeContent}
        </code>,
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(<MathText key={`m-end`} text={text.slice(lastIndex)} />)
  }

  return <>{parts}</>
}

/**
 * Renders rich text with markdown formatting (bold, italic, code, paragraphs, bullet lists)
 * and LaTeX math via MathText.
 */
function FormattedParagraph({ text }: { text: string }) {
  if (!text.trim()) return null

  const lines = text.split('\n')
  const isList = lines.length > 1 && lines.every((l) => !l.trim() || /^\s*[-*•]\s+/.test(l) || /^\s*\d+\.\s+/.test(l))

  if (isList) {
    return (
      <ul className="space-y-1.5 my-1.5 pl-2 list-none">
        {lines.map((l, idx) => {
          const trimmed = l.trim()
          if (!trimmed) return null
          const bulletMatch = trimmed.match(/^([-*•]|\d+\.)\s+(.+)$/)
          if (!bulletMatch) {
            return (
              <li key={idx} className="leading-relaxed">
                <InlineMarkdown text={trimmed} />
              </li>
            )
          }
          const marker = bulletMatch[1]
          const body = bulletMatch[2]
          return (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0 text-[11px] mt-0.5 select-none">
                {/^\d+\./.test(marker) ? marker : '▹'}
              </span>
              <div className="flex-1">
                <InlineMarkdown text={body} />
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="leading-relaxed">
      {lines.map((line, lIdx) => (
        <React.Fragment key={lIdx}>
          <InlineMarkdown text={line} />
          {lIdx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  )
}

interface TutorRichMessageProps {
  content: string
  isUser: boolean
  onSelectOption?: (optionRaw: string) => void
  isTyping?: boolean
}

export default function TutorRichMessage({
  content,
  isUser,
  onSelectOption,
}: TutorRichMessageProps) {
  // Parse for Multiple Choice Quiz
  const quiz = useMemo(() => (isUser ? { hasQuiz: false, before: '', options: [], after: '' } : parseQuizOptions(content)), [content, isUser])

  // Split prose into paragraphs by double newlines
  const beforeParagraphs = useMemo(() => {
    if (isUser) return []
    return (quiz.hasQuiz ? quiz.before : content)
      .split(/\n\n+/)
      .filter((p) => p.trim() !== '')
  }, [quiz, content, isUser])

  const afterParagraphs = useMemo(() => {
    if (isUser || !quiz.hasQuiz || !quiz.after) return []
    return quiz.after.split(/\n\n+/).filter((p) => p.trim() !== '')
  }, [quiz, isUser])

  // User messages render cleanly with MathText
  if (isUser) {
    return (
      <div className="whitespace-pre-wrap font-medium">
        <MathText text={content} />
      </div>
    )
  }

  const handleOptionClick = (opt: QuizOption) => {
    haptics.selection()
    playSound('click')
    if (onSelectOption) {
      onSelectOption(opt.raw)
    }
  }

  return (
    <div className="space-y-2.5 text-xs sm:text-[13px] select-text">
      {/* Question or preamble paragraphs */}
      <div className="space-y-2">
        {beforeParagraphs.map((para, idx) => (
          <FormattedParagraph key={`p-${idx}`} text={para} />
        ))}
      </div>

      {/* Interactive Options Cards (if quiz detected) */}
      {quiz.hasQuiz && quiz.options.length > 0 && (
        <div className="my-3 space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider px-0.5 flex items-center gap-1.5">
            <span>Tanlang:</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {quiz.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleOptionClick(opt)}
                className="w-full text-left p-3 rounded-2xl border border-stone-200/90 dark:border-stone-700/80 bg-white/95 dark:bg-stone-800/90 hover:border-[#59B2E6] dark:hover:border-sky-500 hover:bg-sky-50/60 dark:hover:bg-sky-950/40 shadow-xs transition-all flex items-center gap-3 group cursor-pointer active:scale-[0.99]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 font-bold text-xs border border-stone-200/60 dark:border-stone-600 group-hover:bg-[#59B2E6] group-hover:text-[#261312] group-hover:border-[#2B8FD0] transition-colors">
                  {opt.key}
                </span>

                <div className="flex-1 font-medium text-stone-800 dark:text-stone-200 leading-snug">
                  <InlineMarkdown text={opt.text} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Post-quiz text (if any) */}
      {afterParagraphs.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-stone-200/40 dark:border-stone-700/40">
          {afterParagraphs.map((para, idx) => (
            <FormattedParagraph key={`post-${idx}`} text={para} />
          ))}
        </div>
      )}
    </div>
  )
}
