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
          <div className="rounded-xl bg-green-900/30 border border-green-700/40 p-3 text-center">
            <p className="text-2xl font-black text-green-400">{correct}</p>
            <p className="text-[11px] text-green-300/70 mt-0.5">✓ {tt('correct')}</p>
          </div>
          <div className="rounded-xl bg-red-900/30 border border-red-700/40 p-3 text-center">
            <p className="text-2xl font-black text-red-400">{wrong}</p>
            <p className="text-[11px] text-red-300/70 mt-0.5">✗ {tt('wrong')}</p>
          </div>
          <div className="rounded-xl bg-elevated border border-line p-3 text-center">
            <p className="text-2xl font-black text-muted">{unanswered}</p>
            <p className="text-[11px] text-muted/70 mt-0.5">— {tt('unanswered')}</p>
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
            className="flex-1 py-3.5 rounded-xl bg-elevated text-fg font-semibold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            {tt('retry')}
          </button>
          {onShare && (
            <button onClick={() => onShare(correct, total)}
              className="w-14 py-3.5 rounded-xl bg-duo-blue text-white font-semibold flex items-center justify-center"
              aria-label={tt('shareResult')}>
              <Share2 size={18} />
            </button>
          )}
          <button onClick={onFinish}
            className="flex-[2] py-3.5 rounded-xl bg-green-600 text-white font-bold text-base">
            {tt('finish')}
          </button>
        </div>
      </div>
    </div>
  )
}
