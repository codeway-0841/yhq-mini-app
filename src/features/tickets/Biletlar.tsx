import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import { seededShuffle } from '../../lib/seeded'

const TICKET_SIZE = 20

export default function Biletlar() {
  const [tab, setTab] = useState('all')
  const navigate      = useNavigate()
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const settings      = useAppStore((s) => s.settings)
  const tt            = useT(settings.language)
  const questions     = useQuestionsStore((s) => s.questions)

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
    if (tab === 'errors') return t.questionIds.some((id) => (wrongByTicket[id] ?? 0) > 0)
    return true
  })

  const handleTicket = (ticket: typeof tickets[0]) => {
    // Har doim 1-savoldan boshlanadi (avval /test/:id noto'g'ri savolni ochardi)
    navigate('/test/1', {
      state: { questionIds: ticket.questionIds, title: ticket.title },
    })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="text-muted hover:text-white text-xl px-1">←</button>
        <h1 className="text-xl font-black">{tt('tickets')}</h1>
      </div>

      <div className="flex gap-2 mb-4 bg-surface p-1 rounded-xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-duo-blue text-white' : 'text-muted hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {filtered.map((ticket) => {
          // Badge = bu biletdagi yechilmagan xato savollar soni (urinishlar yig'indisi emas)
          const wrongCount = ticket.questionIds.filter((qid) => (wrongByTicket[qid] ?? 0) > 0).length
          return (
            <button key={ticket.id} onClick={() => handleTicket(ticket)}
              className="relative flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-3 min-h-[72px] active:scale-95 transition-transform overflow-hidden">
              {/* Raqamli badge FAQAT "Xatolar" tabinda ko'rinadi (qizil) */}
              {tab === 'errors' && wrongCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {wrongCount}
                </span>
              )}
              <span className="text-sm font-bold">{ticket.title}</span>
              <span className="text-[10px] text-muted mt-0.5">{ticket.questionCount} {tt('question')}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted py-16 text-sm">
          {tab === 'errors' ? tt('noErrors') : tt('loadingDots')}
        </div>
      )}
    </div>
  )
}
