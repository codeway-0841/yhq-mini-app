import { Sheet, SheetBody, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
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
    <Sheet onClose={onClose}>
      <SheetHeader onClose={onClose} closeLabel={closeLabel}>
        <SheetTitle>{title}</SheetTitle>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-2.5">
        <StepList problemLatex={problemLatex} steps={steps} statusLabel={statusLabel} />
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-psurface px-4 py-2.5 text-[14px] font-semibold text-pmuted"
        >
          {closeLabel}
        </button>
      </SheetBody>
    </Sheet>
  )
}
