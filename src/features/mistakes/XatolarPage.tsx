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
import { goBack } from '../../lib/navigation'
import { HeartCrack, Play, ChevronRight, Flame } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import { openTelegramLink } from '../../lib/telegram'
import { Sparkles } from 'lucide-react'

export default function XatolarPage() {
  const navigate = useNavigate()
  const { settings, wrongByTicket, tariff } = useAppStore()
  const isPremium = tariff === 'premium'
  const tt = useT(settings.language)
  const { questions, topics } = useQuestionsStore()
  const lang = settings.language

  /** Joriy fan ichidagi hal qilinmagan xato savollar */
  const wrongQuestions = useMemo(
    () => questions.filter((q) => (wrongByTicket[q.id] ?? 0) > 0),
    [questions, wrongByTicket],
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
      .map((q) => ({ q, count: wrongByTicket[q.id] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    [wrongQuestions, wrongByTicket],
  )

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="text-subtle hover:text-fg text-xl px-1 transition-colors">←</button>
        <h1 className="text-xl font-black">{tt('mistakesTitle')}</h1>
      </div>

      {/* Bo'sh holat */}
      {total === 0 && (
        <div className="card-neon p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-duo-green/15 border border-duo-green/40 flex items-center justify-center mb-4">
            <HeartCrack size={30} className="text-duo-green" />
          </div>
          <p className="text-[17px] font-black text-fg">{tt('mistakesEmptyTitle')}</p>
          <p className="text-[12px] text-subtle mt-1.5">{tt('mistakesEmptyDesc')}</p>
        </div>
      )}

      {total > 0 && (
        <>
          {/* Umumiy holat + "Barchasini mashq qilish" */}
          <div className="card-neon p-4 mb-4">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-duo-red/15 border border-duo-red/40 flex items-center justify-center flex-shrink-0">
                <HeartCrack size={20} className="text-duo-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[24px] font-black text-fg leading-none">{total}</p>
                <p className="text-[11px] text-subtle mt-1">{total} {tt('unansweredWord')}</p>
              </div>
            </div>
            <button onClick={() => startPractice(wrongQuestions.map((q) => q.id), tt('fixMistakes'))}
              className="btn-neon w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <Play size={16} fill="currentColor" />
              {tt('practiceAll')}
            </button>
          </div>

          {/* Mavzular kesimi + Top-10 tahlil — PREMIUM funksiya */}
          {!isPremium && (
            <button onClick={() => openTelegramLink('https://t.me/kiwi_uz_bot?start=premium')}
              className="card-neon w-full p-4 mb-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
              <div className="w-11 h-11 rounded-xl bg-duo-yellow/15 border border-duo-yellow/40 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-duo-yellow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-fg">{tt('premiumMistakesTitle')}</p>
                <p className="text-[11px] text-subtle mt-1 leading-snug">{tt('premiumMistakesDesc')}</p>
              </div>
              <span className="bg-duo-yellow text-black text-[11px] font-black px-3 py-1.5 rounded-xl flex-shrink-0">
                ⭐250
              </span>
            </button>
          )}
          {isPremium && byTopic.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-subtle uppercase tracking-[0.12em] mb-1.5">{tt('byTopicsWord')}</p>
              <div className="card-neon overflow-hidden mb-4">
                {byTopic.map((g, i) => (
                  <button key={g.topicId} onClick={() => startPractice(g.ids, g.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-elevated transition-colors ${
                      i > 0 ? 'border-t border-line/50' : ''}`}>
                    <span className="flex-1 text-[13px] font-semibold text-fg truncate">{g.name}</span>
                    <span className="bg-duo-red/15 border border-duo-red/40 text-duo-red text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      {g.ids.length}
                    </span>
                    <span className="text-[11px] font-bold text-subtle flex-shrink-0">{tt('practiceWord')} ›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Top-10 eng qiyin savollar */}
          {isPremium && topHard.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-subtle uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5">
                <Flame size={11} className="text-duo-yellow" />
                {tt('topMistakes')}
              </p>
              <div className="flex flex-col gap-2">
                {topHard.map(({ q, count }, i) => (
                  <button key={q.id} onClick={() => startPractice([q.id], tt('topMistakes'))}
                    className="card-neon p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                    <span className="w-6 text-center text-[12px] font-black text-subtle flex-shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] font-semibold text-fg leading-snug"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.text}
                    </span>
                    <span className="bg-duo-yellow/15 border border-duo-yellow/40 text-duo-yellow text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      {count} {tt('timesWord')}
                    </span>
                    <ChevronRight size={15} className="text-lineStrong flex-shrink-0" />
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
