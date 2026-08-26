import { useState, useMemo } from 'react'
import { getSignByCode, type RoadSign } from '../../../content/signs'
import { X, TrafficCone, ExternalLink } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'

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

        <div className="bg-pcanvas/70 border border-pline p-3.5 rounded-container mb-4 text-[13px] text-pfg leading-relaxed whitespace-pre-line">
          {sign.description || "Ushbu belgi bo'yicha qo'shimcha ma'lumot mavjud emas."}
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
                  {renderInlineMarkdown(itemText, (code) => {
                    const sign = getSignByCode(code)
                    if (sign) setSelectedSign(sign)
                  })}
                </li>
              )
            })}
          </ul>
        )
      }

      return (
        <p key={pIdx} className="text-[13.5px] text-pfg leading-relaxed mb-2.5 last:mb-0">
          {renderInlineMarkdown(trimmed, (code) => {
            const sign = getSignByCode(code)
            if (sign) setSelectedSign(sign)
          })}
        </p>
      )
    })
  }, [content])

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
 */
function renderInlineMarkdown(text: string, onSignClick: (code: string) => void) {
  // Regex to match links [label](url) and bold **text**
  const regex = /\[(.*?)\]\((.*?)\)|\*\*(.*?)\*\*/g
  const result = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index

    // Text before match
    if (matchIndex > lastIndex) {
      result.push(text.slice(lastIndex, matchIndex))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Link match [label](url)
      const label = match[1]
      const url = match[2]

      // Check if it's a sign link like `/signs/3.27`
      const signMatch = url.match(/^\/?signs\/([a-zA-Z0-9._-]+)$/)
      if (signMatch) {
        const code = signMatch[1]
        const sign = getSignByCode(code)

        result.push(
          <button
            key={`sign-${matchIndex}`}
            type="button"
            onClick={() => onSignClick(code)}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 my-0.5 rounded-control bg-pblue/15 text-pblue font-semibold text-[13px] border border-pblue/30 hover:bg-pblue/25 active:scale-95 transition-all cursor-pointer align-baseline shadow-xs"
            title={`${label} — ma'lumotlarini ko'rish`}
          >
            {sign?.image ? (
              <img src={sign.image} alt={code} className="size-4 object-contain inline-block flex-shrink-0" />
            ) : (
              <TrafficCone size={13} className="inline-block flex-shrink-0 text-pblue" />
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
      result.push(
        <strong key={`bold-${matchIndex}`} className="font-bold text-pfg">
          {match[3]}
        </strong>
      )
    }

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }

  return result
}
