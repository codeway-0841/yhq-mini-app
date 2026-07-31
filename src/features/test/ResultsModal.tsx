import { RotateCcw } from 'lucide-react'
import DonutChart from './DonutChart'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' }

export default function ResultsModal({ results, onRetry, onFinish, onGoToQuestion }: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
}) {
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const unanswered = results.filter((r) => r.status === 'unanswered').length

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full bg-[#161b22] rounded-t-3xl border-t border-[#30363d] p-5 pb-10 max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-[#30363d] rounded-full mx-auto mb-4" />
        <h2 className="text-center text-lg font-black mb-1">Natijalar</h2>
        <DonutChart correct={correct} total={total} />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-xl bg-green-900/30 border border-green-700/40 p-3 text-center">
            <p className="text-2xl font-black text-green-400">{correct}</p>
            <p className="text-[11px] text-green-300/70 mt-0.5">✓ To'g'ri</p>
          </div>
          <div className="rounded-xl bg-red-900/30 border border-red-700/40 p-3 text-center">
            <p className="text-2xl font-black text-red-400">{wrong}</p>
            <p className="text-[11px] text-red-300/70 mt-0.5">✗ Noto'g'ri</p>
          </div>
          <div className="rounded-xl bg-[#21262d] border border-[#30363d] p-3 text-center">
            <p className="text-2xl font-black text-[#8b949e]">{unanswered}</p>
            <p className="text-[11px] text-[#8b949e]/70 mt-0.5">— Javobsiz</p>
          </div>
        </div>

        <p className="text-sm font-bold mb-3">Savollar</p>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {results.map((r, i) => (
            <button key={r.questionId} onClick={() => onGoToQuestion(i)}
              className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90 ${
                r.status === 'correct'   ? 'bg-green-600 text-white' :
                r.status === 'incorrect' ? 'bg-red-700 text-white'   :
                                           'bg-[#21262d] text-[#8b949e]'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry}
            className="flex-1 py-3.5 rounded-xl bg-[#21262d] text-[#e6edf3] font-semibold flex items-center justify-center gap-2">
            <RotateCcw size={16} />
            Qayta
          </button>
          <button onClick={onFinish}
            className="flex-[2] py-3.5 rounded-xl bg-green-600 text-white font-bold text-base">
            Yakunlash
          </button>
        </div>
      </div>
    </div>
  )
}
