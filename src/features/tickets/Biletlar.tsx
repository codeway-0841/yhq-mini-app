import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'

const TICKET_SIZE = 20
const TABS = [
  { id: 'all',    label: 'Barchasi' },
  { id: 'errors', label: 'Xatolar'  },
]

export default function Biletlar() {
  const [tab, setTab] = useState('all')
  const navigate      = useNavigate()
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const questions     = useQuestionsStore((s) => s.questions)

  const tickets = useMemo(() => {
    if (!questions.length) return []
    const count = Math.floor(questions.length / TICKET_SIZE)
    return Array.from({ length: count }, (_, i) => {
      const ids = questions.slice(i * TICKET_SIZE, (i + 1) * TICKET_SIZE).map((q) => q.id)
      return { id: i + 1, title: `${i + 1} - bilet`, questionCount: ids.length, questionIds: ids }
    })
  }, [questions])

  const filtered = tickets.filter((t) => {
    if (tab === 'errors') return (wrongByTicket[t.id] || 0) > 0
    return true
  })

  const handleTicket = (ticket: typeof tickets[0]) => {
    navigate(`/test/${ticket.id}`, {
      state: { questionIds: ticket.questionIds, title: ticket.title, ticketId: ticket.id },
    })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-xl font-black mb-4">Biletlar</h1>

      <div className="flex gap-2 mb-4 bg-[#161b22] p-1 rounded-xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {filtered.map((ticket) => (
          <button key={ticket.id} onClick={() => handleTicket(ticket)}
            className="relative flex flex-col items-center justify-center rounded-2xl border border-[#30363d] bg-[#161b22] p-3 min-h-[72px] active:scale-95 transition-transform overflow-hidden">
            <span className="text-sm font-bold">{ticket.title}</span>
            <span className="text-[10px] text-[#8b949e] mt-0.5">{ticket.questionCount} ta</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-[#8b949e] py-16 text-sm">
          {tab === 'errors' ? "Xato yo'q — yaxshi natija!" : 'Yuklanmoqda...'}
        </div>
      )}
    </div>
  )
}
