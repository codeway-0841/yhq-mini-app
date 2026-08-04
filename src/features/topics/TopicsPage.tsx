import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useLessonsStore } from '../../store/useLessonsStore'
import { useT } from '../../shared/i18n'
import { modules } from '../../data/modules'
import { goBack } from '../../lib/navigation'
import { HeartCrack, Lock, Play, Check } from 'lucide-react'

/** Darslik MODULE_TOPICS bilan bir xil mapping — mavzular modul bo'yicha guruhlanadi */
const MODULE_TOPICS: Record<number, string[]> = {
  1: ['yol-belgilari', 'yol-chiziqlari'],
  2: ['chorrahalar'],
  3: ['toxtatish-va-turish'],
  4: ['manyovr', 'quvib-otish', 'signallar'],
  5: ['temir-yol', 'yuk-tashish', 'yolovchi-tashish', 'shatakka-olish', 'avtomagistral', 'sirpanchiq-yol'],
  6: ['tezlik'],
  7: ['piyodalar'],
  8: ['birinchi-tibbiy-yordam', 'texnik-holat', 'yoritish', 'haydovchi-majburiyatlari'],
}

interface TopicRowData {
  id: number; nameUz: string; nameRu: string; slug: string
  questionCount: number; wrongCount: number
}

function ModuleCard({ mod, topics, lang, doneLessons, open, onToggle, onTopic }: {
  mod: typeof modules[number]
  topics: TopicRowData[]
  lang: 'uz' | 'ru'
  doneLessons: number
  open: boolean
  onToggle: () => void
  onTopic: (t: TopicRowData) => void
}) {
  const lessonTotal = mod.lessonCount
  const pct = lessonTotal > 0 ? Math.round((doneLessons / lessonTotal) * 100) : 0
  const name = lang === 'ru' ? mod.titleRu : mod.title

  return (
    <div className="card-neon overflow-hidden">
      {/* Modul sarlavhasi — bosilganda ochiladi/yopiladi */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${mod.color}26`, border: `1px solid ${mod.color}55`, boxShadow: `0 0 14px ${mod.color}55` }}>
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-fg truncate">{name}</p>
          <p className="text-[11px] text-subtle">{topics.length} ta mavzu</p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="text-right">
            <p className="text-[11px] font-black text-fg leading-none">{doneLessons}/{lessonTotal}</p>
            <div className="w-20 h-1.5 rounded-full bg-line mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: mod.color, boxShadow: `0 0 6px ${mod.color}` }} />
            </div>
          </div>
          <span className={`text-subtle transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </div>
      </button>

      {/* Modul ichidagi mavzular */}
      {open && (
        <div className="border-t border-line/50">
          {topics.length === 0 && (
            <p className="text-center text-muted text-xs py-4">{lang === 'ru' ? 'Темы скоро' : 'Mavzular tez kunda'}</p>
          )}
          {topics.map((t) => (
            <button key={t.id} onClick={() => onTopic(t)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-elevated/50 transition-colors active:opacity-80">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: t.wrongCount > 0 ? '#ff4b4b26' : '#38bdf826',
                  border: `1.5px solid ${t.wrongCount > 0 ? '#ff4b4b55' : '#38bdf855'}`,
                }}>
                {t.wrongCount > 0
                  ? <Lock size={14} className="text-duo-red" />
                  : <Play size={14} className="text-neon-blue" fill="#38bdf8" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-fg truncate">{lang === 'ru' ? t.nameRu : t.nameUz}</p>
                <p className="text-[10px] text-subtle">{t.questionCount} {lang === 'ru' ? 'вопросов' : 'savol'}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {t.wrongCount > 0
                  ? <span className="text-[11px] font-black text-duo-red bg-duo-red/15 px-2 py-0.5 rounded-full">{t.wrongCount} ✗</span>
                  : <Check size={17} className="text-duo-green drop-shadow-[0_0_6px_rgba(88,204,2,0.6)]" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopicsPage() {
  const navigate = useNavigate()
  const { settings, wrongByTicket, user } = useAppStore()
  const tt = useT(settings.language)
  const { questions, topics } = useQuestionsStore()
  const lang = settings.language
  const uid = user?.id ?? '0'
  const lessonsProg = useLessonsStore((s) => s.byUser[uid])

  const [openId, setOpenId] = useState<number>(1)   // birinchi modul default ochiq

  // Mavzular savollar soni + xato hisobi bilan
  const topicData = useMemo<TopicRowData[]>(() =>
    topics.map((t) => {
      const qs = questions.filter((q) => q.topicId === t.id)
      const wrongCount = qs.reduce((s, q) => s + ((wrongByTicket[q.id] ?? 0) > 0 ? 1 : 0), 0)
      return { id: t.id, nameUz: t.nameUz, nameRu: t.nameRu, slug: t.slug, questionCount: qs.length, wrongCount }
    }).filter((t) => t.questionCount > 0)
  , [topics, questions, wrongByTicket])

  const totalWrong = useMemo(
    () => Object.values(wrongByTicket).filter((n) => n > 0).length,
    [wrongByTicket]
  )

  const startTopic = (t: TopicRowData) => {
    const ids = questions.filter((q) => q.topicId === t.id).map((q) => q.id)
    navigate('/test/1', { state: { questionIds: ids, title: lang === 'ru' ? t.nameRu : t.nameUz } })
  }

  const startMistakes = () => {
    const ids = questions.filter((q) => (wrongByTicket[q.id] ?? 0) > 0).map((q) => q.id)
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title: tt('fixMistakes') } })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label="Orqaga"
          className="text-subtle hover:text-fg text-xl px-1 transition-colors">←</button>
        <h1 className="text-xl font-black">{tt('topics')}</h1>
      </div>

      {totalWrong > 0 && (
        <button onClick={startMistakes}
          className="flex items-center justify-between w-full bg-red-900/30 border border-red-700/40 rounded-2xl px-4 py-3.5 mb-4 active:scale-[0.98] transition-transform">
          <span className="flex items-center gap-2.5 text-sm font-bold text-red-300">
            <HeartCrack size={18} />
            {tt('fixMistakes')}
          </span>
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {totalWrong}
          </span>
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        {modules.map((mod) => {
          const slugs = MODULE_TOPICS[mod.id] ?? []
          const modTopics = slugs
            .map((slug) => topicData.find((t) => t.slug === slug))
            .filter((t): t is TopicRowData => t != null)
          const doneLessons = (lessonsProg?.[mod.id] ?? []).length
          return (
            <ModuleCard
              key={mod.id}
              mod={mod}
              topics={modTopics}
              lang={lang}
              doneLessons={doneLessons}
              open={openId === mod.id}
              onToggle={() => setOpenId((o) => o === mod.id ? 0 : mod.id)}
              onTopic={startTopic}
            />
          )
        })}
      </div>
    </div>
  )
}
