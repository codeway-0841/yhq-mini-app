import { Lightbulb, Sparkles } from 'lucide-react'
import { Button } from '../../../shared/components/ui/button'
import MathText from '../../../shared/components/MathText'

/**
 * Math Board — hint kartasi (Faza 5).
 *
 * Avval lokal hint (deterministik). LLM tugmasi faqat takroriy/noma'lum
 * xatoda. AI ishlamasa — fallback matn. Hamma matn parent'dan (i18n).
 */

interface HintCardProps {
  title: string
  localHint: string | null
  offerAi: boolean
  askingAi: boolean
  aiQuestion: string | null
  aiTitle: string
  askLabel: string
  askingLabel: string
  fallback: string
  showFallback: boolean
  onAskAi: () => void
}

export default function HintCard({
  title, localHint, offerAi, askingAi, aiQuestion,
  aiTitle, askLabel, askingLabel, fallback, showFallback, onAskAi,
}: HintCardProps) {
  if (!localHint && !offerAi && !aiQuestion && !showFallback) return null
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-psurface p-3" role="note">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-pmuted">
        <Lightbulb size={15} strokeWidth={1.75} />
        {title}
      </span>
      {localHint && <p className="text-[13.5px] leading-relaxed text-pfg">{localHint}</p>}
      {aiQuestion && (
        <div className="flex flex-col gap-1 rounded-xl bg-pcard p-2.5 shadow-2xs">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ppurple">
            <Sparkles size={14} strokeWidth={1.75} />
            {aiTitle}
          </span>
          {/* AI javobidagi $...$ LaTeX render qilinadi (xom $ ko'rinmaydi) */}
          <MathText text={aiQuestion} className="text-[13.5px] leading-relaxed text-pfg" />
        </div>
      )}
      {showFallback && !aiQuestion && (
        <p className="text-[13.5px] leading-relaxed text-pmuted">{fallback}</p>
      )}
      {offerAi && !aiQuestion && (
        <Button
          type="button"
          variant="secondary"
          onClick={onAskAi}
          disabled={askingAi}
          className="w-full"
        >
          <Sparkles size={16} strokeWidth={1.75} />
          {askingAi ? askingLabel : askLabel}
        </Button>
      )}
    </div>
  )
}
