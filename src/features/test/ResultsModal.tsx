import { RotateCcw } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import DonutChart from './DonutChart'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({ results, onRetry, onFinish, onGoToQuestion }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
}) {
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-8 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">{tt('results')}</h2>
        <DonutChart correct={correct} total={total} passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl p-3 text-center border" style={{ background: '#1d3a24', borderColor: '#3f920255' }}>
            <p className="text-base font-black text-duo-green leading-none">✓</p>
            <p className="text-3xl font-black text-white mt-1">{correct}</p>
            <p className="text-[11px] font-bold text-white/70 mt-1">{tt('correct')}</p>
          </div>
          <div className="rounded-2xl p-3 text-center border" style={{ background: '#3a1d1d', borderColor: '#d93f3f55' }}>
            <p className="text-base font-black text-duo-red leading-none">✗</p>
            <p className="text-3xl font-black text-white mt-1">{wrong}</p>
            <p className="text-[11px] font-bold text-white/70 mt-1">{tt('wrong')}</p>
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
                r.status === 'correct'   ? 'bg-duo-green text-white' :
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
            className="btn-3d-green flex-[2] py-3.5 rounded-2xl font-black text-base">
            {tt('finish')}
          </button>
        </div>
      </div>
    </div>
  )
}
