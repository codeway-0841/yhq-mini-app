import { Loader2 } from 'lucide-react'
import type { Question } from '../../../shared/api'

/** Raund ekrani — progress, savol va variantlar.
 *  To'g'ri variant FAQAT server ack/reveal'dan ko'rsatiladi (lokal kalit yo'q). */
export function RoundScreen({ tt, q, deadline, roundPct, timeLeft, roundIndex, roundCount,
  oppAnswered, selected, ackCorrect, ackCorrectOptionId, onAnswer }: {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  q: Question | null
  deadline: number | null
  roundPct: number
  timeLeft: number | null
  roundIndex: number
  roundCount: number
  oppAnswered: boolean
  selected: string | null
  ackCorrect: boolean | null
  ackCorrectOptionId: string | null
  onAnswer: (optionId: string) => void
}) {
  if (!q) return <Loader2 size={28} className="text-pprimary animate-spin" />

  return (
    <div className="w-full max-w-md">
      {deadline && (
        <div className="w-full h-1.5 bg-line rounded-full overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-colors duration-300"
            style={{
              width: `${roundPct * 100}%`,
              background: roundPct > 0.5 ? 'var(--p-primary)' : roundPct > 0.25 ? 'var(--p-warning)' : 'var(--p-danger)',
            }}
          />
        </div>
      )}
      <p className="text-xs text-muted mb-1 text-center">
        {tt('round')} {roundIndex + 1} / {roundCount}
        {timeLeft !== null && (
          <span className={`ml-2 font-bold ${timeLeft <= 5 ? 'text-pdanger animate-pulse' : 'text-pblue'}`}>
            ⏱ {timeLeft}s
          </span>
        )}
        {oppAnswered && !selected && (
          <span className="ml-2 text-pwarning">• Raqib javob berdi</span>
        )}
      </p>
      <p className="text-base font-semibold text-center mb-5 leading-snug">{q.text}</p>
      {q.image && (
        <div className="rounded-xl overflow-hidden mb-4 border border-line flex items-center justify-center bg-elevated">
          <img src={q.image} alt="savol" loading="lazy"
            className="max-w-full max-h-[45vh] w-auto h-auto object-contain" />
        </div>
      )}
      {q.options.map((opt) => {
        const answered    = !!selected
        const isSelected  = selected === opt.id
        // To'g'ri variant FAQAT server ack/reveal'dan (lokal kalit yo'q)
        const showCorrect = answered && ackCorrectOptionId !== null && opt.id === ackCorrectOptionId
        const style =
          !answered      ? 'bg-surface border-line text-fg' :
          showCorrect    ? 'bg-psuccess/15 border-psuccess text-fg' :
          isSelected && ackCorrect === true ? 'bg-psuccess/20 border-psuccess text-fg' :
          // Ack hali kelmagan — neutral (qizil "xato" prematurely ko'rsatilmaydi)
          isSelected && ackCorrect === null ? 'bg-[rgb(var(--p-blue-rgb)/0.10)] border-[rgb(var(--p-blue-rgb)/0.60)] text-fg' :
          isSelected    ? 'bg-pdanger/15   border-pdanger   text-fg' :
                          'bg-surface border-line text-muted'
        return (
          <button key={`${q.id}_${opt.id}`} type="button" disabled={answered} onClick={() => onAnswer(opt.id)}
            className={`w-full text-left rounded-xl border p-3.5 mb-2 transition-all focus:outline-none active:scale-[0.98] ${style}`}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full border border-current/30 flex items-center justify-center text-xs font-bold opacity-60 flex-shrink-0">
                {opt.id}
              </span>
              <span className="text-sm">{opt.text}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
