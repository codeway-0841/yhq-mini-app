import { memo, useMemo } from 'react'
import {
  CheckCircle2,
  Check,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  PencilLine,
  HelpCircle,
  MinusCircle,
  Loader2,
} from 'lucide-react'
import { renderKaTeXToString } from '../../../shared/components/MathText'
import type { Keys } from '../../../shared/i18n'
import type { AcceptedStep } from '../hooks/useBoardSession'
import type { CheckStatus } from '../../../shared/math-engine'

/**
 * Math Board — qadamlar ro'yxati (Faza 3).
 *
 * Yuqorida ko'k ground-truth (masala sharti), pastda qabul qilingan qadamlar.
 * Har qadam: KaTeX render + status (ikonka+matn — faqat rang emas, a11y).
 */

export function Latex({ latex, display }: { latex: string; display?: boolean }) {
  const html = useMemo(() => renderKaTeXToString(latex, display), [latex, display])
  if (!html) return <span className="font-mono text-[14px]">{latex}</span>
  return (
    <span
      className={display ? 'block overflow-x-auto py-1 text-center text-[17px]' : 'text-[15px]'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const STATUS_META: Record<CheckStatus, { icon: typeof Check; labelKey: Keys; cls: string }> = {
  correct: { icon: CheckCircle2, labelKey: 'mathBoardCorrect', cls: 'text-psuccess' },
  probably_correct: { icon: Check, labelKey: 'mathBoardProbably', cls: 'text-psuccess' },
  uncertain: { icon: HelpCircle, labelKey: 'mathBoardUncertain', cls: 'text-pwarning' },
  wrong: { icon: XCircle, labelKey: 'mathBoardWrong', cls: 'text-pdanger' },
  invalid_transition: { icon: AlertTriangle, labelKey: 'mathBoardInvalid', cls: 'text-pwarning' },
  domain_error: { icon: ShieldAlert, labelKey: 'mathBoardDomain', cls: 'text-pdanger' },
  syntax_error: { icon: PencilLine, labelKey: 'mathBoardSyntax', cls: 'text-pmuted' },
  unknown: { icon: MinusCircle, labelKey: 'mathBoardUnknown', cls: 'text-pmuted' },
}

export function StepStatusBadge({ status, label }: { status: CheckStatus; label: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={`flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-semibold ${meta.cls}`} role="status">
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      <span>{label}</span>
    </span>
  )
}

export function CheckingBadge({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-pmuted" role="status">
      <Loader2 size={15} className="shrink-0 animate-spin" />
      <span>{label}</span>
    </span>
  )
}

interface StepListProps {
  problemLatex: string
  steps: AcceptedStep[]
  statusLabel: (key: Keys) => string
}

const StepList = memo(function StepList({ problemLatex, steps, statusLabel }: StepListProps) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      {/* Ground truth — Chiron'dagi ko'k index chizig'i */}
      <div className="rounded-2xl bg-pcard p-4 shadow-xs">
        <Latex latex={problemLatex} display />
      </div>
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-start gap-2.5 rounded-2xl bg-pcard px-4 py-3 shadow-xs">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-psurface text-[12px] font-bold text-pmuted">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <Latex latex={s.latex} />
          </div>
          <StepStatusBadge status={s.result.status} label={statusLabel(STATUS_META[s.result.status].labelKey)} />
        </div>
      ))}
    </div>
  )
})

export default StepList
