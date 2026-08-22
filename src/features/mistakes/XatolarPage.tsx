/**
 * Xatolarim — hal qilinmagan xato savollar bilan ishlash sahifasi.
 *
 * wrongByTicket = "hozir YECHILMAGAN xatolar" (to'g'ri javob bersa avtomatik
 * o'chadi — useAppStore.addResult). Sahifa FAQAT joriy fan savollarini
 * filtrlaydi (savol ID'lari fan bankalari orasida takrorlanishi mumkin).
 *
 * Mashq oqimi: umumiy TestPage engine'idagi `questionIds` mexanizmi —
 * to'g'ri javob berilgan savol ro'yxatdan tushib qoladi.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { HeartCrack, Play, ChevronRight, Flame, ChevronLeft } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { useT } from '../../shared/i18n'
import { openTelegramLink } from '../../platform/telegram'
import { Sparkles } from 'lucide-react'

export default function XatolarPage() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS
  const settings      = useAppStore((s) => s.settings)
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const tariff        = useAppStore((s) => s.tariff)
  const isPremium = tariff === 'premium'
  const tt = useT(settings.language)
  const { questions, topics } = useQuestionsStore()
  const subjectId = useSubjectStore((s) => s.subjectId)
  const lang = settings.language

  /** Joriy fan ichidagi hal qilinmagan xato savollar (composite kalit: '<fan>:<qid>') */
  const wrongQuestions = useMemo(
    () => questions.filter((q) => (wrongByTicket[questionKey(subjectId, q.id)] ?? 0) > 0),
    [questions, wrongByTicket, subjectId],
  )
  const total = wrongQuestions.length

  /** Mavzular kesimi (koproq xatosi bor mavzu yuqorida) */
  const byTopic = useMemo(() => {
    const groups = new Map<number, number[]>()
    for (const q of wrongQuestions) {
      if (q.topicId == null) continue
      const arr = groups.get(q.topicId) ?? []
      arr.push(q.id)
      groups.set(q.topicId, arr)
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([topicId, ids]) => {
        const topic = topics.find((t) => t.id === topicId)
        return {
          topicId,
          ids,
          name: topic ? (lang === 'ru' ? topic.nameRu : topic.nameUz) : `#${topicId}`,
        }
      })
  }, [wrongQuestions, topics, lang])

  const startPractice = (ids: number[], title: string) => {
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title } })
  }

  /** Top-10 eng ko'p xato qilingan savollar (xato urinishlari soni badge) */
  const topHard = useMemo(() =>
    wrongQuestions
      .map((q) => ({ q, count: wrongByTicket[questionKey(subjectId, q.id)] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    [wrongQuestions, wrongByTicket, subjectId],
  )

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('mistakesTitle')}</h1>
      </div>

      {/* Bo'sh holat */}
      {total === 0 && (
        <div className="rounded-container border border-pline bg-pcard p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-container bg-pprimary/15 border border-pprimary/40 flex items-center justify-center mb-4">
            <HeartCrack size={30} className="text-pprimary" />
          </div>
          <p className="text-[17px] font-semibold text-pfg">{tt('mistakesEmptyTitle')}</p>
          <p className="text-[12px] text-psubtle mt-1.5">{tt('mistakesEmptyDesc')}</p>
        </div>
      )}

      {total > 0 && (
        <>
          {/* Umumiy holat + "Barchasini mashq qilish" */}
          <div className="rounded-container border border-pline bg-pcard p-4 mb-4">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-11 h-11 rounded-control bg-pdanger/15 border border-pdanger/40 flex items-center justify-center flex-shrink-0">
                <HeartCrack size={20} className="text-pdanger" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[24px] font-semibold text-pfg leading-none">{total}</p>
                <p className="text-[11px] text-psubtle mt-1">{total} {tt('unansweredWord')}</p>
              </div>
            </div>
            <button onClick={() => startPractice(wrongQuestions.map((q) => q.id), tt('fixMistakes'))}
              className="btn-neon w-full py-3.5 rounded-container font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <Play size={16} strokeWidth={1.75} />
              {tt('practiceAll')}
            </button>
          </div>

          {/* Mavzular kesimi + Top-10 tahlil — PREMIUM funksiya */}
          {!isPremium && (
            <button onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')}
              className="rounded-container border border-pline bg-pcard w-full p-4 mb-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
              <div className="w-11 h-11 rounded-control bg-pwarning/15 border border-pwarning/40 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-pwarning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-pfg">{tt('premiumMistakesTitle')}</p>
                <p className="text-[11px] text-psubtle mt-1 leading-snug">{tt('premiumMistakesDesc')}</p>
              </div>
              <span className="bg-pwarning text-black text-[11px] font-semibold px-3 py-1.5 rounded-control flex-shrink-0">
                ⭐250
              </span>
            </button>
          )}
          {isPremium && byTopic.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.12em] mb-1.5">{tt('byTopicsWord')}</p>
              <div className="rounded-container border border-pline bg-pcard overflow-hidden mb-4">
                {byTopic.map((g, i) => (
                  <button key={g.topicId} onClick={() => startPractice(g.ids, g.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-psurface transition-colors ${
                      i > 0 ? 'border-t border-pline/50' : ''}`}>
                    <span className="flex-1 text-[13px] font-semibold text-pfg truncate">{g.name}</span>
                    <span className="bg-pdanger/15 border border-pdanger/40 text-pdanger text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                      {g.ids.length}
                    </span>
                    <span className="text-[11px] font-semibold text-psubtle flex-shrink-0">{tt('practiceWord')} ›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Top-10 eng qiyin savollar */}
          {isPremium && topHard.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5">
                <Flame size={11} className="text-pwarning" />
                {tt('topMistakes')}
              </p>
              <div className="flex flex-col gap-2">
                {topHard.map(({ q, count }, i) => (
                  <button key={q.id} onClick={() => startPractice([q.id], tt('topMistakes'))}
                    className="rounded-container border border-pline bg-pcard p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                    <span className="w-6 text-center text-[12px] font-semibold text-psubtle flex-shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] font-semibold text-pfg leading-snug"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.text}
                    </span>
                    <span className="bg-pwarning/15 border border-pwarning/40 text-pwarning text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                      {count} {tt('timesWord')}
                    </span>
                    <ChevronRight size={15} className="text-psubtle flex-shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
