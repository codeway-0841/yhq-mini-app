/**
 * Shaxsiy statistika — katta raqamlar + haftalik faollik grafigi + zaif mavzular.
 * Ma'lumotlar: daily history API (server) + wrongByTicket (zaif savollar).
 * Dizayn: v2 premium (card-premium, aksent barlar, Inter).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { BarChart2, Flame, Star, Target, TrendingUp, HeartCrack, ChevronLeft } from 'lucide-react'
import { api, type DailyHistoryRow } from '../../lib/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../store/useSubjectStore'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useDailyStore, todayStr } from '../../store/useDailyStore'
import { parseQuestionKey } from '../../../shared/subjects'

const WEEK_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const WEEK_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function dateAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('sv-SE')
}

export default function StatistikaPage() {
  const navigate = useNavigate()
  const { settings, totalCorrect, totalWrong, totalAnswered, wrongByTicket, user } = useAppStore()
  const subject  = useSubjectStore((s) => s.subject)
  const lang     = settings.language
  const userId   = user?.id

  const streak  = useDailyStore((s) => s.streaks[subject.id] ?? 0)
  const level   = Math.floor(totalCorrect / 50) + 1
  const xp      = totalCorrect * 10
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const [week, setWeek] = useState<DailyHistoryRow[]>([])
  useEffect(() => {
    if (!userId || userId === '0') return
    api.getDailyHistory(userId, todayStr(), subject.id)
      .then((h) => {
        const byDate = new Map(h.rows.map((r) => [r.date, r]))
        setWeek(Array.from({ length: 7 }, (_, i) => {
          const d = dateAgo(6 - i)
          return byDate.get(d) ?? { date: d, subjectId: subject.id, answered: 0, correct: 0, fixed: 0 }
        }))
      })
      .catch(() => {})
  }, [userId, subject.id])

  const maxAnswered = Math.max(1, ...week.map((r) => r.answered))
  const weekTotal   = week.reduce((s, r) => s + r.answered, 0)
  const weekLabels  = lang === 'ru' ? WEEK_RU : WEEK_UZ

  // Zaif mavzular — xato savollar mavzular kesimida (top 3, FAQAT joriy fan)
  const { questions, topics } = useQuestionsStore()
  const weakTopics = useMemo(() => {
    const qById = new Map(questions.map((q) => [q.id, q]))
    const byTopic = new Map<number, number[]>()
    for (const [key, cnt] of Object.entries(wrongByTicket)) {
      if (cnt <= 0) continue
      // Composite kalit '<subjectId>:<qid>' — boshqa fanlar xatolari kirmaydi
      const parsed = parseQuestionKey(key)
      if (!parsed || parsed.subjectId !== subject.id) continue
      const q = qById.get(parsed.questionId)
      if (!q?.topicId) continue
      const arr = byTopic.get(q.topicId) ?? []
      arr.push(parsed.questionId)
      byTopic.set(q.topicId, arr)
    }
    return [...byTopic.entries()]
      .map(([topicId, ids]) => ({
        topic: topics.find((t) => t.id === topicId),
        ids,
      }))
      .filter((x) => x.topic)
      .sort((a, b) => b.ids.length - a.ids.length)
      .slice(0, 3)
  }, [wrongByTicket, questions, topics])

  const practiceWeak = (ids: number[], title: string) =>
    navigate('/test/1', { state: { questionIds: ids, title } })

  return (
    <div className="font-display min-h-screen bg-pcanvas text-pfg pb-10">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-psubtle hover:text-pfg px-1 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <BarChart2 size={18} className="text-ppurple" />
        <h1 className="text-lg font-bold tracking-tight">
          {lang === 'ru' ? 'Статистика' : 'Statistika'}
        </h1>
      </div>

      {/* Katta raqamlar — 2x2 */}
      <div className="grid grid-cols-2 gap-3 px-5 mt-3">
        {[
          { icon: Star,    color: '#facc15', value: xp.toLocaleString(), label: 'XP' },
          { icon: Flame,   color: '#f59e0b', value: `${streak}`,        label: lang === 'ru' ? 'дней подряд' : 'kun seriya' },
          { icon: TrendingUp, color: 'var(--p-primary)', value: `${level}`, label: 'Level' },
          { icon: Target,  color: '#3b82f6', value: `${accuracy}%`,    label: lang === 'ru' ? 'точность' : 'aniqlik' },
        ].map((c, i) => (
          <div key={i} className="card-premium p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 30%, transparent)` }}>
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-[19px] font-bold tracking-tight tabular-nums leading-none">{c.value}</p>
              <p className="text-[10.5px] text-psubtle mt-1">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Haftalik faollik — bar chart */}
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em]">
        {lang === 'ru' ? `Неделя · ${weekTotal} вопросов` : `Hafta · ${weekTotal} savol`}
      </p>
      <div className="mx-5 card-premium p-5">
        <div className="flex items-end justify-between gap-2 h-28">
          {week.map((r) => {
            const pct = r.answered / maxAnswered
            return (
              <div key={r.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-semibold text-psubtle tabular-nums">
                  {r.answered > 0 ? r.answered : ''}
                </span>
                <div className="w-full h-20 rounded-md flex items-end overflow-hidden" style={{ background: 'var(--p-surface)' }}>
                  <div className="w-full rounded-md transition-all duration-500"
                    style={{
                      height: `${Math.max(pct * 100, r.answered > 0 ? 6 : 0)}%`,
                      background: r.answered > 0 ? 'var(--p-primary)' : 'transparent',
                      boxShadow: r.answered > 0 ? '0 0 10px var(--p-glow)' : undefined,
                    }} />
                </div>
                <span className="text-[9.5px] font-semibold text-psubtle">
                  {weekLabels[new Date(r.date + 'T00:00:00').getDay() === 0 ? 6 : new Date(r.date + 'T00:00:00').getDay() - 1]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Zaif mavzular */}
      {weakTopics.length > 0 && (
        <>
          <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
            <HeartCrack size={11} className="text-pdanger" />
            {lang === 'ru' ? 'Слабые темы' : 'Zaif mavzular'}
          </p>
          <div className="card-premium mx-5 divide-y divide-pline">
            {weakTopics.map(({ topic, ids }) => (
              <button key={topic!.id} onClick={() => practiceWeak(ids, lang === 'ru' ? topic!.nameRu : topic!.nameUz)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-elevated transition-colors">
                <span className="flex-1 text-[13px] font-semibold text-pfg truncate">
                  {lang === 'ru' ? topic!.nameRu : topic!.nameUz}
                </span>
                <span className="bg-duo-red/15 border border-duo-red/40 text-duo-red text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  {ids.length}
                </span>
                <span className="text-[11px] font-bold text-psubtle flex-shrink-0">
                  {lang === 'ru' ? 'Повторить' : 'Takrorlash'} ›
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Umumiy */}
      <div className="mx-5 mt-4 card-premium p-4 flex items-center justify-between text-[12px]">
        <span className="text-psubtle">{lang === 'ru' ? 'Всего ответов' : 'Jami javoblar'}</span>
        <span className="font-bold tabular-nums">
          <span className="text-psuccess">{totalCorrect}</span> / <span className="text-pdanger">{totalWrong}</span>
        </span>
      </div>
    </div>
  )
}
