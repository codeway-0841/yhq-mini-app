import { Sword, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../../shared/lib/navigation'

/** Yuqori panel — orqaga tugma, sarlavha, raund paytida hisob. */
export function DuelHeader({ title, inRound, yourScore, oppScore, onBack }: {
  title: string
  inRound: boolean
  yourScore: number
  oppScore: number
  onBack?: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-pline bg-pcanvas">
      <button onClick={onBack ?? (() => goBack(navigate))} className="text-pmuted p-1 hover:text-pfg transition-colors"><X size={20} /></button>
      <div className="flex items-center gap-2">
        <Sword size={16} className="text-pmuted" />
        <span className="text-sm font-bold text-pfg">{title}</span>
      </div>
      {inRound ? (
        <div className="flex gap-1 text-xs text-pmuted">
          <span className="text-pprimary font-bold">{yourScore}</span>
          <span>:</span>
          <span className="text-pdanger font-bold">{oppScore}</span>
        </div>
      ) : <div className="w-8" />}
    </div>
  )
}
