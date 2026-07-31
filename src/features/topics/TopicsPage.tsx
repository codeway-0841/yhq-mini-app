import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'

interface TopicMeta { id: number; name: string; ids: number[] }

export default function TopicsPage() {
  const navigate = useNavigate()
  const { settings, wrongByTicket } = useAppStore()
  const tt = useT(settings.language)
  const { questions, topics } = useQuestionsStore()

  const topicMeta = useMemo<TopicMeta[]>(() =>
    topics.map(t => ({
      id: t.id,
      name: settings.language === 'ru' ? t.nameRu : t.nameUz,
      ids: questions.filter(q => q.topicId === t.id).map(q => q.id),
    })).filter(t => t.ids.length > 0)
  , [topics, questions, settings.language])

  const wrongCount = useMemo(
    () => Object.values(wrongByTicket).reduce((s, n) => s + n, 0),
    [wrongByTicket]
  )

  const start = (topic: TopicMeta) => {
    navigate('/test/1', { state: { questionIds: topic.ids, title: topic.name } })
  }

  const startMistakes = () => {
    const ids = questions.filter((q) => (wrongByTicket[q.id] ?? 0) > 0).map((q) => q.id)
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title: tt('fixMistakes') } })
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} aria-label="Orqaga"
          className="text-[#8b949e] hover:text-white text-xl px-1">←</button>
        <h1 className="text-xl font-black">{tt('topics')}</h1>
      </div>

      {wrongCount > 0 && (
        <button onClick={startMistakes}
          className="flex items-center justify-between w-full bg-red-900/30 border border-red-700/40 rounded-2xl px-4 py-3.5 mb-4">
          <span className="text-sm font-bold text-red-300">{tt('fixMistakes')}</span>
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {wrongCount}
          </span>
        </button>
      )}

      <div className="flex flex-col gap-2">
        {topicMeta.map((topic) => (
          <button key={topic.id} onClick={() => start(topic)}
            className="flex items-center justify-between bg-[#161b22] border border-[#30363d] rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform">
            <span className="text-sm font-semibold text-left">{topic.name}</span>
            <span className="text-xs text-[#8b949e] ml-3 flex-shrink-0">{topic.ids.length} ta</span>
          </button>
        ))}
      </div>
    </div>
  )
}
