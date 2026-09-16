import { Lock } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { config } from '../../shared/config'
import { api } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { isEffectivePremium, isTicketPremium } from '../../../shared/test-access'
import { useT } from '../../shared/i18n'
import { seededShuffle } from '../../shared/lib/seeded'
import type { Question } from '../../shared/api'

const TICKET_SIZE_YHQ = 20
const TICKET_SIZE_OTHER = 30

interface TicketItem {
  id: number
  title: string
  subtitle?: string
  chapterId?: string
  topicId?: number
  questionCount: number
  questionIds: number[]
}

import { SUBJECT_CHAPTERS, getTopicChapterId, sortTopicsForTickets } from './ticket-chapters'

export default function Biletlar() {
  const [tab, setTab] = useState('all')
  const [selectedChapter, setSelectedChapter] = useState('all')
  const navigate      = useNavigate()
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const settings      = useAppStore((s) => s.settings)
  const tariff        = useAppStore((s) => s.tariff)
  const user          = useAppStore((s) => s.user)
  const tt            = useT(settings.language)
  const isPremium     = isEffectivePremium({ tariff, premiumUntil: user?.premiumUntil })
  const questions        = useQuestionsStore((s) => s.questions)
  const topics           = useQuestionsStore((s) => s.topics)
  const questionsLoading = useQuestionsStore((s) => s.loading)
  const questionsLoaded  = useQuestionsStore((s) => s.loaded)
  const questionsError   = useQuestionsStore((s) => s.error)
  const subjectId        = useSubjectStore((s) => s.subjectId)

  // v2: full-bank YO'Q.
  //   - yhq: global bilet katalogi server manifest'dan (dedup-aniq sonlar);
  //   - boshqa fanlar: per-topic kartalar topics metadata'dan, ochilish server
  //     `topic` selector orqali (alohida ticket endpoint kerak emas — topic
  //     session o'sha bilet mazmuni).
  const isV2 = config.testSessionsV2Enabled
  const isYhq = subjectId === 'yhq'

  const [catalog, setCatalog] = useState<{
    ticketSize: number; ticketCount: number; totalQuestions: number
  } | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [catalogRetry, setCatalogRetry] = useState(0)

  useEffect(() => {
    if (!isV2) return
    let cancelled = false
    setCatalog(null)
    setCatalogFailed(false)
    if (isYhq) {
      api.getTicketCatalog(subjectId, settings.language)
        .then((c) => { if (!cancelled) setCatalog(c) })
        .catch(() => { if (!cancelled) setCatalogFailed(true) })
    } else {
      // Non-yhq katalog — topics metadata (questionCount bilan); tayyorlik
      // store'dagi topics'dan bilinadi, alohida marker shart emas.
      void useQuestionsStore.getState().loadTopics(subjectId)
        .catch(() => { if (!cancelled) setCatalogFailed(true) })
    }
    return () => { cancelled = true }
  }, [isV2, isYhq, subjectId, settings.language, catalogRetry])

  // `questionsError` shartda — TestPage'dagi bilan bir xil cheksiz sikl
  // (izohi useQuestionsStore.failedKey ustida). v2'da full-bank umuman
  // tortilmaydi.
  useEffect(() => {
    if (isV2) return
    if (!questionsLoaded && !questionsLoading && !questionsError) {
      void useQuestionsStore.getState().load(settings.language, subjectId)
    }
  }, [isV2, questionsLoaded, questionsLoading, questionsError, settings.language, subjectId])

  useEffect(() => {
    setSelectedChapter('all')
  }, [subjectId])

  const TABS = isV2
    ? [{ id: 'all',    label: tt('allTab') }]
    : [
        { id: 'all',    label: tt('allTab') },
        { id: 'errors', label: tt('errorsTab') },
      ]

  const isRu = settings.language === 'ru'

  const tickets = useMemo<TicketItem[]>(() => {
    // v2 yhq: server manifest'dan — question ID'siz katalog (delivery
    // TestRoutePage orqali server-owned ticket session). Sonlar dedup haqiqati.
    if (isV2 && isYhq) {
      if (!catalog) return []
      return Array.from({ length: catalog.ticketCount }, (_, i) => ({
        id: i + 1,
        title: `${i + 1} - ${tt('ticketWord')}`,
        questionCount: catalog.ticketSize,
        questionIds: [],
      }))
    }
    // v2 non-yhq: per-topic kartalar metadata'dan (ochilish server topic
    // session — ticketNumber/premium o'rniga topic cap server'da).
    if (isV2) {
      const items: TicketItem[] = []
      for (const topic of sortTopicsForTickets(subjectId, topics)) {
        const count = topic.questionCount ?? 0
        if (count <= 0) continue
        const subtitle = isRu ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu)
        const id = items.length + 1
        items.push({
          id,
          title: `${id} - ${tt('ticketWord')}`,
          subtitle,
          chapterId: getTopicChapterId(subjectId, topic.slug, topic.nameUz),
          topicId: topic.id,
          questionCount: count,
          questionIds: [],
        })
      }
      return items
    }
    if (!questions.length) return []

    // YHQ dan tashqari barcha fanlar uchun mavzulashtirilgan biletlar
    if (subjectId !== 'yhq' && topics.length > 0) {
      const byTopic = new Map<number, Question[]>()
      for (const q of questions) {
        if (q.topicId != null) {
          const list = byTopic.get(q.topicId)
          if (list) list.push(q)
          else byTopic.set(q.topicId, [q])
        }
      }

      const sortedTopics = sortTopicsForTickets(subjectId, topics)

      const result: TicketItem[] = []
      let ticketNum = 1
      for (const topic of sortedTopics) {
        const topicQuestions = byTopic.get(topic.id)
        if (!topicQuestions || topicQuestions.length === 0) continue
        const ordered = [...topicQuestions].sort((a, b) => a.id - b.id)
        const chapterId = getTopicChapterId(subjectId, topic.slug, topic.nameUz)
        const subtitle = isRu ? (topic.nameRu || topic.nameUz) : (topic.nameUz || topic.nameRu)
        result.push({
          id: ticketNum,
          title: `${ticketNum} - ${tt('ticketWord')}`,
          subtitle,
          chapterId,
          topicId: topic.id,
          questionCount: ordered.length,
          questionIds: ordered.map((q) => q.id),
        })
        ticketNum++
      }

      if (result.length > 0) return result
    }

    // YHQ uchun 20 talik, qolgan barcha fanlar uchun 30 talik biletlar (fallback)
    const ticketSize = subjectId === 'yhq' ? TICKET_SIZE_YHQ : TICKET_SIZE_OTHER
    const shuffled = seededShuffle(questions, 42)
    const count = Math.floor(shuffled.length / ticketSize)
    return Array.from({ length: count }, (_, i) => {
      const ids = shuffled.slice(i * ticketSize, (i + 1) * ticketSize).map((q) => q.id)
      return { id: i + 1, title: `${i + 1} - ${tt('ticketWord')}`, questionCount: ids.length, questionIds: ids }
    })
  }, [isV2, isYhq, catalog, questions, topics, subjectId, isRu, tt])

  const tabFiltered = useMemo(() => {
    if (tab === 'errors') {
      return tickets.filter((t) =>
        t.questionIds.some((id) => (wrongByTicket[questionKey(subjectId, id)] ?? 0) > 0)
      )
    }
    return tickets
  }, [tickets, tab, wrongByTicket, subjectId])

  const chapterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tabFiltered.length }
    for (const t of tabFiltered) {
      if (t.chapterId) {
        counts[t.chapterId] = (counts[t.chapterId] || 0) + 1
      }
    }
    return counts
  }, [tabFiltered])

  const subjectChapters = SUBJECT_CHAPTERS[subjectId]

  const filtered = useMemo(() => {
    if (subjectChapters && selectedChapter !== 'all') {
      return tabFiltered.filter((t) => t.chapterId === selectedChapter)
    }
    return tabFiltered
  }, [tabFiltered, subjectChapters, selectedChapter])

  const handleTicket = (ticket: TicketItem) => {
    const title = ticket.subtitle ? `${ticket.title} (${ticket.subtitle})` : ticket.title
    // v2 non-yhq: per-topic karta → server topic session (cap server'da).
    if (isV2 && ticket.topicId !== undefined) {
      navigate('/test/1', {
        state: {
          title,
          mode: 'topic',
          serverSelector: { type: 'topic', topicId: ticket.topicId },
        },
      })
      return
    }
    if (isTicketPremium(ticket.id) && !isPremium) {
      navigate('/premium')
      return
    }
    // Har doim 1-savoldan boshlanadi (avval /test/:id noto'g'ri savolni ochardi).
    // v2: master ID'siz — faqat server selector (TestRoutePage server session ochadi).
    navigate('/test/1', isV2
      ? {
          state: {
            title,
            mode: 'ticket',
            serverSelector: { type: 'ticket', ticketNumber: ticket.id },
          },
        }
      : {
          state: {
            questionIds: ticket.questionIds,
            title,
            mode: 'ticket',
            serverSelector: { type: 'ticket', ticketNumber: ticket.id },
          },
        })
  }

  return (
    <div className="px-4 pb-4">
      <PageHeader title={tt('tickets')} onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="-mx-4 mb-4" />

      <div className="flex gap-2 mb-3 bg-psurface p-1 rounded-2xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-h-11 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-pprimary text-ponprimary shadow-xs' : 'text-pmuted hover:text-pfg'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {subjectChapters && topics.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-4 px-4">
          {subjectChapters.map((ch) => {
            const isSelected = selectedChapter === ch.id
            const count = chapterCounts[ch.id] ?? 0
            if (ch.id !== 'all' && count === 0 && tab === 'errors') return null
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
                className={`whitespace-nowrap px-3 py-1.5 min-h-11 inline-flex items-center rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-pprimary text-ponprimary shadow-xs'
                    : 'bg-psurface text-pmuted hover:text-pfg hover:bg-pcard'
                }`}
              >
                {isRu ? ch.labelRu : ch.labelUz}
                {count > 0 && <span className="ml-1 opacity-75 text-[10.5px]">({count})</span>}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((ticket) => {
          // Badge = bu biletdagi yechilmagan xato savollar soni (urinishlar yig'indisi emas)
          const wrongCount = ticket.questionIds.filter((qid) => (wrongByTicket[questionKey(subjectId, qid)] ?? 0) > 0).length
          const locked = isTicketPremium(ticket.id) && !isPremium
          return (
            <button key={ticket.id} onClick={() => handleTicket(ticket)}
              className="relative flex flex-col items-center justify-center rounded-2xl bg-pcard shadow-xs hover:bg-psurface p-2.5 min-h-[82px] active:scale-95 transition-all overflow-hidden text-center">
              {locked && (
                <span className="absolute top-1.5 left-1.5 text-pwarning" aria-label="Premium">
                  <Lock size={13} strokeWidth={2} />
                </span>
              )}
              {/* Raqamli badge FAQAT "Xatolar" tabinda ko'rinadi (qizil) */}
              {tab === 'errors' && wrongCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-pdanger text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-xs">
                  {wrongCount}
                </span>
              )}
              <span className="text-sm font-bold text-pfg">{ticket.title}</span>
              {ticket.subtitle && (
                <span className="text-[10px] font-medium text-pprimary mt-0.5 max-w-full px-1 truncate line-clamp-1 leading-tight" title={ticket.subtitle}>
                  {ticket.subtitle}
                </span>
              )}
              <span className="text-[10.5px] text-pmuted mt-0.5">{ticket.questionCount} {tt('question')}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-pmuted py-16 text-sm">
          {isV2 && catalogFailed ? (
            <button
              type="button"
              onClick={() => setCatalogRetry((c) => c + 1)}
              className="rounded-2xl bg-psurface px-6 py-3 text-sm font-semibold text-pfg hover:bg-pcard active:scale-[0.98] transition-all shadow-xs"
            >
              {isRu ? 'Повторить' : 'Qayta urinish'}
            </button>
          ) : tab === 'errors' ? tt('noErrors') : tt('loadingDots')}
        </div>
      )}
    </div>
  )
}
