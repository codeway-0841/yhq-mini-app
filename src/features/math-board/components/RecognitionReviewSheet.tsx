import { useState } from 'react'
import { Check, ScanLine } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import StepInput from './StepInput'
import { Latex } from './StepList'

/**
 * Math Board — recognition review sheet (Faza 4).
 * Raqamlangan bloklar (overlay'dagi raqamlar bilan bir xil tartib):
 * har biri MathLive'da tahrirlanadi, "Kiritish" typed input'ga o'tkazadi
 * (grading o'sha yerda — faqat tasdiqlangan formula tekshiriladi).
 * Tanilmagan blok — xato qatori, o'tkazib yuboriladi.
 */

export interface ReviewBlock {
  id: string
  order: number
  latex: string
  alternatives: string[]
  confidence: number
  failed: boolean
  /** Blok crop-snapshot'i (data URL) — recognized latex'ni asl chizma bilan
   *  taqqoslash uchun (round-4 review: backdrop chizmani qoraytirgani uchun
   *  sheet'da asl rasm ko'rinishi shart) */
  image?: string | null
}

interface RecognitionReviewSheetProps {
  blocks: ReviewBlock[]
  title: string
  failedLabel: string
  useLabel: string
  closeLabel: string
  onClose: () => void
  /** P1-2: tasdiqlash AYNAN QAYSI blokka yozilishi kerakligini qaytaradi */
  onUse: (blockId: string, latex: string) => void
}

export default function RecognitionReviewSheet({
  blocks, title, failedLabel, useLabel, closeLabel, onClose, onUse,
}: RecognitionReviewSheetProps) {
  const [edits, setEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(blocks.map((b) => [b.id, b.latex])),
  )
  const [editKey, setEditKey] = useState(0)

  const setEdit = (id: string, latex: string): void => {
    setEdits((s) => ({ ...s, [id]: latex }))
  }

  const pickAlternative = (id: string, alt: string): void => {
    setEdit(id, alt)
    setEditKey((k) => k + 1)
  }

  return (
    <DialogOverlay onClose={onClose} position="bottom" labelId="recognition-review-title">
      <span id="recognition-review-title" className="sr-only">{title}</span>
      <div className="flex max-h-[75vh] flex-col gap-2.5 overflow-y-auto p-4">
        <p className="text-[15px] font-bold text-pfg">{title}</p>
        {blocks.map((b, i) => (
          <div key={b.id} className="flex flex-col gap-2 rounded-2xl bg-psurface p-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-pmuted">
              <span className="flex size-6 items-center justify-center rounded-full bg-pcard text-[12px] font-bold">
                {i + 1}
              </span>
              {b.failed ? (
                <span className="text-pdanger">{failedLabel}</span>
              ) : (
                <span className="flex items-center gap-1 text-pmuted">
                  <ScanLine size={14} strokeWidth={1.75} />
                  {Math.round(b.confidence * 100)}%
                </span>
              )}
            </span>
            {b.image && (
              <img
                src={b.image}
                alt=""
                className="h-16 w-auto self-start rounded-xl bg-white"
              />
            )}
            {!b.failed && (
              <>
                <StepInput
                  key={`${b.id}-${editKey}`}
                  value={edits[b.id] ?? b.latex}
                  onLatex={(v) => setEdit(b.id, v)}
                  label={`${title} ${i + 1}`}
                />
                {b.alternatives.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {b.alternatives.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => pickAlternative(b.id, a)}
                        className="rounded-xl bg-pcard px-2.5 py-1.5 text-[13px] text-pfg shadow-2xs"
                      >
                        <Latex latex={a} />
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onUse(b.id, edits[b.id] ?? b.latex)}
                  disabled={!(edits[b.id] ?? b.latex).trim()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-pprimary px-4 py-2.5 text-[14px] font-semibold text-white shadow-md disabled:opacity-40"
                >
                  <Check size={16} strokeWidth={2} />
                  {useLabel}
                </button>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="rounded-2xl bg-psurface px-4 py-2.5 text-[14px] font-semibold text-pmuted"
        >
          {closeLabel}
        </button>
      </div>
    </DialogOverlay>
  )
}
