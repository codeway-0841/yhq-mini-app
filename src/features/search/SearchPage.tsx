/**
 * SearchPage (#45) — savollar + darslik bo'yicha client-side qidiruv.
 * Indeks: useQuestionsStore (fan yuklanganda xotirada) + statik lessons.
 * Network qo'shimcha so'rov YO'Q.
 */

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { X, Search, BookOpen, ListChecks } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useT } from '../../shared/i18n'
import { haptics } from '../../platform/haptics'
import { lessons } from '../../content/lessons'
import { modules } from '../../content/modules'
import { searchContent, type SearchResults } from './search-index'

export default function SearchPage() {
  const navigate = useNavigate()
  const tt = useT(useAppStore((s) => s.settings.language))
  const lang = useAppStore((s) => s.settings.language)
  const questions = useQuestionsStore((s) => s.questions)
  const topics = useQuestionsStore((s) => s.topics)

  const [query, setQuery] = useState('')
  // Debounce 200ms — katta massivda (1k+ savol) har klaviaturada heavy filter emas
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const results: SearchResults | null = useMemo(() => {
    if (debounced.trim().length < 2) return null
    return searchContent(debounced, { questions, topics, lessons, modules, lang })
  }, [debounced, questions, topics, lang])

  const openQuestion = (id: number, text: string) => {
    haptics.impact('light')
    navigate('/test/1', {
      state: { questionIds: [id], title: text.length > 60 ? `${text.slice(0, 59)}…` : text },
    })
  }
  const openLesson = (moduleId: number, lessonIdx: number) => {
    haptics.impact('light')
    navigate('/darslik', { state: { moduleId, lessonIdx } })
  }

  const hasAny = results !== null && (results.questions.length > 0 || results.lessons.length > 0)
  const isEmpty = results !== null && !hasAny

  return (
    <div className="px-4 pt-4 pb-6 min-h-screen">
      {/* Header: back + input */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="text-muted hover:text-fg text-xl px-1 transition-colors">←</button>
        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3.5">
          <Search size={16} className="text-muted flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt('searchPlaceholder')}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-subtle"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label={tt('backWord')}
              className="text-muted hover:text-fg p-1">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bo'sh natija */}
      {isEmpty && (
        <p className="text-center text-sm text-muted py-16">{tt('searchNoResults')}</p>
      )}

      {/* Savollar bo'limi */}
      {hasAny && results.questions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks size={15} className="text-muted" />
            <p className="text-xs font-black uppercase tracking-wide text-muted">
              {tt('searchQuestionsSection')} · {results.questions.length}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {results.questions.map((h) => (
              <button
                key={h.question.id}
                onClick={() => openQuestion(h.question.id, h.question.text)}
                className="w-full text-left card-premium rounded-2xl p-3.5 active:scale-[0.99] transition-transform"
              >
                <p className="text-sm font-semibold text-fg leading-snug line-clamp-2 mb-1.5">
                  {h.question.text}
                </p>
                {h.topicName && (
                  <span className="text-[10.5px] font-bold text-muted bg-elevated px-2 py-0.5 rounded-full">
                    {h.topicName}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Darslar bo'limi */}
      {hasAny && results.lessons.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={15} className="text-muted" />
            <p className="text-xs font-black uppercase tracking-wide text-muted">
              {tt('searchLessonsSection')} · {results.lessons.length}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {results.lessons.map((h) => (
              <button
                key={`${h.moduleId}:${h.lessonIdx}`}
                onClick={() => openLesson(h.moduleId, h.lessonIdx)}
                className="w-full text-left card-premium rounded-2xl p-3.5 active:scale-[0.99] transition-transform"
              >
                <p className="text-sm font-bold text-fg mb-0.5">{h.title}</p>
                <p className="text-[11px] font-bold text-ppurple mb-1">{h.moduleTitle}</p>
                <p className="text-xs text-muted leading-snug line-clamp-2">{h.snippet}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
