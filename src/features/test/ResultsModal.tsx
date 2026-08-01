import { RotateCcw, Share2 } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import DonutChart from './DonutChart'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({ results, onRetry, onFinish, onGoToQuestion, onShare }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
  onShare?: (correct: number, total: number) => void
}) {
  const tt           = useT(useAppStore((s) => s.settings.language))
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-line p-5 pb-10 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">{tt('results')}</h2>
        <DonutChart correct={correct} total={total} passedLabel={tt('passed')} failedLabel={tt('failed')} />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl bg-duo-green p-3 text-center">
            <p className="text-lg font-black text-white leading-none">✓</p>
            <p className="text-2xl font-black text-white mt-1">{correct}</p>
            <p className="text-[11px] font-bold text-white/85 mt-0.5">{tt('correct')}</p>
          </div>
          <div className="rounded-2xl bg-duo-red-dark p-3 text-center">
            <p className="text-lg font-black text-white leading-none">✗</p>
            <p className="text-2xl font-black text-white mt-1">{wrong}</p>
            <p className="text-[11px] font-bold text-white/85 mt-0.5">{tt('wrong')}</p>
          </div>
          <div className="rounded-2xl bg-elevated border border-line p-3 text-center">
            <p className="text-lg font-black text-subtle leading-none">—</p>
            <p className="text-2xl font-black text-fg mt-1">{unanswered}</p>
            <p className="text-[11px] font-bold text-subtle mt-0.5">{tt('unanswered')}</p>
          </div>
        </div>

        <p className="text-sm font-bold mb-3">{tt('question')}</p>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-green-600 text-white' :
                r.status === 'incorrect' ? 'bg-red-700 text-white'   :
                                           'bg-elevated text-muted'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry}
            className="btn-3d-ghost flex-1 py-3 rounded-2xl font-extrabold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            {tt('retry')}
          </button>
          {onShare && (
            <button onClick={() => onShare(correct, total)}
              className="btn-3d-blue w-14 py-3 rounded-2xl flex items-center justify-center"
              aria-label={tt('shareResult')}>
              <Share2 size={18} />
            </button>
          )}
          <button onClick={onFinish}
            className="btn-3d-green flex-[2] py-3 rounded-2xl font-black text-base">
            {tt('finish')}
          </button>
        </div>
      </div>
    </div>
  )
}
