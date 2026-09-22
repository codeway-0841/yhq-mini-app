import React, { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  X,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Bookmark,
  Send,
  Zap,
  Award,
  RotateCcw,
  ScrollText,
  GalleryVerticalEnd,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { WonderSectionNotebookIcon } from './WonderIcons'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { useAppStore } from '../../../shared/store/useAppStore'
import { streamSocraticChat } from '../../../shared/lib/tutor'
import { speak, stopSpeaking, isSpeaking, subscribeSpeaking } from '../../../shared/lib/speech'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderLessonNode, FsrsRating, WonderCourse } from '../types'
import type { AiCourseAnswers } from '../../../../shared/ai-courses'
import WonderStreakCelebrationModal from './WonderStreakCelebrationModal'

interface WonderLessonViewProps {
  lesson: WonderLessonNode
  course: WonderCourse
  onClose: () => void
}

/**
 * Text formatter with interactive keyword popovers:
 * Converts `[[term|definition]]` into clickable interactive keyword spans.
 */
function MarkdownWithKeywords({
  text,
  onSelectKeyword,
}: {
  text: string
  onSelectKeyword: (kw: { word: string; definition: string }) => void
}) {
  const elements = useMemo(() => {
    const parts: ReactNode[] = []
    const regex = /\[\[(.*?)\|(.*?)\]\]/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      const word = match[1]
      const definition = match[2]
      parts.push(
        <button
          key={`${word}-${match.index}`}
          type="button"
          onClick={() => onSelectKeyword({ word, definition })}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-400/25 dark:bg-amber-400/20 text-amber-950 dark:text-amber-200 font-bold border-b-2 border-amber-500 hover:bg-amber-400/40 active:scale-95 transition-all text-xs sm:text-sm cursor-pointer"
        >
          {word}
          <HelpCircle size={10} className="ml-1 opacity-70" />
        </button>,
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts
  }, [text, onSelectKeyword])

  return <div className="leading-relaxed whitespace-pre-line">{elements}</div>
}

/**
 * 1:1 LessonTextSelectionMenu (Wondering bundle lines 7894465 & 5991715)
 * Displays a floating [ ✨ Ask AI Tutor ] action above highlighted text.
 */
function LessonTextSelectionMenu({
  containerRef,
  onExplain,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  onExplain: (selectedText: string) => void
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setMenuPos(null)
        setSelectedText('')
        return
      }

      const text = sel.toString().trim()
      if (text.length < 3) {
        setMenuPos(null)
        return
      }

      try {
        const range = sel.getRangeAt(0)
        if (
          containerRef.current &&
          containerRef.current.contains(range.commonAncestorContainer)
        ) {
          const rect = range.getBoundingClientRect()
          setMenuPos({
            top: rect.top - 8,
            left: rect.left + rect.width / 2,
          })
          setSelectedText(text)
        } else {
          setMenuPos(null)
        }
      } catch {
        setMenuPos(null)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [containerRef])

  if (!menuPos || !selectedText) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: `${menuPos.top}px`,
        left: `${menuPos.left}px`,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onExplain(selectedText)
          setMenuPos(null)
          window.getSelection()?.removeAllRanges()
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-mono font-bold shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <Sparkles size={12} className="text-sky-400" />
        <span>Ask AI Tutor</span>
      </button>
    </div>
  )
}

/**
 * 1:1 Segmented Horizontal Progress Indicator from Wondering bundle line 7853100
 */
function ProgressIndicator({
  totalPages,
  currentPageIndex,
  onPageClick,
}: {
  totalPages: number
  currentPageIndex: number
  onPageClick: (idx: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5 h-1.5 w-full max-w-sm mx-auto">
      {Array.from({ length: totalPages }).map((_, idx) => {
        const isPassed = idx < currentPageIndex
        const isCurrent = idx === currentPageIndex
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onPageClick(idx)}
            title={`Step ${idx + 1}`}
            className={`h-full rounded-full flex-1 transition-all duration-300 cursor-pointer ${
              isPassed
                ? 'bg-emerald-500'
                : isCurrent
                  ? 'bg-[#59B2E6] dark:bg-[#38BDF8]'
                  : 'bg-[#ECE7DC] dark:bg-stone-800'
            }`}
          />
        )
      })}
    </div>
  )
}

/**
 * 1:1 Concept Visual Diagram component for both Paged and Scroll mode
 */
function LessonVisualItem({
  visual,
}: {
  visual: NonNullable<WonderLessonNode['pages'][0]['visual']>
}) {
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number | null>(0)
  const [selectedComparisonIndex, setSelectedComparisonIndex] = useState<number | null>(null)

  return (
    <div className="my-6 p-4 sm:p-5 rounded-3xl bg-[#FAF8F2] dark:bg-[#1E1512] border border-[#E7E2D6] dark:border-stone-800 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
          {visual.title}
        </div>
        {visual.type === 'cycle' && (
          <span className="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">
            Bosqichni tanlang
          </span>
        )}
      </div>

      {visual.type === 'cycle' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {visual.items?.map((item, idx) => {
              const isSelected = selectedCycleIndex === idx
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    haptics.selection()
                    setSelectedCycleIndex(idx)
                  }}
                  className={`p-3.5 rounded-2xl transition-all cursor-pointer border text-center ${
                    isSelected
                      ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 shadow-xs ring-2 ring-sky-400/20'
                      : 'bg-white dark:bg-stone-800/80 border-[#E7E2D6] dark:border-stone-700 hover:border-stone-400 shadow-2xs'
                  }`}
                >
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold mb-1.5 transition-colors ${
                      isSelected
                        ? 'bg-[#0284C7] text-white'
                        : 'bg-[#E0F2FE] text-[#0284C7]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {item.label}
                  </div>
                  {item.desc && (
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                      {item.desc}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active Cycle Step Detail Callout */}
          {selectedCycleIndex !== null && visual.items && visual.items[selectedCycleIndex] && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-900/60 shadow-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 mb-1">
                <span className="size-5 rounded-full bg-sky-500 text-white text-[11px] font-black flex items-center justify-center">
                  {selectedCycleIndex + 1}
                </span>
                <span className="text-xs font-bold text-sky-900 dark:text-sky-300">
                  {visual.items[selectedCycleIndex].label}
                </span>
              </div>
              {visual.items[selectedCycleIndex].desc ? (
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-7">
                  {visual.items[selectedCycleIndex].desc}
                </p>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400 italic pl-7">
                  Ushbu bosqich butun jarayonning asosiy tayanchi hisoblanadi.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {visual.type === 'comparison' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visual.items?.map((item, idx) => {
            const isSelected = selectedComparisonIndex === idx
            return (
              <div
                key={item.label}
                onClick={() => {
                  haptics.selection()
                  setSelectedComparisonIndex(isSelected ? null : idx)
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 ring-2 ring-sky-400/20'
                    : 'bg-white dark:bg-stone-800/80 border-[#E7E2D6] dark:border-stone-700 hover:border-stone-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0284C7] dark:text-[#38BDF8]">
                    {item.label}
                  </span>
                  {item.value !== undefined && (
                    <span className="text-[11px] font-mono font-bold text-stone-500">
                      {item.value}%
                    </span>
                  )}
                </div>
                <span className="text-xs text-stone-600 dark:text-stone-300 mt-1 block leading-snug">
                  {item.desc || `${item.value}%`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {(visual.type === 'chart' || visual.type === 'diagram') && (
        <div className="space-y-2">
          {visual.items?.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span>{item.label}</span>
                <span>{item.value}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <div
                  className="h-full bg-[#59B2E6]"
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {visual.caption && (
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-3 italic text-center">
          {visual.caption}
        </p>
      )}
    </div>
  )
}

/**
 * Authentic Wondering Pedagogy Cards: Hook, Meaning, Objective, and Likely Confusion
 */
function LessonPedagogyCards({
  hook,
  meaning,
  objective,
  likelyConfusion,
}: {
  hook?: string
  meaning?: string
  objective?: string
  likelyConfusion?: string
}) {
  if (!hook && !meaning && !objective && !likelyConfusion) return null

  return (
    <div className="w-full max-w-xl mx-auto text-left space-y-3 my-6 animate-in fade-in duration-200">
      {hook && (
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-100 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
            <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Ziddiyatli Savol (The Hook)</span>
          </div>
          <p className="text-sm sm:text-base font-serif italic leading-relaxed">
            &ldquo;{hook}&rdquo;
          </p>
        </div>
      )}

      {(objective || meaning) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {objective && (
            <div className="p-3.5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/30 text-stone-800 dark:text-stone-200 shadow-2xs">
              <div className="text-[11px] font-mono font-bold uppercase text-sky-700 dark:text-sky-300 mb-1 flex items-center gap-1">
                <span>🎯</span>
                <span>Dars Maqsadi</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">
                {objective}
              </p>
            </div>
          )}
          {meaning && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-stone-800 dark:text-stone-200 shadow-2xs">
              <div className="text-[11px] font-mono font-bold uppercase text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                <span>💡</span>
                <span>Nega Bu Muhim?</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">
                {meaning}
              </p>
            </div>
          )}
        </div>
      )}

      {likelyConfusion && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 text-stone-800 dark:text-stone-200 shadow-2xs">
          <div className="text-[11px] font-mono font-bold uppercase text-rose-700 dark:text-rose-300 mb-1 flex items-center gap-1">
            <span>⚠️</span>
            <span>Keng Tarqalgan Xato Tasavvur</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed">
            {likelyConfusion}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * 1:1 Knowledge Check Practice Component for both Paged and Scroll mode
 */
function LessonQuizSection({
  quiz,
  likelyConfusion,
  selectedOptionId,
  selectedCloze,
  selectedBoolean,
  userOrderIds = [],
  onMoveStep,
  isCardFlipped = false,
  onFlipCard,
  flashcardRating = null,
  onRateFlashcard,
  quizSubmitted,
  quizCorrect,
  onSelectOption,
  onSelectCloze,
  onSelectBoolean,
}: {
  quiz: WonderLessonNode['quiz']
  likelyConfusion?: string
  selectedOptionId: string | null
  selectedCloze: string | null
  selectedBoolean: boolean | null
  userOrderIds?: string[]
  onMoveStep?: (fromIdx: number, toIdx: number) => void
  isCardFlipped?: boolean
  onFlipCard?: () => void
  flashcardRating?: 'again' | 'good' | null
  onRateFlashcard?: (rating: 'again' | 'good') => void
  quizSubmitted: boolean
  quizCorrect: boolean
  onSelectOption: (id: string) => void
  onSelectCloze: (cloze: string) => void
  onSelectBoolean: (val: boolean) => void
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <span className="px-2.5 py-1 rounded-md bg-amber-400/25 text-amber-900 dark:text-amber-200 text-xs font-black uppercase tracking-wide">
          Knowledge Check
        </span>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-2 leading-snug">
          {quiz.question}
        </h2>
      </div>

      {/* MCQ Options */}
      {quiz.type === 'mcq' && (
        <div className="space-y-3 pt-2">
          {quiz.options?.map((opt) => {
            const isSelected = selectedOptionId === opt.id
            const isCorrectOption = opt.id === quiz.correctOptionId

            let cardStyle =
              'bg-white dark:bg-[#1C1411] border-[#E7E2D6] dark:border-stone-800 hover:border-stone-400'
            if (quizSubmitted) {
              if (isCorrectOption) {
                cardStyle =
                  'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-semibold'
              } else if (isSelected && !isCorrectOption) {
                cardStyle =
                  'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-100'
              }
            } else if (isSelected) {
              cardStyle =
                'bg-[#E0F2FE] dark:bg-[#0C4A6E]/40 border-[#0284C7] text-stone-900 dark:text-stone-100 font-semibold shadow-xs'
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={quizSubmitted}
                onClick={() => {
                  playSound('click')
                  onSelectOption(opt.id)
                }}
                className={`w-full p-4 rounded-2xl border-2 text-left text-sm sm:text-base transition-all flex items-start gap-3.5 cursor-pointer ${cardStyle}`}
              >
                <span className="size-7 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center shrink-0 text-xs font-bold">
                  {opt.id.slice(-1).toUpperCase()}
                </span>
                <span className="flex-1 leading-snug pt-0.5">{opt.text}</span>
                {quizSubmitted && isCorrectOption && (
                  <CheckCircle2
                    size={20}
                    className="text-emerald-500 shrink-0 mt-0.5"
                  />
                )}
                {quizSubmitted && isSelected && !isCorrectOption && (
                  <XCircle
                    size={20}
                    className="text-red-500 shrink-0 mt-0.5"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Cloze Fill-In */}
      {quiz.type === 'cloze' && (
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700 text-base font-medium">
            {quiz.clozeTemplate?.replace(
              '{{blank}}',
              selectedCloze ? `[ ${selectedCloze} ]` : '_______',
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {quiz.clozeOptions?.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={quizSubmitted}
                onClick={() => {
                  playSound('click')
                  onSelectCloze(opt)
                }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  selectedCloze === opt
                    ? 'bg-[#59B2E6] border-[#2B8FD0] text-[#261312] shadow-[0_2px_0_0_#2B8FD0]'
                    : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:border-stone-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Order Reorder Steps */}
      {quiz.type === 'order' && quiz.orderSteps && (
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
            Bosqichlarni to'g'ri tartibda joylashtiring:
          </div>
          {userOrderIds.map((stepId, index) => {
            const stepObj = quiz.orderSteps?.find((s) => s.id === stepId)
            const isCorrectPosition = quizSubmitted && quiz.correctOrderIds?.[index] === stepId
            const isWrongPosition = quizSubmitted && quiz.correctOrderIds?.[index] !== stepId

            return (
              <div
                key={stepId}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                  quizSubmitted
                    ? isCorrectPosition
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-950 dark:text-red-100'
                    : 'bg-white dark:bg-[#1C1411] border-[#E7E2D6] dark:border-stone-800 shadow-2xs'
                }`}
              >
                <span className="size-7 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm sm:text-base font-medium leading-snug">
                  {stepObj?.text}
                </span>
                {!quizSubmitted && onMoveStep && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveStep(index, index - 1)}
                      className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-all cursor-pointer"
                      title="Yuqoriga"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === userOrderIds.length - 1}
                      onClick={() => onMoveStep(index, index + 1)}
                      className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-all cursor-pointer"
                      title="Pastga"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                )}
                {quizSubmitted && isCorrectPosition && (
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                )}
                {quizSubmitted && isWrongPosition && (
                  <XCircle size={20} className="text-red-500 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 3D Flashcard Flip */}
      {quiz.type === 'flashcard' && (
        <div className="space-y-4 pt-2">
          <div
            onClick={onFlipCard}
            className="cursor-pointer group relative min-h-[200px] rounded-3xl p-6 border-2 transition-all duration-300 shadow-sm flex flex-col justify-between select-none bg-gradient-to-br from-[#FFFDF8] to-[#F5EFE6] dark:from-[#1C1411] dark:to-[#140D0B] border-[#E7E2D6] dark:border-stone-800 hover:border-amber-400"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5">
                  <Sparkles size={12} />
                  <span>{isCardFlipped ? 'Javob & Asosiy Model' : 'Faol Eslash (Active Recall)'}</span>
                </span>
                <span className="text-xs font-mono text-stone-400 flex items-center gap-1">
                  <RotateCcw size={12} />
                  <span>Aylantirish uchun bosing</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100 leading-snug">
                {isCardFlipped
                  ? (quiz.flashcardAnswer || quiz.explanation)
                  : (quiz.flashcardPrompt || quiz.question)}
              </h3>
            </div>
            <div className="mt-6 pt-4 border-t border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-500 italic text-center">
              {isCardFlipped
                ? "Tub mexanizm tushunarlimi? O'z bilmingizni baholang."
                : 'Kartani bosib javobni tekshiring.'}
            </div>
          </div>

          {isCardFlipped && !quizSubmitted && onRateFlashcard && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={() => onRateFlashcard('again')}
                className={`p-3.5 rounded-2xl border font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  flashcardRating === 'again'
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                }`}
              >
                <span>❌ Eslay olmadim</span>
              </button>
              <button
                type="button"
                onClick={() => onRateFlashcard('good')}
                className={`p-3.5 rounded-2xl border font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  flashcardRating === 'good'
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span>✅ Oson esladim</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Boolean True/False */}
      {quiz.type === 'boolean' && (
        <div className="grid grid-cols-2 gap-4 pt-2">
          {[true, false].map((val) => {
            const isSelected = selectedBoolean === val
            return (
              <button
                key={String(val)}
                type="button"
                disabled={quizSubmitted}
                onClick={() => {
                  playSound('click')
                  onSelectBoolean(val)
                }}
                className={`p-5 rounded-2xl font-bold text-sm sm:text-base border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#59B2E6] border-[#2B8FD0] text-[#261312] shadow-[0_3px_0_0_#2B8FD0]'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                }`}
              >
                {val ? 'TRUE' : 'FALSE'}
              </button>
            )
          })}
        </div>
      )}

      {/* Explanation card after submit */}
      {quizSubmitted && (() => {
        const lang = useAppStore.getState().settings.language || 'uz'
        const correctText =
          lang === 'ru'
            ? 'Правильный ответ! Знания закреплены.'
            : lang === 'uz'
              ? "To'g'ri javob! Bilim mustahkamlandi."
              : 'Great job! Concept reinforced.'
        const reviewText =
          lang === 'ru'
            ? 'Обратите внимание:'
            : lang === 'uz'
              ? "Fikrga e'tibor bering:"
              : 'Core intuition to review:'

        return (
          <div
            className={`p-4 rounded-2xl border animate-in fade-in duration-200 ${
              quizCorrect
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-1">
              {quizCorrect ? (
                <>
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>{correctText}</span>
                </>
              ) : (
                <>
                  <RotateCcw size={18} className="text-amber-600" />
                  <span>{reviewText}</span>
                </>
              )}
            </div>
            {!quizCorrect && likelyConfusion && (
              <div className="my-2 p-2.5 rounded-xl bg-rose-500/15 dark:bg-rose-950/40 border border-rose-500/30 text-rose-950 dark:text-rose-200 text-xs text-left">
                <div className="font-bold flex items-center gap-1 mb-0.5 text-rose-700 dark:text-rose-300">
                  <span>⚠️</span>
                  <span>Ehtimoliy chalg'ituvchi stereotip:</span>
                </div>
                <p className="italic">{likelyConfusion}</p>
              </div>
            )}
            <p className="text-xs sm:text-sm leading-relaxed mt-1">
              {quiz.explanation}
            </p>
          </div>
        )
      })()}
    </div>
  )
}

export default function WonderLessonView({
  lesson,
  course,
  onClose,
}: WonderLessonViewProps) {
  const completeLesson = useWonderStore((s) => s.completeLesson)
  const wonderStreak = useWonderStore((s) => s.wonderStreak)
  const addLessonNote = useWonderStore((s) => s.addLessonNote)
  const toggleNotesDrawer = useWonderStore((s) => s.toggleNotesDrawer)

  const readingContentRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const discussAbortRef = useRef<AbortController | null>(null)

  // Step indexes:
  // 0: Intro screen (1:1 with Wondering bundle line 7888000)
  // 1..totalPages: Reading theory pages (lesson.pages[currentPageIndex - 1])
  // totalPages + 1: Practice / Quiz
  // totalPages + 2: Completion summary
  const totalPages = lesson.pages.length
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isScrollMode, setIsScrollMode] = useState(false)
  const [completedInScrollMode, setCompletedInScrollMode] = useState(false)
  const startTimeRef = useRef(Date.now())
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0)

  // Flatten course lessons to find 1-based lesson index
  const lessonNumber = useMemo(() => {
    if (!course?.sections) return 1
    const flat = course.sections.flatMap((s) => s.lessons)
    const idx = flat.findIndex((l) => l.id === lesson.id)
    return idx >= 0 ? idx + 1 : 1
  }, [course, lesson.id])

  // Bookmark / saved status
  const [isSaved, setIsSaved] = useState(false)

  // Quiz state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [selectedCloze, setSelectedCloze] = useState<string | null>(null)
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null)
  const [userOrderIds, setUserOrderIds] = useState<string[]>(() => {
    if (lesson.quiz.type === 'order' && lesson.quiz.orderSteps) {
      return lesson.quiz.orderSteps.map((s) => s.id)
    }
    return []
  })
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [flashcardRating, setFlashcardRating] = useState<'again' | 'good' | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizCorrect, setQuizCorrect] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [rewardInfo, setRewardInfo] = useState<{
    xpEarned: number
    coinsEarned: number
  } | null>(null)

  // Reset quiz state when lesson changes
  useEffect(() => {
    if (lesson.quiz.type === 'order' && lesson.quiz.orderSteps) {
      setUserOrderIds(lesson.quiz.orderSteps.map((s) => s.id))
    } else {
      setUserOrderIds([])
    }
    setIsCardFlipped(false)
    setFlashcardRating(null)
    setSelectedOptionId(null)
    setSelectedCloze(null)
    setSelectedBoolean(null)
    setQuizSubmitted(false)
    setQuizCorrect(false)
  }, [lesson.id, lesson.quiz])

  // Socratic AI Companion Discuss Drawer
  const [isDiscussOpen, setIsDiscussOpen] = useState(false)
  const [discussMessages, setDiscussMessages] = useState<
    Array<{ sender: 'user' | 'assistant'; text: string }>
  >([
    {
      sender: 'assistant',
      text: `Salom! Men Wondering AI yo'l ko'rsatuvchisiman. "${lesson.title}" bo'yicha tushunmagan joylaringizni bemalol so'rang!`,
    },
  ])
  const [discussInput, setDiscussInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // Keyword tooltip / drawer state
  const [activeKeyword, setActiveKeyword] = useState<{
    word: string
    definition: string
  } | null>(null)

  // Determine current step type
  const isIntroStep = currentPageIndex === 0 && !isScrollMode
  const isTheoryStep = currentPageIndex >= 1 && currentPageIndex <= totalPages && !isScrollMode
  const isQuizStep = currentPageIndex === totalPages + 1 && !isScrollMode
  const isCompletionStep = currentPageIndex === totalPages + 2 || completedInScrollMode

  // Current theory page (when in theory steps)
  const currentTheoryPage = isTheoryStep ? lesson.pages[currentPageIndex - 1] : null

  // Speech Synthesis Narration (TTS)
  const [isSpeechActive, setIsSpeechActive] = useState(false)
  const [audioSpeed, setAudioSpeed] = useState<1.0 | 1.25 | 1.5>(1.0)

  // Touch Swipe Navigation Refs
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeSpeaking(() => {
      setIsSpeechActive(isSpeaking())
    })
    return () => {
      unsubscribe()
      stopSpeaking()
    }
  }, [])

  // Stop speech when changing steps or scroll mode
  useEffect(() => {
    stopSpeaking()
  }, [currentPageIndex, isScrollMode])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      discussAbortRef.current?.abort()
    }
  }, [])

  // Scroll to top on step change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentPageIndex])

  const getLessonSpeechText = () => {
    let rawText = ''
    if (isScrollMode) {
      rawText = `${lesson.title}. ${lesson.tldr || ''}\n`
      for (const page of lesson.pages) {
        rawText += `${page.title}. ${page.content}\n`
      }
    } else if (isIntroStep) {
      rawText = `${lesson.title}. ${lesson.tldr || ''}`
    } else if (isTheoryStep && currentTheoryPage) {
      rawText = `${currentTheoryPage.title}. ${currentTheoryPage.content}`
    } else if (isQuizStep) {
      rawText = `Savol: ${lesson.quiz.question}. `
      if (lesson.quiz.type === 'mcq' && lesson.quiz.options) {
        rawText += lesson.quiz.options
          .map((o, idx) => `Variant ${String.fromCharCode(65 + idx)}: ${o.text}`)
          .join('. ')
      }
    }

    return rawText
      .replace(/\[\[(.*?)\|(.*?)\]\]/g, '$1')
      .replace(/[#*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const toggleAudioNarration = () => {
    haptics.selection()
    if (isSpeechActive) {
      stopSpeaking()
      return
    }

    const cleanText = getLessonSpeechText()
    if (!cleanText) return

    const lang = useAppStore.getState().settings.language === 'ru' ? 'ru' : 'uz'
    speak(cleanText, lang, audioSpeed)
  }

  const handleCycleAudioSpeed = () => {
    haptics.selection()
    const nextSpeed: 1.0 | 1.25 | 1.5 =
      audioSpeed === 1.0 ? 1.25 : audioSpeed === 1.25 ? 1.5 : 1.0
    setAudioSpeed(nextSpeed)
    if (isSpeechActive) {
      stopSpeaking()
      const cleanText = getLessonSpeechText()
      if (cleanText) {
        const lang = useAppStore.getState().settings.language === 'ru' ? 'ru' : 'uz'
        speak(cleanText, lang, nextSpeed)
      }
    }
  }

  const handleNextPage = () => {
    haptics.impact('light')
    if (currentPageIndex < totalPages + 1) {
      setCurrentPageIndex((prev) => prev + 1)
    }
  }

  const handlePrevPage = () => {
    haptics.impact('light')
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1)
    }
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isScrollMode || isQuizStep || isCompletionStep) return
    if (e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX
      touchStartYRef.current = e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (
      isScrollMode ||
      isQuizStep ||
      isCompletionStep ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null
    ) {
      return
    }

    if (e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current
      touchStartXRef.current = null
      touchStartYRef.current = null

      // Require horizontal swipe to dominate over vertical scroll (threshold 50px)
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
        if (deltaX < 0 && currentPageIndex < totalPages + 1) {
          handleNextPage()
        } else if (deltaX > 0 && currentPageIndex > 0) {
          handlePrevPage()
        }
      }
    }
  }

  const handleMoveStep = (fromIdx: number, toIdx: number) => {
    if (quizSubmitted) return
    haptics.selection()
    setUserOrderIds((prev) => {
      if (fromIdx < 0 || fromIdx >= prev.length || toIdx < 0 || toIdx >= prev.length) {
        return prev
      }
      const updated = [...prev]
      const [moved] = updated.splice(fromIdx, 1)
      updated.splice(toIdx, 0, moved)
      return updated
    })
  }

  const handleFlipCard = () => {
    haptics.selection()
    playSound('click')
    setIsCardFlipped((prev) => !prev)
  }

  const handleRateFlashcard = (rating: 'again' | 'good') => {
    haptics.impact('light')
    playSound('click')
    setFlashcardRating(rating)
  }

  const handleQuizSubmit = () => {
    haptics.impact('medium')
    let isCorrect = false
    if (lesson.quiz.type === 'mcq') {
      isCorrect = selectedOptionId === lesson.quiz.correctOptionId
    } else if (lesson.quiz.type === 'cloze') {
      isCorrect =
        selectedCloze?.trim().toLowerCase() ===
        lesson.quiz.clozeAnswer?.trim().toLowerCase()
    } else if (lesson.quiz.type === 'boolean') {
      isCorrect = selectedBoolean === lesson.quiz.booleanCorrect
    } else if (lesson.quiz.type === 'order') {
      const correct = lesson.quiz.correctOrderIds || []
      isCorrect =
        userOrderIds.length > 0 &&
        correct.length === userOrderIds.length &&
        userOrderIds.every((id, idx) => id === correct[idx])
    } else if (lesson.quiz.type === 'flashcard') {
      isCorrect = flashcardRating === 'good'
    }

    playSound(isCorrect ? 'success' : 'error')
    setQuizCorrect(isCorrect)
    setQuizSubmitted(true)
  }

  const handleFinishFsrs = (rating: FsrsRating = 'good') => {
    const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
    setSessionElapsedSeconds(elapsed)
    setIsCompleting(true)
    // Build structured answer payload for backend sync
    const userAnswers: AiCourseAnswers = {
      flashcard: {},
      mcq: {},
      cloze: {},
      order: {},
    }

    if (lesson.quiz.type === 'mcq' && selectedOptionId) {
      if (lesson.rawPractices && lesson.rawPractices.length > 0) {
        for (const p of lesson.rawPractices) {
          if (p.kind === 'mcq') userAnswers.mcq[p.id] = selectedOptionId
        }
      } else {
        userAnswers.mcq[lesson.quiz.question] = selectedOptionId
      }
    } else if (lesson.quiz.type === 'cloze' && selectedCloze) {
      if (lesson.rawPractices && lesson.rawPractices.length > 0) {
        for (const p of lesson.rawPractices) {
          if (p.kind === 'cloze' && Array.isArray(p.blanks)) {
            userAnswers.cloze[p.id] = {}
            for (const b of p.blanks) {
              userAnswers.cloze[p.id][b.id] = selectedCloze
            }
          }
        }
      }
    } else if (lesson.quiz.type === 'order' && userOrderIds.length > 0) {
      if (lesson.rawPractices && lesson.rawPractices.length > 0) {
        for (const p of lesson.rawPractices) {
          if (p.kind === 'order') userAnswers.order[p.id] = userOrderIds
        }
      } else {
        userAnswers.order[lesson.quiz.question] = userOrderIds
      }
    } else if (lesson.quiz.type === 'flashcard' && flashcardRating) {
      const ratingVal = flashcardRating === 'good' ? 'known' : 'unknown'
      if (lesson.rawPractices && lesson.rawPractices.length > 0) {
        for (const p of lesson.rawPractices) {
          if (p.kind === 'flashcard') userAnswers.flashcard[p.id] = ratingVal
        }
      } else {
        userAnswers.flashcard[lesson.quiz.question] = ratingVal
      }
    }

    const result = completeLesson(
      lesson.id,
      rating,
      lesson.xp,
      lesson.coins,
      userAnswers,
      lesson.rawPractices,
    )
    setRewardInfo(result)

    if (result.xpEarned > 0 || result.coinsEarned > 0) {
      playSound('coins')
      useAppStore.setState((s) => ({
        xp: s.xp + result.xpEarned,
        coins: s.coins + result.coinsEarned,
      }))
    }

    setTimeout(() => {
      setIsCompleting(false)
      setShowStreakModal(true)
    }, 350)
  }

  // Socratic chat trigger from text selection or question input
  const handleSendDiscuss = async (queryText?: string) => {
    const textToSend = (queryText || discussInput).trim()
    if (!textToSend || isStreaming) return

    setDiscussMessages((prev) => [...prev, { sender: 'user', text: textToSend }])
    if (!queryText) setDiscussInput('')
    setIsStreaming(true)

    discussAbortRef.current?.abort()
    const controller = new AbortController()
    discussAbortRef.current = controller

    const language = useAppStore.getState().settings.language || 'uz'
    const socraticMessages = discussMessages
      .slice(-4)
      .map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }))
      .concat([{ role: 'user', content: textToSend }])

    const aiMsgIdx = discussMessages.length + 1
    setDiscussMessages((prev) => [...prev, { sender: 'assistant', text: '' }])

    let accumulated = ''
    try {
      const contextParts = [
        currentTheoryPage
          ? `Sahifa: ${currentTheoryPage.title}\n${currentTheoryPage.content}`
          : `Dars: ${lesson.title}\n${lesson.tldr || ''}`,
      ]
      if (lesson.objective) contextParts.push(`Dars maqsadi: ${lesson.objective}`)
      if (lesson.likelyConfusion) contextParts.push(`O'quvchining ehtimoliy xato tasavvuri (misconception): ${lesson.likelyConfusion}`)
      if (lesson.meaning) contextParts.push(`Amaliy ahamiyati: ${lesson.meaning}`)
      if (lesson.hook) contextParts.push(`Provokatsion savol: ${lesson.hook}`)

      const stream = streamSocraticChat(
        socraticMessages,
        {
          topicName: lesson.title,
          questionText: contextParts.join('\n\n'),
        },
        language === 'ru' ? 'ru' : 'uz',
        controller.signal,
      )

      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        accumulated += chunk
        setDiscussMessages((prev) =>
          prev.map((m, i) => (i === aiMsgIdx ? { ...m, text: accumulated } : m)),
        )
      }
    } catch {
      // streaming fallback
    } finally {
      if (!accumulated.trim()) {
        const fallbackReply = `"${textToSend}" savolingiz bo'yicha "${lesson.title}" darsida eng muhim nuqta: asosiy tushunchalarni kichik qismlarga ajratib, amaliy misol bilan bog'lashdir.`
        setDiscussMessages((prev) =>
          prev.map((m, i) => (i === aiMsgIdx ? { ...m, text: fallbackReply } : m)),
        )
      }
      setIsStreaming(false)
    }
  }

  const handleSavePage = () => {
    if (currentTheoryPage) {
      addLessonNote(
        lesson.id,
        `${currentTheoryPage.title}: ${currentTheoryPage.content.slice(0, 150)}...`,
      )
      setIsSaved(true)
      haptics.notify('success')
    } else if (isIntroStep) {
      addLessonNote(
        lesson.id,
        `${lesson.title}: ${lesson.tldr || 'Dars boshlandi'}`,
      )
      setIsSaved(true)
      haptics.notify('success')
    }
  }

  return (
    <div className="relative size-full min-h-screen flex flex-col bg-[#FFFDF8] dark:bg-[#150F0D] text-stone-900 dark:text-stone-100 font-sans select-none overflow-hidden animate-in fade-in duration-150">
      {/* 1:1 Progressive-Blur Top Header (Bundle line 7853030) */}
      <header className="sticky top-[var(--safe-top,0px)] z-30 bg-[#FFFDF8]/95 dark:bg-[#150F0D]/95 backdrop-blur-md border-b border-[#E7E2D6] dark:border-stone-800 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Close / Back to Path button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back to path"
            className="p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Center: Segmented Progress Indicator or Scrolling Title */}
          <div className="flex-1 px-2">
            {isScrollMode ? (
              <div className="text-center truncate">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 truncate block">
                  Lesson {lessonNumber} · {lesson.title}
                </span>
              </div>
            ) : (
              <ProgressIndicator
                totalPages={totalPages + 2}
                currentPageIndex={currentPageIndex}
                onPageClick={(idx) => {
                  if (idx <= totalPages + 1) {
                    setCurrentPageIndex(idx)
                  }
                }}
              />
            )}
          </div>

          {/* Right Action Icons: Mode Toggle, Bookmark & Notes */}
          <div className="flex items-center gap-1.5">
            {!isCompletionStep && (
              <button
                type="button"
                onClick={() => {
                  haptics.selection()
                  setIsScrollMode(!isScrollMode)
                }}
                className="p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 hover:text-stone-900 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                title={isScrollMode ? 'Read one page at a time' : 'Read as one scrolling page'}
                aria-label={isScrollMode ? 'Read one page at a time' : 'Read as one scrolling page'}
              >
                {isScrollMode ? (
                  <GalleryVerticalEnd size={17} />
                ) : (
                  <ScrollText size={17} />
                )}
              </button>
            )}

            {!isCompletionStep && (
              <button
                type="button"
                onClick={toggleAudioNarration}
                title={isSpeechActive ? "Ovozni to'xtatish" : "Ovozli eshitish (TTS)"}
                aria-label={isSpeechActive ? "Ovozni to'xtatish" : "Ovozli eshitish"}
                className={`p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 transition-all cursor-pointer shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none ${
                  isSpeechActive
                    ? 'text-[#0284C7] dark:text-sky-400 bg-sky-100/60 dark:bg-sky-950/60 border-sky-400 animate-pulse'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                {isSpeechActive ? (
                  <VolumeX size={17} className="text-sky-600 dark:text-sky-400" />
                ) : (
                  <Volume2 size={17} />
                )}
              </button>
            )}

            {!isCompletionStep && isSpeechActive && (
              <button
                type="button"
                onClick={handleCycleAudioSpeed}
                title={`Ovoz tezligi: ${audioSpeed}x`}
                aria-label={`Ovoz tezligi: ${audioSpeed}x`}
                className="px-2 py-1 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-bold shadow-[0_2px_0_0_#BAE6FD] dark:shadow-[0_2px_0_0_#075985] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                {audioSpeed}x
              </button>
            )}

            {!isCompletionStep && (
              <button
                type="button"
                onClick={handleSavePage}
                title={isSaved ? 'Page saved' : 'Save page'}
                className={`p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 transition-all cursor-pointer shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none ${
                  isSaved
                    ? 'text-[#0284C7] dark:text-sky-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
            )}

            <button
              type="button"
              onClick={toggleNotesDrawer}
              title="Open Notes"
              className="p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 hover:text-stone-900 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <WonderSectionNotebookIcon size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Reading & Practice Area (Scrollable) */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-48"
      >
        <div className="max-w-3xl mx-auto">
          {/* CONTINUOUS SCROLL MODE: INTRO + ALL THEORY PAGES + PRACTICE QUIZ */}
          {isScrollMode && !isCompletionStep && (
            <div className="space-y-12 animate-in fade-in duration-200">
              {/* Intro banner */}
              <div className="text-center py-8 border-b border-[#E7E2D6] dark:border-stone-800">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3 block">
                  {course?.title || 'Wonder Course'} · Lesson {lessonNumber}
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight mb-4">
                  {lesson.title}
                </h1>
                {lesson.tldr && (
                  <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-xl mx-auto mb-6">
                    {lesson.tldr}
                  </p>
                )}
                <div className="flex items-center justify-center gap-3 text-xs font-mono font-semibold text-stone-500">
                  <span className="px-3.5 py-1.5 rounded-full bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-2xs">
                    ⏱ ~{lesson.durationMinutes || 5} min
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-2xs">
                    ⚡ +{lesson.xp || 50} XP
                  </span>
                </div>
                <LessonPedagogyCards
                  hook={lesson.hook}
                  meaning={lesson.meaning}
                  objective={lesson.objective}
                  likelyConfusion={lesson.likelyConfusion}
                />
              </div>

              {/* Sequential Theory Pages */}
              {lesson.pages.map((page, pageIdx) => (
                <div key={pageIdx} className="space-y-6 pt-2 pb-8 border-b border-[#E7E2D6]/80 dark:border-stone-800/80">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      0{pageIdx + 1} / {page.title}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                      {page.title}
                    </h2>
                  </div>

                  <div
                    className="text-stone-800 dark:text-stone-200 text-base sm:text-lg leading-[1.75] font-normal space-y-4"
                    style={{ fontSize: '18px', lineHeight: '1.75' }}
                  >
                    <MarkdownWithKeywords
                      text={page.content || ''}
                      onSelectKeyword={(kw) => setActiveKeyword(kw)}
                    />
                  </div>

                  {page.visual && <LessonVisualItem visual={page.visual} />}
                </div>
              ))}

              {/* Practice Quiz at the end of scroll mode */}
              <div className="pt-4">
                <LessonQuizSection
                  quiz={lesson.quiz}
                  likelyConfusion={lesson.likelyConfusion}
                  selectedOptionId={selectedOptionId}
                  selectedCloze={selectedCloze}
                  selectedBoolean={selectedBoolean}
                  userOrderIds={userOrderIds}
                  isCardFlipped={isCardFlipped}
                  flashcardRating={flashcardRating}
                  quizSubmitted={quizSubmitted}
                  quizCorrect={quizCorrect}
                  onSelectOption={(id) => setSelectedOptionId(id)}
                  onSelectCloze={(cloze) => setSelectedCloze(cloze)}
                  onSelectBoolean={(val) => setSelectedBoolean(val)}
                  onMoveStep={handleMoveStep}
                  onFlipCard={handleFlipCard}
                  onRateFlashcard={handleRateFlashcard}
                />
              </div>
            </div>
          )}

          {/* STEP 0: AUTHENTIC LESSON INTRODUCTION SCREEN (Bundle line 7888000) */}
          {isIntroStep && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center max-w-2xl mx-auto my-auto animate-in fade-in duration-200">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-4">
                {course?.title || 'Wonder Course'} · Lesson {lessonNumber}
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight mb-6">
                {lesson.title}
              </h1>
              {lesson.tldr && (
                <p className="text-base sm:text-xl text-stone-600 dark:text-stone-300 font-normal leading-relaxed mb-8 max-w-xl">
                  {lesson.tldr}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs font-mono font-semibold text-stone-500">
                <span className="px-3.5 py-1.5 rounded-full bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-2xs">
                  ⏱ ~{lesson.durationMinutes || 5} min
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-2xs">
                  ⚡ +{lesson.xp || 50} XP
                </span>
              </div>
              <LessonPedagogyCards
                hook={lesson.hook}
                meaning={lesson.meaning}
                objective={lesson.objective}
                likelyConfusion={lesson.likelyConfusion}
              />
            </div>
          )}

          {/* STEP 1: THEORY READING PAGES (Paged mode) */}
          {isTheoryStep && currentTheoryPage && (
            <div
              ref={readingContentRef}
              className="space-y-6 animate-in fade-in duration-150 relative"
            >
              <LessonTextSelectionMenu
                containerRef={readingContentRef}
                onExplain={(text) => {
                  setIsDiscussOpen(true)
                  handleSendDiscuss(`Bu jumla haqida batafsil tushuntirib bering: "${text}"`)
                }}
              />

              {/* Lesson Heading (1:1 with LessonTheoryPage) */}
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {lesson.title} · Step {currentPageIndex} of {totalPages}
                </span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug">
                  {currentTheoryPage.title}
                </h1>
              </div>

              {/* Lesson Body Content (18px prose, 1.75 line-height) */}
              <div
                className="text-stone-800 dark:text-stone-200 text-base sm:text-lg leading-[1.75] font-normal space-y-4"
                style={{ fontSize: '18px', lineHeight: '1.75' }}
              >
                <MarkdownWithKeywords
                  text={currentTheoryPage.content || ''}
                  onSelectKeyword={(kw) => setActiveKeyword(kw)}
                />
              </div>

              {/* Visual Concept Diagrams */}
              {currentTheoryPage.visual && (
                <LessonVisualItem visual={currentTheoryPage.visual} />
              )}
            </div>
          )}

          {/* STEP 2: KNOWLEDGE CHECK / PRACTICE (Paged mode) */}
          {isQuizStep && !isCompletionStep && (
            <LessonQuizSection
              quiz={lesson.quiz}
              likelyConfusion={lesson.likelyConfusion}
              selectedOptionId={selectedOptionId}
              selectedCloze={selectedCloze}
              selectedBoolean={selectedBoolean}
              userOrderIds={userOrderIds}
              isCardFlipped={isCardFlipped}
              flashcardRating={flashcardRating}
              quizSubmitted={quizSubmitted}
              quizCorrect={quizCorrect}
              onSelectOption={(id) => setSelectedOptionId(id)}
              onSelectCloze={(cloze) => setSelectedCloze(cloze)}
              onSelectBoolean={(val) => setSelectedBoolean(val)}
              onMoveStep={handleMoveStep}
              onFlipCard={handleFlipCard}
              onRateFlashcard={handleRateFlashcard}
            />
          )}

          {/* STEP 3: COMPLETION / SESSION SUMMARY */}
          {isCompletionStep && (
            <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <Award size={40} />
              </div>

              {(() => {
                const lang = useAppStore.getState().settings.language || 'uz'
                const completionTitle =
                  lang === 'ru'
                    ? 'Урок успешно завершён!'
                    : lang === 'uz'
                      ? "Dars muvaffaqiyatli yakunlandi!"
                      : 'Session completed!'
                const completionSubtitle =
                  lang === 'ru'
                    ? `Знания по "${lesson.title}" успешно усвоены.`
                    : lang === 'uz'
                      ? `${lesson.title} bo'yicha bilimlaringiz xotiraga mustahkamlandi.`
                      : `Key mental models for "${lesson.title}" are now consolidated in memory.`

                return (
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100">
                      {completionTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-sm mx-auto">
                      {completionSubtitle}
                    </p>
                  </div>
                )
              })()}

              {/* Session Stats Grid */}
              <div className="grid grid-cols-4 gap-2.5 max-w-md mx-auto">
                <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700">
                  <div className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
                    {quizCorrect ? '100%' : '50%'}
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                    Accuracy
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700">
                  <div className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
                    {(() => {
                      const sec = sessionElapsedSeconds || Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
                      const m = Math.floor(sec / 60)
                      const s = sec % 60
                      return m > 0 ? `${m}m ${s}s` : `${s}s`
                    })()}
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                    Time
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700">
                  <div className="text-lg sm:text-xl font-bold text-amber-600 flex items-center justify-center gap-0.5">
                    <Zap size={16} />
                    <span>+{rewardInfo?.xpEarned || lesson.xp}</span>
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                    XP Earned
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800 border border-[#E7E2D6] dark:border-stone-700">
                  <div className="text-lg sm:text-xl font-bold text-sky-600">
                    {wonderStreak} 🔥
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                    Streak
                  </div>
                </div>
              </div>

              {/* 1:1 Authentic Practice Review Breakdown (matching bundle _u.lesson_practice_logs) */}
              <div className="max-w-md mx-auto text-left rounded-2xl border border-[#E7E2D6] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-900/60 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Practice 1 · Knowledge Check
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      quizCorrect
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {quizCorrect ? '✓ Correct' : 'Review needed'}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                    Question:
                  </h4>
                  <p className="text-xs sm:text-sm font-medium text-stone-900 dark:text-stone-100 leading-snug">
                    {lesson.quiz.question}
                  </p>
                </div>

                {lesson.quiz.type === 'mcq' && lesson.quiz.options && (
                  <div>
                    <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                      Options:
                    </h4>
                    <div className="space-y-1">
                      {lesson.quiz.options.map((opt, oIdx) => {
                        const isCorrect = opt.id === lesson.quiz.correctOptionId
                        const wasChosen = opt.id === selectedOptionId
                        return (
                          <div
                            key={opt.id}
                            className={`rounded-xl p-2 text-xs flex items-center justify-between ${
                              isCorrect
                                ? 'border border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-medium'
                                : wasChosen
                                  ? 'border border-red-400/50 bg-red-50/60 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                                  : 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            <span>
                              {String.fromCharCode(65 + oIdx)}. {opt.text}
                            </span>
                            {isCorrect && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-2 shrink-0">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* AI Feedback & Criteria */}
                <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800">
                  <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                    AI Feedback:
                  </h4>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    {lesson.quiz.explanation}
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    <li className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="font-bold">✓</span>
                      <span>Concept Mastery: Key lesson premise accurately identified</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="font-bold">✓</span>
                      <span>Knowledge Retention: Ready for spaced repetition scheduling</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3.5 rounded-2xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  RETURN TO COURSE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1:1 PageNavigationFooter (Fixed at bottom with safe area) */}
      {!isCompletionStep && (
        <footer className="fixed inset-x-0 bottom-0 z-30 pb-[var(--safe-bottom,0px)] bg-gradient-to-t from-[#FFFDF8] via-[#FFFDF8]/95 to-transparent dark:from-[#150F0D] dark:via-[#150F0D]/95 pt-4 px-4 select-none">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 py-3 border-t border-[#E7E2D6]/80 dark:border-stone-800/80">
            {/* Left: Previous Button (only in paged mode when past intro) */}
            {!isScrollMode && currentPageIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrevPage}
                className="px-4 py-2.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>PREVIOUS</span>
              </button>
            ) : (
              <div />
            )}

            {/* Right: Primary 3D Action Button */}
            <div className="flex items-center gap-2">
              {/* Star AI Companion button */}
              <button
                type="button"
                onClick={() => setIsDiscussOpen(!isDiscussOpen)}
                title="Ask AI Companion"
                aria-label="Ask AI Companion"
                className="size-11 rounded-2xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center justify-center cursor-pointer transition-all hover:scale-105"
              >
                <img src="/star.svg" alt="" className="size-6" />
              </button>

              {isScrollMode ? (
                !quizSubmitted ? (
                  <button
                    type="button"
                    disabled={
                      (lesson.quiz.type === 'mcq' && !selectedOptionId) ||
                      (lesson.quiz.type === 'cloze' && !selectedCloze) ||
                      (lesson.quiz.type === 'boolean' && selectedBoolean === null) ||
                      (lesson.quiz.type === 'order' && userOrderIds.length === 0) ||
                      (lesson.quiz.type === 'flashcard' && (!isCardFlipped || !flashcardRating))
                    }
                    onClick={handleQuizSubmit}
                    className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    CHECK
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCompleting}
                    onClick={() => handleFinishFsrs(quizCorrect ? 'good' : 'again')}
                    className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCompleting ? 'COMPLETING...' : 'COMPLETE LESSON'}
                  </button>
                )
              ) : isIntroStep ? (
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  START LESSON
                </button>
              ) : isTheoryStep ? (
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  {currentPageIndex === totalPages
                    ? 'START PRACTICE'
                    : 'CONTINUE'}
                </button>
              ) : !quizSubmitted ? (
                <button
                  type="button"
                  disabled={
                    (lesson.quiz.type === 'mcq' && !selectedOptionId) ||
                    (lesson.quiz.type === 'cloze' && !selectedCloze) ||
                    (lesson.quiz.type === 'boolean' && selectedBoolean === null) ||
                    (lesson.quiz.type === 'order' && userOrderIds.length === 0) ||
                    (lesson.quiz.type === 'flashcard' && (!isCardFlipped || !flashcardRating))
                  }
                  onClick={handleQuizSubmit}
                  className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CHECK
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={() => handleFinishFsrs(quizCorrect ? 'good' : 'again')}
                  className="px-8 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCompleting ? 'COMPLETING...' : 'COMPLETE LESSON'}
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* 1:1 StreakCelebrationSheet upon completion */}
      {showStreakModal && (
        <WonderStreakCelebrationModal
          streakCount={wonderStreak}
          onClose={() => {
            setShowStreakModal(false)
            if (isScrollMode) {
              setCompletedInScrollMode(true)
            } else {
              setCurrentPageIndex(totalPages + 2)
            }
          }}
        />
      )}

      {/* Socratic AI Tutor Discuss Drawer */}
      {isDiscussOpen && (
        <div className="fixed inset-x-0 bottom-0 pb-[var(--safe-bottom,0px)] h-96 max-w-3xl mx-auto rounded-t-3xl bg-[#FFFDF8] dark:bg-[#1E1512] border-t-2 border-stone-300 dark:border-stone-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-bottom duration-200">
          <div className="px-5 py-3 border-b border-[#E7E2D6] dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/star.svg" alt="" className="size-5 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                Wonder AI Companion · {lesson.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDiscussOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {discussMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#59B2E6] text-[#261312] font-semibold rounded-br-xs'
                      : 'bg-[#FAF8F2] dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-xs border border-[#E7E2D6] dark:border-stone-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-[#E7E2D6] dark:border-stone-800 flex items-center gap-2">
            <input
              type="text"
              value={discussInput}
              onChange={(e) => setDiscussInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSendDiscuss()
                }
              }}
              placeholder="Ask anything about this concept..."
              className="flex-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden font-medium"
            />
            <button
              type="button"
              disabled={!discussInput.trim() || isStreaming}
              onClick={() => handleSendDiscuss()}
              className="size-9 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Keyword Definition Drawer */}
      {activeKeyword && (
        <div className="fixed inset-x-0 bottom-0 pb-[calc(1.25rem+var(--safe-bottom,0px))] p-5 max-w-3xl mx-auto rounded-t-3xl bg-[#FFFDF8] dark:bg-[#1E1512] border-t-2 border-stone-300 dark:border-stone-700 shadow-2xl z-50 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              📖 Tushuncha izohi
            </span>
            <button
              type="button"
              onClick={() => setActiveKeyword(null)}
              className="p-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">
            {activeKeyword.word}
          </h4>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            {activeKeyword.definition}
          </p>
        </div>
      )}
    </div>
  )
}
