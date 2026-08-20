import { useState } from 'react'
import { X, CheckCircle2, XCircle, HelpCircle, BookOpen, GraduationCap, Check, ZoomIn } from 'lucide-react'
import { useT } from '../../../shared/i18n'
import type { Lang } from '../../../shared/i18n'
import type { Question } from '../../../shared/api'
import { lessons } from '../../../content/lessons'
import lessonMap from '../../../content/lessonMap.yhq.json'
import { useNavigate } from 'react-router-dom'
import ImageZoomModal from '../../../shared/components/ImageZoomModal'
import DialogOverlay from '../../../shared/components/DialogOverlay'

function formatImageSrc(src?: string | null): string | undefined {
  if (!src) return undefined
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/')) {
    return src
  }
  return `/${src}`
}

export interface ExamReviewItem {
  question: Question
  index: number
  status: 'correct' | 'incorrect' | 'unanswered'
  selectedOptionId: string | null
  correctOptionId: string | null
  topicName?: string
}

interface ExamReviewModalProps {
  items: ExamReviewItem[]
  language: Lang
  onClose: () => void
}

export default function ExamReviewModal({ items, language, onClose }: ExamReviewModalProps) {
  const tt = useT(language)
  const navigate = useNavigate()
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const wrongCount = items.filter((it) => it.status === 'incorrect' || it.status === 'unanswered').length
  const [filter, setFilter] = useState<'mistakes' | 'all'>(wrongCount > 0 ? 'mistakes' : 'all')

  const displayedItems = filter === 'mistakes'
    ? items.filter((it) => it.status === 'incorrect' || it.status === 'unanswered')
    : items

  const getLessonLink = (q: Question) => {
    if (!q.topicId) return null
    const map = lessonMap as Record<string, number[]>
    for (const [key, qids] of Object.entries(map)) {
      if (qids.includes(q.id)) {
        const parts = key.split(':')
        const modId = Number(parts[0])
        const lessonIdx = Number(parts[1] ?? 0)
        const lesson = lessons[modId]?.[lessonIdx]
        if (lesson) return { modId, lessonIdx, lesson }
      }
    }
    return null
  }

  return (
    <DialogOverlay onClose={onClose} position="center" labelId="exam-review-title" className="animate-premiumIn" backdropClassName="bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-surface border border-line rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-card/60">
          <div>
            <h3 id="exam-review-title" className="text-base font-black text-fg flex items-center gap-2">
              <BookOpen size={18} className="text-duo-green" />
              {tt('examReviewTitle')}
            </h3>
            <p className="text-xs text-subtle mt-0.5">
              {items.filter((x) => x.status === 'correct').length} {tt('correct')} · {wrongCount} {tt('wrong')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={tt('closeResults')}
            className="w-8 h-8 rounded-full bg-elevated border border-line flex items-center justify-center text-muted hover:text-fg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="p-3 border-b border-line flex gap-2 bg-canvas/40">
          <button
            type="button"
            onClick={() => setFilter('mistakes')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'mistakes'
                ? 'bg-duo-red/15 text-duo-red border border-duo-red/40 shadow-sm'
                : 'text-muted hover:bg-elevated'
            }`}
          >
            {tt('filterOnlyMistakes')} ({wrongCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-duo-green/15 text-duo-green border border-duo-green/40 shadow-sm'
                : 'text-muted hover:bg-elevated'
            }`}
          >
            {tt('filterAllQuestions')} ({items.length})
          </button>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayedItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-duo-green/15 border border-duo-green/40 flex items-center justify-center mx-auto mb-3 text-duo-green">
                <CheckCircle2 size={30} />
              </div>
              <p className="text-sm font-bold text-fg">
                {tt('noMistakesCongrats')}
              </p>
            </div>
          ) : (
            displayedItems.map((item) => {
              const q = item.question
              const lessonInfo = getLessonLink(q)

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-4 bg-card transition-all ${
                    item.status === 'correct'
                      ? 'border-duo-green/30'
                      : item.status === 'incorrect'
                      ? 'border-duo-red/40 bg-duo-red/[0.02]'
                      : 'border-line'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-elevated border border-line text-fg">
                      #{item.index + 1}
                      {item.status === 'correct' && <CheckCircle2 size={13} className="text-duo-green" />}
                      {item.status === 'incorrect' && <XCircle size={13} className="text-duo-red" />}
                      {item.status === 'unanswered' && <HelpCircle size={13} className="text-subtle" />}
                    </span>
                    {item.topicName && (
                      <span className="text-[11px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-line truncate max-w-[200px]">
                        {item.topicName}
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-bold text-fg mb-3 leading-snug">
                    {q.text}
                  </p>

                  {/* Image if available */}
                  {q.image && (
                    <div
                      onClick={() => setZoomedImage(formatImageSrc(q.image) || null)}
                      className="mb-3 rounded-xl overflow-hidden border border-line bg-black/40 flex justify-center relative group cursor-zoom-in active:scale-[0.99] transition-transform"
                    >
                      <img src={formatImageSrc(q.image)} alt={`Question ${item.index + 1}`} className="max-h-48 object-contain" />
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                        <ZoomIn size={10} className="text-duo-purple" />
                        <span>Kattalashtirish</span>
                      </div>
                    </div>
                  )}

                  {/* Options List */}
                  <div className="space-y-1.5 mb-3">
                    {q.options.map((opt) => {
                      const isUserChoice = item.selectedOptionId === opt.id
                      const isCorrect = item.correctOptionId === opt.id

                      let borderStyle = 'border-line bg-elevated/40 text-fg'
                      let badge = null

                      if (isCorrect) {
                        borderStyle = 'border-duo-green/60 bg-duo-green/15 text-fg font-bold'
                        badge = (
                          <span className="text-[10px] font-black text-duo-green flex items-center gap-1 ml-auto flex-shrink-0">
                            <Check size={12} /> {tt('correctAnswerLabel')}
                          </span>
                        )
                      } else if (isUserChoice) {
                        borderStyle = 'border-duo-red/60 bg-duo-red/15 text-duo-red font-bold'
                        badge = (
                          <span className="text-[10px] font-black text-duo-red flex items-center gap-1 ml-auto flex-shrink-0">
                            <X size={12} /> {tt('yourAnswer')}
                          </span>
                        )
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${borderStyle}`}
                        >
                          <span className="w-5 h-5 rounded-md bg-surface border border-line flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {opt.id.toUpperCase()}
                          </span>
                          <span className="flex-1 min-w-0">{opt.text}</span>
                          {badge}
                        </div>
                      )
                    })}
                  </div>

                  {/* Darslik qoidasi / Nega shunday */}
                  {lessonInfo && (
                    <div className="mt-2.5 pt-2.5 border-t border-line/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted truncate">
                        <span className="font-bold text-fg">{tt('ruleExplanation')}: </span>
                        {language === 'ru' ? lessonInfo.lesson.titleRu : lessonInfo.lesson.titleUz}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate('/darslik', {
                            state: { moduleId: lessonInfo.modId, lessonIdx: lessonInfo.lessonIdx },
                          })
                        }}
                        className="flex-shrink-0 text-[11px] font-bold text-duo-green hover:underline flex items-center gap-1"
                      >
                        <GraduationCap size={13} />
                        {tt('openModule')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-line bg-card flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d-green px-6 py-2.5 rounded-xl text-xs font-black"
          >
            {tt('closeResults')}
          </button>
        </div>
      </div>

      {/* Fullscreen image zoom */}
      {zoomedImage && (
        <ImageZoomModal
          src={zoomedImage}
          alt="Savol rasmi"
          onClose={() => setZoomedImage(null)}
        />
      )}
    </DialogOverlay>
  )
}
