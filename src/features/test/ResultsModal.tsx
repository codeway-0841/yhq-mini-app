import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { playSound } from '../../lib/sounds'
import DonutChart from './DonutChart'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({ results, onRetry, onFinish, onGoToQuestion, threshold = 90 }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
  /** o'tish foizi — exam rejimida 90 (haqiqiy imtihon), qolganida 80 */
  threshold?: number
}) {
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length

  // Natija ochildi — qisqa g'alaba fanfarasi (tema-mos chastota)
  useEffect(() => { playSound('win') }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full card-neon rounded-t-3xl border-t border-lineStrong p-5 pb-8 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">{tt('results')}</h2>
        <DonutChart correct={correct} total={total} threshold={threshold} passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'rgb(var(--p-primary-rgb) / 0.12)', borderColor: 'rgb(var(--p-primary-rgb) / 0.30)' }}>
            <p className="text-base font-black text-duo-green leading-none">✓</p>
            <p className="text-3xl font-black text-fg mt-1">{correct}</p>
            <p className="text-[11px] font-bold text-muted mt-1">{tt('correct')}</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ background: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.30)' }}>
            <p className="text-base font-black text-duo-red leading-none">✗</p>
            <p className="text-3xl font-black text-fg mt-1">{wrong}</p>
            <p className="text-[11px] font-bold text-muted mt-1">{tt('wrong')}</p>
          </div>
          <div className="rounded-2xl bg-elevated border border-line p-3 text-center">
            <p className="text-base font-black text-subtle leading-none">—</p>
            <p className="text-3xl font-black text-fg mt-1">{unanswered}</p>
            <p className="text-[11px] font-bold text-subtle mt-1">{tt('unanswered')}</p>
          </div>
        </div>

        <p className="text-sm font-bold mb-3">{tt('question')}</p>
        <div className="grid grid-cols-8 gap-1.5 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              className={`aspect-square rounded-full flex items-center justify-center text-[11px] font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-duo-green text-ponprimary' :
                r.status === 'incorrect' ? 'bg-duo-red text-white'   :
                                           'bg-elevated text-muted'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry}
            className="btn-3d-ghost flex-1 py-3.5 rounded-2xl font-extrabold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            {tt('retry')}
          </button>
          <button onClick={onFinish}
            className="btn-neon flex-[2] py-3.5 rounded-2xl font-black text-base">
            {tt('finish')}
          </button>
        </div>
      </div>
    </div>
  )
}
