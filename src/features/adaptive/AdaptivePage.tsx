import { useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { Brain, X, Check, CalendarClock } from 'lucide-react'
import { useAdaptiveStore } from '../../shared/store/useAdaptiveStore'
import { useAnswerTimer } from '../../shared/hooks/useAnswerTimer'
import { useAppStore }      from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT }             from '../../shared/i18n'
import { api }              from '../../shared/api'
import { type SRCard }      from '../../shared/lib/spaced-repetition'
import { shuffleArray }     from '../../shared/lib/seeded'

/** SR dashboard xulosasi (#46) — server javob shakli */
type CardsSummary = { total: number; dueNow: number; dueNext24h: number; dueNext7d: number; avgEf: number | null }

function EFBadge({ card }: { card: SRCard | undefined }) {
  if (!card) return null
  const ef    = card.ef
  const label = ef >= 2.2 ? 'Oson' : ef >= 1.7 ? "O'rta" : 'Qiyin'
  const cls   = ef >= 2.2 ? 'bg-psuccess/12 text-psuccess'
              : ef >= 1.7 ? 'bg-pwarning/12 text-pwarning'
              :              'bg-pdanger/12 text-pdanger'
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function Option({ id, text, state, onSelect, answered, label }: {
  id: string; text: string
  state: 'correct' | 'wrong' | 'default'
  onSelect: () => void; answered: boolean
  label?: string
}) {
  const base  = 'w-full text-left rounded-control border p-3.5 transition-all active:scale-[0.98]'
  const style =
    state === 'correct' ? 'bg-psuccess/15 border-psuccess text-pfg' :
    state === 'wrong'   ? 'bg-pdanger/15   border-pdanger   text-pfg' :
                          'bg-psurface border-pline text-pfg'
  return (
    <button className={`${base} ${style} mb-2`} onClick={onSelect} disabled={answered}>
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full border border-current/30 flex items-center justify-center text-xs font-semibold opacity-60 flex-shrink-0">
          {label ?? id.toUpperCase()}
        </span>
        <span className="text-sm">{text}</span>
        {state === 'correct' && <Check size={16} strokeWidth={2} className="ml-auto flex-shrink-0 text-psuccess" />}
        {state === 'wrong'   && <X size={16} strokeWidth={2} className="ml-auto flex-shrink-0 text-pdanger" />}
      </div>
    </button>
  )
}

export default function AdaptivePage() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS (har counter o'zgarishida re-render bo'lmasligi uchun)
  const user     = useAppStore((s) => s.user)
  const settings = useAppStore((s) => s.settings)
  const submitAnswer = useAppStore((s) => s.submitAnswer)
  const questions = useQuestionsStore((s) => s.questions)
  const topics    = useQuestionsStore((s) => s.topics)
  const tt = useT(settings.language)

  const { currentId, sessionCount, startSession, recordAnswer, advanceNext } = useAdaptiveStore()
  const subjectId = useSubjectStore((s) => s.subjectId)

  // SR dashboard xulosasi (#46) — "bugun tayyorlar" soni va prognoz
  const [summary, setSummary] = useState<CardsSummary | null>(null)

  // Mount paytida bulutdan kartalarni sinxronlash va sessiyani boshlash
  useEffect(() => {
    if (user?.id) {
      void useAdaptiveStore.getState().syncCardsFromServer(user.id, subjectId)
      api.getCardsSummary(user.id, subjectId)
        .then((r) => setSummary(r.summary))
        .catch(() => {}) // offline — karta shunchaki ko'rinmaydi
    } else {
      setSummary(null)
    }
    if (currentId === null && sessionCount === 0) startSession()
  }, [user?.id, subjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // SR karta — subject bo'yicha lookup (hook early-return'dan OLDIN bo'lishi shart!)
  const card = useAdaptiveStore((s) =>
    s.currentId !== null ? s.cardsBySubject[subjectId]?.[s.currentId] : undefined
  ) as SRCard | undefined

  const q = questions.find((q) => q.id === currentId)
  // Javob vaqti (ms) — savol almashganda qayta boshlanadi (statistika uchun)
  const answerTimer = useAnswerTimer(currentId)

  // Track which option was selected so we can show correct/wrong feedback
  // before the store advances to the next question.
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  /** Server reveal — javob kaliti client'da yo'q, faqat server ochadi */
  const [revealed, setRevealed] = useState<string | null>(null)

  // Reset local selection state whenever the store moves to a new question
  useEffect(() => { setSelectedOption(null); setRevealed(null) }, [currentId])

  const handleSelect = useCallback((optionId: string) => {
    if (!q || selectedOption !== null) return  // guard double-click
    setSelectedOption(optionId)

    void (async () => {
      // ASYNC FEEDBACK: to'g'rilikni SERVER hal qiladi.
      const outcome = await submitAnswer(q.id, optionId, answerTimer.elapsed())
      // Fatal (4xx) — server rad etdi, javob saqlanmadi; reveal yo'q
      // (xato-feedback TestPage'da; adaptive oqimi davom etadi).
      const scored = outcome && !('fatal' in outcome) ? outcome : null
      // Offline'da (outcome=null) quality "xato" deb konservativ yoziladi —
      // server flush paytida haqiqiy natija progress'ga tushadi.
      const quality: 0 | 1 = scored?.correct ? 1 : 0
      if (scored) {
        setRevealed(scored.correctAnswer)
        haptics.notify(scored.correct ? 'success' : 'error')
        playSound(scored.correct ? 'success' : 'error')
      }
      recordAnswer(q.id, quality, user?.id)   // karta DARHOL + outbox bulut sinxroni

      // Faqat vizual feedback (yashil/qizil rang) uchun 800ms kechikish, keyin keyingi savol
      setTimeout(() => advanceNext(), 800)
    })()
  }, [q, selectedOption, submitAnswer, recordAnswer, advanceNext, user?.id, answerTimer])

  const currentOptions = useMemo(() => {
    if (!q?.options) return []
    return settings?.shuffleOptions ? shuffleArray(q.options) : q.options
  }, [q?.options, settings?.shuffleOptions])

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-8 gap-4 text-pmuted px-4">
        <Brain size={40} className="text-pprimary" />
        <p className="text-center text-sm">{tt('adaptiveDesc')}</p>

        {/* SR dashboard — bugun tayyorlar + prognoz (#46) */}
        {summary && summary.total > 0 && (
          <div className="rounded-container border border-pline bg-pcard rounded-container p-4 w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock size={15} className="text-pprimary" />
              <p className="text-xs font-semibold text-pfg">
                {summary.total} {tt('srTotalCards').toLowerCase()}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-control bg-psuccess/10 py-2">
                <p className="text-lg font-semibold text-psuccess tabular-nums">{summary.dueNow}</p>
                <p className="text-[10px] font-semibold text-pmuted">{tt('srDueNow')}</p>
              </div>
              <div className="rounded-control bg-pwarning/10 py-2">
                <p className="text-lg font-semibold text-pwarning tabular-nums">{summary.dueNext24h}</p>
                <p className="text-[10px] font-semibold text-pmuted">{tt('srNext24h')}</p>
              </div>
              <div className="rounded-control bg-psurface py-2">
                <p className="text-lg font-semibold text-pfg tabular-nums">{summary.dueNext7d}</p>
                <p className="text-[10px] font-semibold text-pmuted">{tt('srNext7d')}</p>
              </div>
            </div>
          </div>
        )}

        <button onClick={() => startSession()} className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-[120ms] px-8 py-3.5 rounded-container text-base">
          {tt('adaptive')}
        </button>
      </div>
    )
  }

  const answered = selectedOption !== null

  return (
    <div className="flex flex-col bg-pcanvas">
      <div className="flex items-center justify-between px-4 py-3 border-b border-pline">
        <button onClick={() => goBack(navigate)} className="text-pmuted p-1"><X size={20} /></button>
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-ppurple" />
          <span className="text-sm font-semibold">{tt('adaptiveTitle')}</span>
        </div>
        <span className="text-xs text-pmuted">{sessionCount} {tt('qAnswered')}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-pmuted">
            {(() => {
              const topic = topics.find((t) => t.id === q.topicId)
              return topic ? (settings.language === 'ru' ? topic.nameRu : topic.nameUz) : ''
            })()}
          </span>
          <EFBadge card={card} />
        </div>
        <p className="text-base font-semibold leading-snug mb-5">{q.text}</p>
        {q.image && (
          <div className="rounded-control overflow-hidden mb-4 border border-pline flex items-center justify-center bg-psurface">
            <img src={q.image} alt={q.text} loading="lazy"
              className="max-w-full max-h-[55vh] w-auto h-auto object-contain" />
          </div>
        )}
        {currentOptions.map((opt, i) => {
          const state: 'correct' | 'wrong' | 'default' =
            !answered            ? 'default' :
            revealed && opt.id === revealed ? 'correct' :
            revealed && opt.id === selectedOption ? 'wrong' :
            'default'
          return (
            <Option key={`${q.id}_${opt.id}`} id={opt.id} label={String.fromCharCode(65 + i)} text={opt.text}
              state={state} onSelect={() => handleSelect(opt.id)} answered={answered} />
          )
        })}
      </div>
    </div>
  )
}
