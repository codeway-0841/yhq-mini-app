import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, X } from 'lucide-react'
import { useAdaptiveStore } from '../../shared/store/useAdaptiveStore'
import { useAppStore }      from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT }             from '../../shared/i18n'
import { type SRCard }      from '../../shared/lib/spaced-repetition'

function EFBadge({ card }: { card: SRCard | undefined }) {
  if (!card) return null
  const ef    = card.ef
  const label = ef >= 2.2 ? 'Oson' : ef >= 1.7 ? "O'rta" : 'Qiyin'
  const cls   = ef >= 2.2 ? 'bg-green-900/40 text-green-400'
              : ef >= 1.7 ? 'bg-yellow-900/40 text-yellow-400'
              :              'bg-red-900/40 text-red-400'
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function Option({ id, text, state, onSelect, answered }: {
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

export default function AdaptivePage() {
  const navigate = useNavigate()
  const { settings, addResult } = useAppStore()
  const questions = useQuestionsStore((s) => s.questions)
  const topics    = useQuestionsStore((s) => s.topics)
  const tt = useT(settings.language)

  const { cards, currentId, sessionCount, startSession, submitAnswer } = useAdaptiveStore()

  // Only start a session when the page first mounts with no active question
  useEffect(() => {
    if (currentId === null) startSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const q = questions.find((q) => q.id === currentId)

  // Track which option was selected so we can show correct/wrong feedback
  // before the store advances to the next question.
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  // Reset local selection state whenever the store moves to a new question
  useEffect(() => { setSelectedOption(null) }, [currentId])

  const handleSelect = useCallback((optionId: string) => {
    if (!q || selectedOption !== null) return  // guard double-click
    setSelectedOption(optionId)

    const quality: 0 | 1 = optionId === q.correct ? 1 : 0
    addResult(quality === 1, q.id)

    // Delay store advance by 800 ms so the user sees colour feedback
    setTimeout(() => submitAnswer(q.id, quality), 800)
  }, [q, selectedOption, addResult, submitAnswer])

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-[#8b949e] px-4">
        <Brain size={40} className="text-[#1f6feb]" />
        <p className="text-center text-sm">{tt('adaptiveDesc')}</p>
        <button onClick={() => startSession()} className="bg-[#1f6feb] text-white px-6 py-3 rounded-xl font-bold">
          {tt('adaptive')}
        </button>
      </div>
    )
  }

  const card     = cards[q.id] as SRCard | undefined
  const answered = selectedOption !== null

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <button onClick={() => navigate(-1)} className="text-[#8b949e] p-1"><X size={20} /></button>
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[#1f6feb]" />
          <span className="text-sm font-bold">{tt('adaptiveTitle')}</span>
        </div>
        <span className="text-xs text-[#8b949e]">{sessionCount} {tt('qAnswered')}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[#8b949e]">
            {(() => {
              const topic = topics.find((t) => t.id === q.topicId)
              return topic ? (settings.language === 'ru' ? topic.nameRu : topic.nameUz) : ''
            })()}
          </span>
          <EFBadge card={card} />
        </div>
        <p className="text-base font-semibold leading-snug mb-5">{q.text}</p>
        {q.image && (
          <div className="rounded-xl overflow-hidden mb-4 border border-[#30363d]">
            <img src={q.image} alt={q.text} className="w-full object-cover max-h-52" />
          </div>
        )}
        {q.options.map((opt) => {
          const state: 'correct' | 'wrong' | 'default' =
            !answered          ? 'default' :
            opt.id === q.correct ? 'correct' :
            opt.id === selectedOption ? 'wrong' : 'default'
          return (
            <Option key={opt.id} id={opt.id} text={opt.text}
              state={state} onSelect={() => handleSelect(opt.id)} answered={answered} />
          )
        })}
      </div>
    </div>
  )
}
