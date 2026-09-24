import { PageHeader } from '../../../shared/components/ui/page-header'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../../shared/lib/navigation'

/** Yuqori panel — orqaga tugma, sarlavha, raund paytida hisob (PageHeader SSOT). */
export function DuelHeader({ title, backLabel, inRound, yourScore, oppScore, onBack }: {
  title: string
  backLabel: string
  inRound: boolean
  yourScore: number
  oppScore: number
  onBack?: () => void
}) {
  const navigate = useNavigate()
  const actions = inRound ? (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-psurface font-display text-xs shadow-2xs">
      <span className="text-pprimary font-bold tabular-nums">{yourScore}</span>
      <span className="text-psubtle">:</span>
      <span className="text-pdanger font-bold tabular-nums">{oppScore}</span>
    </div>
  ) : null

  return (
    <PageHeader
      title={title}
      size="lg"
      onBack={onBack ?? (() => goBack(navigate))}
      backLabel={backLabel}
      actions={actions}
      className="-mx-4 mb-4"
    />
  )
}
