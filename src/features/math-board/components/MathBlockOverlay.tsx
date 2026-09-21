import { memo } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, HelpCircle, MinusCircle, ShieldAlert, PencilLine } from 'lucide-react'
import type { MathBlock, BlockGradingStatus } from '../lib/board-model'

/**
 * Math Board — blok overlay (Faza 3, Chiron-style raqamlash).
 * Canvas ustida absolute qatlam (pointer-events-none — chizishga xalaqit
 * bermaydi): chapda qadam raqami + status ikonka; `highlightBlockId` (Faza 5
 * tutor highlight) ramka chizadi. Koordinatalar 0..1 rect → % ga.
 */

const STATUS_ICON: Record<BlockGradingStatus, typeof CheckCircle2 | null> = {
  pending: null,
  checking: Loader2,
  correct: CheckCircle2,
  probably_correct: CheckCircle2,
  uncertain: HelpCircle,
  wrong: XCircle,
  invalid_transition: AlertTriangle,
  domain_error: ShieldAlert,
  syntax_error: PencilLine,
  unknown: MinusCircle,
}

interface MathBlockOverlayProps {
  blocks: MathBlock[]
  highlightBlockId?: string | null
}

const MathBlockOverlay = memo(function MathBlockOverlay({ blocks, highlightBlockId }: MathBlockOverlayProps) {
  const drawBlocks = blocks.filter((b) => b.strokeIds.length > 0 && b.rect)
  if (drawBlocks.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {drawBlocks.map((b, i) => {
        const Icon = STATUS_ICON[b.grading.status]
        const highlighted = highlightBlockId === b.id
        const r = b.rect
        if (!r) return null
        return (
          <div key={b.id}>
            {/* Chap raqam + status */}
            <span
              className="absolute flex items-center gap-1 rounded-full bg-pcard px-2 py-1 text-[12px] font-bold text-pfg shadow-md"
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, transform: 'translate(-4px, -50%)' }}
            >
              {i + 1}
              {Icon && (
                <Icon
                  size={13}
                  strokeWidth={2.25}
                  className={Icon === Loader2 ? 'animate-spin text-pmuted' : ''}
                />
              )}
            </span>
            {/* Highlight ramka (tutor) */}
            {highlighted && (
              <span
                className="absolute rounded-xl ring-2 ring-ppurple ring-offset-2 ring-offset-transparent"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.width * 100}%`,
                  height: `${r.height * 100}%`,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
})

export default MathBlockOverlay
