/**
 * SearchPage (#45) — savollar + darslik bo'yicha client-side qidiruv.
 * Indeks: useQuestionsStore (fan yuklanganda xotirada) + statik lessons.
 * Network qo'shimcha so'rov YO'Q.
 */

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { X, Search, BookOpen, ListChecks, ChevronLeft } from 'lucide-react'
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
          className="grid size-11 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <div className="flex-1 flex items-center gap-2 rounded-container border border-pline bg-psurface px-3.5">
          <Search size={16} className="text-pmuted flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt('searchPlaceholder')}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-psubtle"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label={tt('backWord')}
              className="text-pmuted hover:text-pfg p-1">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bo'sh natija */}
      {isEmpty && (
        <p className="text-center text-sm text-pmuted py-16">{tt('searchNoResults')}</p>
      )}

      {/* Savollar bo'limi */}
      {hasAny && results.questions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks size={15} className="text-pmuted" />
            <p className="text-xs font-semibold uppercase tracking-wide text-pmuted">
              {tt('searchQuestionsSection')} · {results.questions.length}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {results.questions.map((h) => (
              <button
                key={h.question.id}
                onClick={() => openQuestion(h.question.id, h.question.text)}
                className="w-full text-left rounded-container border border-pline bg-pcard rounded-container p-3.5 active:scale-[0.99] transition-transform"
              >
                <p className="text-sm font-semibold text-pfg leading-snug line-clamp-2 mb-1.5">
                  {h.question.text}
                </p>
                {h.topicName && (
                  <span className="text-[10.5px] font-semibold text-pmuted bg-psurface px-2 py-0.5 rounded-full">
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
            <BookOpen size={15} className="text-pmuted" />
            <p className="text-xs font-semibold uppercase tracking-wide text-pmuted">
              {tt('searchLessonsSection')} · {results.lessons.length}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {results.lessons.map((h) => (
              <button
                key={`${h.moduleId}:${h.lessonIdx}`}
                onClick={() => openLesson(h.moduleId, h.lessonIdx)}
                className="w-full text-left rounded-container border border-pline bg-pcard rounded-container p-3.5 active:scale-[0.99] transition-transform"
              >
                <p className="text-sm font-semibold text-pfg mb-0.5">{h.title}</p>
                <p className="text-[11px] font-semibold text-ppurple mb-1">{h.moduleTitle}</p>
                <p className="text-xs text-pmuted leading-snug line-clamp-2">{h.snippet}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
