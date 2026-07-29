/**
 * Topics page — list all topics, tap to start a topic-filtered test.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { questions } from '../data/questions'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../lib/i18n'

interface TopicMeta {
  name:  string
  count: number
  ids:   number[]
}

export default function TopicsPage() {
  const navigate = useNavigate()
  const { settings, wrongByTicket } = useAppStore()
  const tt = useT(settings.language)

  const topics = useMemo<TopicMeta[]>(() => {
    const map = new Map<string, number[]>()
    for (const q of questions) {
      if (!map.has(q.topic)) map.set(q.topic, [])
      map.get(q.topic)!.push(q.id)
    }
    return [...map.entries()].map(([name, ids]) => ({ name, count: ids.length, ids }))
  }, [])

  const wrongCount = useMemo(() => {
    return Object.values(wrongByTicket).reduce((s, n) => s + n, 0)
  }, [wrongByTicket])

  const start = (topic: TopicMeta) => {
    navigate('/test/1', {
      state: { questionIds: topic.ids, title: topic.name },
    })
  }

  const startMistakes = () => {
    const ids = questions
      .filter((q) => (wrongByTicket[q.id] ?? 0) > 0)
      .map((q) => q.id)
    if (ids.length === 0) return
    navigate('/test/1', { state: { questionIds: ids, title: tt('fixMistakes') } })
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-xl font-black mb-4">{tt('topics')}</h1>

      {/* Mistakes shortcut */}
      {wrongCount > 0 && (
        <button
          onClick={startMistakes}
          className="flex items-center justify-between w-full bg-red-900/30 border border-red-700/40 rounded-2xl px-4 py-3.5 mb-4"
        >
          <span className="text-sm font-bold text-red-300">{tt('fixMistakes')}</span>
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {wrongCount}
          </span>
        </button>
      )}

      {/* Topic list */}
      <div className="flex flex-col gap-2">
        {topics.map((topic) => (
          <button
            key={topic.name}
            onClick={() => start(topic)}
            className="flex items-center justify-between bg-[#161b22] border border-[#30363d] rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-semibold text-left">{topic.name}</span>
            <span className="text-xs text-[#8b949e] ml-3 flex-shrink-0">
              {topic.count} ta
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
