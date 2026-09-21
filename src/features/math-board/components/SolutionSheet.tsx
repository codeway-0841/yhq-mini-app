import DialogOverlay from '../../../shared/components/DialogOverlay'
import StepList from './StepList'
import type { AcceptedStep } from '../hooks/useBoardSession'
import type { Keys } from '../../../shared/i18n'

/**
 * Math Board — yechim ko'rish (Faza 6): FAQAT accepted steps.
 * Noto'g'ri/urinishlar kirmaydi — o'quvchi toza yechimni ko'radi.
 */

interface SolutionSheetProps {
  problemLatex: string
  steps: AcceptedStep[]
  title: string
  closeLabel: string
  statusLabel: (key: Keys) => string
  onClose: () => void
}

export default function SolutionSheet({
  problemLatex, steps, title, closeLabel, statusLabel, onClose,
}: SolutionSheetProps) {
  return (
    <DialogOverlay onClose={onClose} position="bottom" labelId="solution-sheet-title">
      <span id="solution-sheet-title" className="sr-only">{title}</span>
      <div className="flex max-h-[75vh] flex-col gap-2.5 overflow-y-auto p-4">
        <p className="text-[15px] font-bold text-pfg">{title}</p>
        <StepList problemLatex={problemLatex} steps={steps} statusLabel={statusLabel} />
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-psurface px-4 py-2.5 text-[14px] font-semibold text-pmuted"
        >
          {closeLabel}
        </button>
      </div>
    </DialogOverlay>
  )
}
