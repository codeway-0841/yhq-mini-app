import { useState, useMemo, useEffect, useCallback } from 'react'
import type { RoadSign } from '../../../content/signs'
import { X, TrafficCone, ExternalLink } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'

// ── Lazy signs chunk (audit HIGH-3) ─────────────────────────────────────────
// signs.ts statik import TestPage chunk'iga ~565KB (2 til × ~300KB) qo'shardi —
// hatto izohda hech bir belgi kodi bo'lmasa ham. Endi chunk FAQAT izoh matnida
// belgi kodi/linki uchraganda dinamik yuklanadi; yuklanmaguncha kodlar oddiy
// matn ko'rinishida turadi, kelgach tugmaga "yangilanadi" (useMemo qayta hisob).
type SignsModule = typeof import('../../../content/signs')
type GetSign = (code: string) => RoadSign | undefined

let signsPromise: Promise<SignsModule> | null = null
function loadSigns(): Promise<SignsModule> {
  if (!signsPromise) signsPromise = import('../../../content/signs')
  return signsPromise
}

function renderSimpleBold(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-pfg">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function FormattedSignDescription({ text }: { text: string }) {
  if (!text) {
    return <p className="text-pmuted text-center">Ushbu belgi bo'yicha qo'shimcha ma'lumot mavjud emas.</p>
  }
  const paragraphs = text.split(/\n\s*\n/)
  return (
    <div className="space-y-2 text-[13px] text-pfg leading-relaxed">
      {paragraphs.map((p, i) => {
        const trimmed = p.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim())
          return (
            <ul key={i} className="list-disc list-inside space-y-1">
              {items.map((it, idx) => (
                <li key={idx}>{renderSimpleBold(it)}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{renderSimpleBold(trimmed)}</p>
      })}
    </div>
  )
}

function SignDetailModal({ sign, onClose }: { sign: RoadSign; onClose: () => void }) {
  return (
    <DialogOverlay onClose={onClose} backdropClassName="bg-black/75 z-50" labelId="sign-detail-modal-title">
      <div
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-psurface rounded-t-sheet border-t border-pline p-5 pb-7 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-pprimary px-2.5 py-1 bg-pprimary/10 rounded-control border border-pprimary/20">
            {sign.code}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-psurface border border-pline flex items-center justify-center text-pmuted hover:text-pfg transition-colors"
            aria-label="Yopish"
          >
            <X size={16} />
          </button>
        </div>

        <div className="w-36 h-36 mx-auto rounded-container bg-white/95 border border-pline shadow-inner flex items-center justify-center mb-4 p-3">
          {sign.image ? (
            <img src={sign.image} alt={sign.name} className="w-full h-full object-contain" />
          ) : (
            <TrafficCone size={48} strokeWidth={1.5} className="text-stone-400" />
          )}
        </div>

        <h3 id="sign-detail-modal-title" className="text-center font-display font-semibold text-base text-pfg mb-1">
          {sign.name}
        </h3>
        <p className="text-center text-xs text-pmuted mb-4 font-medium">{sign.legalRef}</p>

        <div className="bg-pcanvas/70 border border-pline p-3.5 rounded-container mb-4">
          <FormattedSignDescription text={sign.description} />
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-control bg-pprimary text-ponprimary font-semibold text-sm hover:brightness-[1.06] active:scale-[0.98] transition-all"
        >
          Tushunarli
        </button>
      </div>
    </DialogOverlay>
  )
}

interface MarkdownExplanationProps {
  content: string
}

export default function MarkdownExplanation({ content }: MarkdownExplanationProps) {
  const [selectedSign, setSelectedSign] = useState<RoadSign | null>(null)
  const [getSign, setGetSign] = useState<GetSign | null>(null)

  // Belgilar chunk'i FAQAT izohda belgi kodi/linki bor bo'lsagina yuklanadi
  const maybeHasSigns = useMemo(
    () => !!content && (/signs\//.test(content) || /\b[1-7]\.\d{1,2}\b/.test(content)),
    [content]
  )

  useEffect(() => {
    if (!maybeHasSigns) return
    let cancelled = false
    void loadSigns().then((m) => { if (!cancelled) setGetSign(() => m.getSignByCode) })
    return () => { cancelled = true }
  }, [maybeHasSigns])

  const handleSignClick = useCallback((code: string) => {
    const cached = getSign?.(code)
    if (cached) { setSelectedSign(cached); return }
    // Chunk hali kelmagan bo'lsa (juda tez bosilgan) — yuklab, keyin ochamiz
    void loadSigns().then((m) => {
      const sign = m.getSignByCode(code)
      if (sign) setSelectedSign(sign)
    })
  }, [getSign])

  // Parse markdown into structured segments with clickable sign links
  const parsedNodes = useMemo(() => {
    if (!content) return null

    // Split by paragraphs
    const paragraphs = content.split(/\n\s*\n/)

    return paragraphs.map((paragraph, pIdx) => {
      const trimmed = paragraph.trim()
      if (!trimmed) return null

      // Check if it's a list
      const lines = trimmed.split('\n')
      const isList = lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))

      if (isList) {
        return (
          <ul key={pIdx} className="list-disc list-inside space-y-1.5 my-2 text-[13.5px] text-pfg leading-relaxed">
            {lines.map((line, lIdx) => {
              const itemText = line.trim().replace(/^[-*]\s+/, '')
              return (
                <li key={lIdx} className="pl-1">
                  {renderInlineMarkdown(itemText, handleSignClick, getSign)}
                </li>
              )
            })}
          </ul>
        )
      }

      return (
        <p key={pIdx} className="text-[13.5px] text-pfg leading-relaxed mb-2.5 last:mb-0">
          {renderInlineMarkdown(trimmed, handleSignClick, getSign)}
        </p>
      )
    })
  }, [content, handleSignClick, getSign])

  return (
    <>
      <div className="explanation-markdown">{parsedNodes}</div>
      {selectedSign && <SignDetailModal sign={selectedSign} onClose={() => setSelectedSign(null)} />}
    </>
  )
}

/**
 * Parses inline markdown:
 * - [Label](/signs/3.27) -> Road Sign Clickable Badge
 * - [Label](url) -> External Link
 * - **Bold Text** -> <strong>Bold Text</strong>
 * - Automatic detection of road signs (3.27, 5.33, etc.)
 */
function renderInlineMarkdown(text: string, onSignClick: (code: string) => void, getSign: GetSign | null) {
  // Regex to match links [label](url) and bold **text**
  const regex = /\[(.*?)\]\((.*?)\)|\*\*(.*?)\*\*/g
  const result: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index

    // Text before match
    if (matchIndex > lastIndex) {
      const beforeText = text.slice(lastIndex, matchIndex)
      result.push(parsePlainRoadSigns(beforeText, onSignClick, `plain-${lastIndex}`, getSign))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Link match [label](url)
      const label = match[1]
      const url = match[2]

      // Check if it's a sign link like `/signs/3.27` or `/signs/5.33`
      const signMatch = url.match(/^\/?signs\/([a-zA-Z0-9._-]+)$/)
      if (signMatch) {
        const code = signMatch[1]
        const sign = getSign?.(code)

        result.push(
          <button
            key={`sign-${matchIndex}`}
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSignClick(code)
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 my-0.5 rounded-control bg-blue-500/15 text-blue-500 dark:text-blue-400 font-semibold text-[13px] border border-blue-500/35 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer align-baseline shadow-xs"
            title={`${label} — ma'lumotlarini ko'rish`}
          >
            {sign?.image ? (
              <img src={sign.image} alt={code} className="size-4 object-contain inline-block flex-shrink-0" />
            ) : (
              <TrafficCone size={13} className="inline-block flex-shrink-0 text-blue-500" />
            )}
            <span className="underline underline-offset-2">{label}</span>
          </button>
        )
      } else {
        // External link
        result.push(
          <a
            key={`link-${matchIndex}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-pprimary hover:underline font-medium"
          >
            <span>{label}</span>
            <ExternalLink size={12} />
          </a>
        )
      }
    } else if (match[3] !== undefined) {
      // Bold match **text**
      const boldContent = match[3]
      result.push(
        <strong key={`bold-${matchIndex}`} className="font-bold text-pfg">
          {parsePlainRoadSigns(boldContent, onSignClick, `bold-${matchIndex}`, getSign)}
        </strong>
      )
    }

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    const afterText = text.slice(lastIndex)
    result.push(parsePlainRoadSigns(afterText, onSignClick, `plain-end-${lastIndex}`, getSign))
  }

  return result
}

/**
 * Automatically detects road sign codes like 3.27, 5.33, 1.1 in text and turns them into blue buttons
 */
function parsePlainRoadSigns(text: string, onSignClick: (code: string) => void, keyPrefix: string, getSign: GetSign | null): React.ReactNode {
  const signCodeRegex = /\b([1-7]\.\d{1,2}(?:\.\d{1,2})?)\b(?:\s*-\s*["«“]([^"»”]+)["»”])?/g
  const nodes: React.ReactNode[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = signCodeRegex.exec(text)) !== null) {
    const code = m[1]
    const sign = getSign?.(code)

    if (sign) {
      if (m.index > lastIdx) {
        nodes.push(text.slice(lastIdx, m.index))
      }

      const label = m[2] ? `${code} - "${m[2]}"` : `${code} - ${sign.name.replace(/^\d+(\.\d+)*\.\s*/, '')}`

      nodes.push(
        <button
          key={`${keyPrefix}-${m.index}`}
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSignClick(code)
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 my-0.5 rounded-control bg-blue-500/15 text-blue-500 dark:text-blue-400 font-semibold text-[13px] border border-blue-500/35 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer align-baseline shadow-xs"
          title={`${label} — ma'lumotlarini ko'rish`}
        >
          {sign.image ? (
            <img src={sign.image} alt={code} className="size-4 object-contain inline-block flex-shrink-0" />
          ) : (
            <TrafficCone size={13} className="inline-block flex-shrink-0 text-blue-500" />
          )}
          <span className="underline underline-offset-2">{label}</span>
        </button>
      )

      lastIdx = m.index + m[0].length
    }
  }

  if (nodes.length === 0) {
    return text
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx))
  }

  return nodes
}
