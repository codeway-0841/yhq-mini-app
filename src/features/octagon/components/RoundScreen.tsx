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
        <div className="w-full h-1.5 bg-pline rounded-full overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-colors duration-300"
            style={{
              width: `${roundPct * 100}%`,
              background: roundPct > 0.5 ? 'var(--p-primary)' : roundPct > 0.25 ? 'var(--p-warning)' : 'var(--p-danger)',
            }}
          />
        </div>
      )}
      <p className="text-xs text-pmuted mb-1 text-center">
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
      <p className="text-base font-semibold text-center mb-5 leading-snug text-pfg">{q.text}</p>
      {q.image && (
        <div className="rounded-xl overflow-hidden mb-4 border border-pline flex items-center justify-center bg-pcard">
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
          !answered      ? 'bg-pcard text-pfg hover:bg-psurface shadow-xs' :
          showCorrect    ? 'bg-psuccess/15 ring-2 ring-psuccess text-pfg shadow-xs' :
          isSelected && ackCorrect === true ? 'bg-psuccess/20 ring-2 ring-psuccess text-pfg shadow-xs' :
          // Ack hali kelmagan — neutral (qizil "xato" prematurely ko'rsatilmaydi)
          isSelected && ackCorrect === null ? 'bg-[rgb(var(--p-blue-rgb)/0.10)] ring-2 ring-pblue text-pfg shadow-xs' :
          isSelected    ? 'bg-pdanger/15 ring-2 ring-pdanger text-pfg shadow-xs' :
                          'bg-psurface text-pmuted shadow-xs'
        return (
          <button key={`${q.id}_${opt.id}`} type="button" disabled={answered} onClick={() => onAnswer(opt.id)}
            className={`w-full text-left rounded-2xl p-3.5 mb-2.5 transition-all focus:outline-none active:scale-[0.98] ${style}`}>
            <div className="flex items-center gap-3">
              <span className="size-7 rounded-xl bg-psurface flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-2xs">
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
