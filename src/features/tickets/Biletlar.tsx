import { ChevronLeft } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { useT } from '../../shared/i18n'
import { seededShuffle } from '../../shared/lib/seeded'

const TICKET_SIZE = 20

export default function Biletlar() {
  const [tab, setTab] = useState('all')
  const navigate      = useNavigate()
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const settings      = useAppStore((s) => s.settings)
  const tt            = useT(settings.language)
  const questions        = useQuestionsStore((s) => s.questions)
  const questionsLoading = useQuestionsStore((s) => s.loading)
  const questionsLoaded  = useQuestionsStore((s) => s.loaded)
  const questionsError   = useQuestionsStore((s) => s.error)
  const subjectId        = useSubjectStore((s) => s.subjectId)

  // `questionsError` shartda — TestPage'dagi bilan bir xil cheksiz sikl
  // (izohi useQuestionsStore.failedKey ustida).
  useEffect(() => {
    if (!questionsLoaded && !questionsLoading && !questionsError) {
      void useQuestionsStore.getState().load(settings.language, subjectId)
    }
  }, [questionsLoaded, questionsLoading, questionsError, settings.language, subjectId])

  const TABS = [
    { id: 'all',    label: tt('allTab') },
    { id: 'errors', label: tt('errorsTab') },
  ]

  const tickets = useMemo(() => {
    if (!questions.length) return []
    // 300 savol RANDOM tartibda biletlarga taqsimlanadi (seed bilan barqaror)
    const shuffled = seededShuffle(questions, 42)
    const count = Math.floor(shuffled.length / TICKET_SIZE)
    return Array.from({ length: count }, (_, i) => {
      const ids = shuffled.slice(i * TICKET_SIZE, (i + 1) * TICKET_SIZE).map((q) => q.id)
      return { id: i + 1, title: `${i + 1} - ${tt('ticketWord')}`, questionCount: ids.length, questionIds: ids }
    })
  }, [questions, tt])
  const filtered = tickets.filter((t) => {
    if (tab === 'errors') return t.questionIds.some((id) => (wrongByTicket[questionKey(subjectId, id)] ?? 0) > 0)
    return true
  })

  const handleTicket = (ticket: typeof tickets[0]) => {
    // Har doim 1-savoldan boshlanadi (avval /test/:id noto'g'ri savolni ochardi)
    navigate('/test/1', {
      state: { questionIds: ticket.questionIds, title: ticket.title },
    })
  }

  return (
    <div className="px-4 pb-4">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        <h1 className="text-xl font-semibold">{tt('tickets')}</h1>
      </header>

      <div className="flex gap-2 mb-4 bg-psurface p-1 rounded-2xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-pprimary text-ponprimary shadow-xs' : 'text-pmuted hover:text-pfg'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {filtered.map((ticket) => {
          // Badge = bu biletdagi yechilmagan xato savollar soni (urinishlar yig'indisi emas)
          const wrongCount = ticket.questionIds.filter((qid) => (wrongByTicket[questionKey(subjectId, qid)] ?? 0) > 0).length
          return (
            <button key={ticket.id} onClick={() => handleTicket(ticket)}
              className="relative flex flex-col items-center justify-center rounded-2xl bg-pcard shadow-xs hover:bg-psurface p-3 min-h-[72px] active:scale-95 transition-all overflow-hidden text-center">
              {/* Raqamli badge FAQAT "Xatolar" tabinda ko'rinadi (qizil) */}
              {tab === 'errors' && wrongCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-pdanger text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-xs">
                  {wrongCount}
                </span>
              )}
              <span className="text-sm font-bold text-pfg">{ticket.title}</span>
              <span className="text-[10.5px] text-pmuted mt-0.5">{ticket.questionCount} {tt('question')}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-pmuted py-16 text-sm">
          {tab === 'errors' ? tt('noErrors') : tt('loadingDots')}
        </div>
      )}
    </div>
  )
}
