/**
 * Smart / Adaptive test page.
 * Uses SM-2 spaced repetition — harder cards appear more often.
 */

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, X } from 'lucide-react'
import { useAdaptiveStore } from '../store/useAdaptiveStore'
import { useAppStore }       from '../store/useAppStore'
import { questions }         from '../data/questions'
import { useT }              from '../lib/i18n'
import { type SRCard }       from '../lib/spaced-repetition'

// ── Difficulty badge ───────────────────────────────────────────────────────
function EFBadge({ card }: { card: SRCard | undefined }) {
  if (!card) return null
  const ef = card.ef
  const label = ef >= 2.2 ? 'Oson' : ef >= 1.7 ? "O'rta" : 'Qiyin'
  const cls   = ef >= 2.2 ? 'bg-green-900/40 text-green-400'
              : ef >= 1.7 ? 'bg-yellow-900/40 text-yellow-400'
              :              'bg-red-900/40 text-red-400'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  )
}

// ── Option button ──────────────────────────────────────────────────────────
function Option({
  id, text, state, onSelect, answered,
}: {
  id: string; text: string
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void; answered: boolean
}) {
  const base  = 'w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.98]'
  const style =
    state === 'correct' ? 'bg-green-900/60 border-green-500 text-white' :
    state === 'wrong'   ? 'bg-red-900/60   border-red-500   text-white' :
                          'bg-[#161b22] border-[#30363d] text-[#e6edf3]'

  return (
    <button className={`${base} ${style} mb-2`} onClick={onSelect} disabled={answered}>
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full border border-current/30 flex items-center justify-center text-xs font-bold opacity-60 flex-shrink-0">
          {id}
        </span>
        <span className="text-sm">{text}</span>
        {state === 'correct' && <span className="ml-auto text-green-400 font-bold">✓</span>}
        {state === 'wrong'   && <span className="ml-auto text-red-400   font-bold">✗</span>}
      </div>
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdaptivePage() {
  const navigate = useNavigate()
  const { settings, addResult } = useAppStore()
  const tt = useT(settings.language)

  const {
    cards, currentId, sessionCount,
    startSession, submitAnswer,
  } = useAdaptiveStore()

  useEffect(() => { startSession() }, [startSession])

  const q = questions.find((q) => q.id === currentId)

  const handleSelect = useCallback((optionId: string) => {
    if (!q) return
    const correct = q.correct
    const quality: 0 | 1 = optionId === correct ? 1 : 0
    addResult(quality === 1, undefined)
    submitAnswer(q.id, quality)
  }, [q, addResult, submitAnswer])

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-[#8b949e] px-4">
        <Brain size={40} className="text-[#1f6feb]" />
        <p className="text-center text-sm">{tt('adaptiveDesc')}</p>
        <button
          onClick={() => startSession()}
          className="bg-[#1f6feb] text-white px-6 py-3 rounded-xl font-bold"
        >
          Boshlash
        </button>
      </div>
    )
  }

  const card = cards[q.id] as SRCard | undefined

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={() => navigate(-1)} className="text-[#8b949e] p-1">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[#1f6feb]" />
          <span className="text-sm font-bold">{tt('adaptiveTitle')}</span>
        </div>
        <span className="text-xs text-[#8b949e]">{sessionCount} {tt('qAnswered')}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[#8b949e]">{q.topic}</span>
          <EFBadge card={card} />
        </div>

        <p className="text-base font-semibold leading-snug mb-5">{q.text}</p>

        {q.image && (
          <div className="rounded-xl overflow-hidden mb-4 border border-[#30363d]">
            <img src={q.image} alt="" className="w-full object-cover max-h-52" />
          </div>
        )}

        {/* Each answer immediately advances to the next question via submitAnswer,
            so there is no "answered" state to track here. */}
        {q.options.map((opt) => (
          <Option
            key={opt.id}
            id={opt.id}
            text={opt.text}
            state="default"
            onSelect={() => handleSelect(opt.id)}
            answered={false}
          />
        ))}
      </div>
    </div>
  )
}
