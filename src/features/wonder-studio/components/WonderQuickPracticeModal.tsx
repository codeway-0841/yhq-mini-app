import { useState, useMemo, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  XCircle,
  Zap,
  Send,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { useWonderStore } from '../store/useWonderStore'
import type { WonderCourse, WonderLessonQuiz } from '../types'
import type { AiCourseAnswers } from '../../../../shared/ai-courses'

interface WonderQuickPracticeModalProps {
  course: WonderCourse
  sectionTitle?: string
  onClose: () => void
  onCompleteSession: (result: { streakCount: number; xpEarned: number }) => void
}

interface PracticeQuestionItem {
  lessonId: string
  lessonTitle: string
  quiz: WonderLessonQuiz
  rawPractices?: readonly any[]
}

/**
 * 1:1 Authentic Quick Exercise / Spaced Retrieval Practice Modal
 * Extracted from Wondering bundle lines 5644508, 5772208 & 6189846
 */
export default function WonderQuickPracticeModal({
  course,
  sectionTitle,
  onClose,
  onCompleteSession,
}: WonderQuickPracticeModalProps) {
  const completeLesson = useWonderStore((s) => s.completeLesson)
  const wonderStreak = useWonderStore((s) => s.wonderStreak)

  // Collect quizzes across all lessons in course (or filtered by sectionTitle)
  const practiceItems = useMemo<PracticeQuestionItem[]>(() => {
    const questions: PracticeQuestionItem[] = []
    const targetSections = sectionTitle
      ? course.sections.filter((s) => s.title === sectionTitle)
      : course.sections

    for (const section of targetSections) {
      for (const lesson of section.lessons) {
        if (lesson.quiz) {
          questions.push({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            quiz: lesson.quiz,
            rawPractices: lesson.rawPractices,
          })
        }
      }
    }

    // Shuffle and pick 3-5 rapid retrieval questions
    const shuffled = [...questions].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 4)
  }, [course, sectionTitle])

  const [currentIndex, setCurrentIndex] = useState(0)
  const currentItem = practiceItems[currentIndex]

  // Answer state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [selectedCloze, setSelectedCloze] = useState<string | null>(null)
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null)
  const [userOrderIds, setUserOrderIds] = useState<string[]>([])
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [flashcardRating, setFlashcardRating] = useState<'again' | 'good' | null>(null)
  const [isAnswerChecked, setIsAnswerChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [totalCorrect, setTotalCorrect] = useState(0)

  // AI Companion Discuss Drawer
  const [isDiscussOpen, setIsDiscussOpen] = useState(false)
  const [discussMessages, setDiscussMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([])
  const [discussInput, setDiscussInput] = useState('')

  // Initialize order items or reset flashcard when question changes
  useEffect(() => {
    if (!currentItem) return
    if (currentItem.quiz.type === 'order' && currentItem.quiz.orderSteps) {
      const ids = currentItem.quiz.orderSteps.map((s) => s.id)
      const shuffled = [...ids]
      if (shuffled.length > 1) {
        const first = shuffled.shift()!
        shuffled.push(first)
      }
      setUserOrderIds(shuffled)
    } else {
      setUserOrderIds([])
    }
    setIsCardFlipped(false)
    setFlashcardRating(null)
    setSelectedOptionId(null)
    setSelectedCloze(null)
    setSelectedBoolean(null)
    setIsAnswerChecked(false)
    setIsDiscussOpen(false)
  }, [currentIndex, currentItem])

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= userOrderIds.length || toIndex < 0 || toIndex >= userOrderIds.length) return
    haptics.impact('light')
    const updated = [...userOrderIds]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    setUserOrderIds(updated)
  }

  const handleRateFlashcard = (rating: 'again' | 'good') => {
    haptics.impact('light')
    playSound('click')
    setFlashcardRating(rating)
  }

  if (!currentItem || practiceItems.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#FFFDF8] dark:bg-[#1C1411] p-6 text-center shadow-2xl">
          <p className="text-sm text-stone-600 dark:text-stone-300 mb-4">
            No retrieval exercises due for this course right now.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#59B2E6] text-[#261312] font-mono font-bold text-xs uppercase"
          >
            CLOSE
          </button>
        </div>
      </div>
    )
  }

  const handleCheckAnswer = () => {
    haptics.impact('medium')
    let correct = false

    if (currentItem.quiz.type === 'mcq') {
      correct = selectedOptionId === currentItem.quiz.correctOptionId
    } else if (currentItem.quiz.type === 'cloze') {
      correct = selectedCloze === currentItem.quiz.clozeAnswer
    } else if (currentItem.quiz.type === 'boolean') {
      correct = selectedBoolean === currentItem.quiz.booleanCorrect
    } else if (currentItem.quiz.type === 'order') {
      const correctIds =
        currentItem.quiz.correctOrderIds ||
        currentItem.quiz.orderSteps?.map((s) => s.id) ||
        []
      correct =
        userOrderIds.length === correctIds.length &&
        userOrderIds.every((id, idx) => id === correctIds[idx])
    } else if (currentItem.quiz.type === 'flashcard') {
      correct = flashcardRating === 'good'
    }

    setIsCorrect(correct)
    setIsAnswerChecked(true)
    if (correct) {
      setTotalCorrect((prev) => prev + 1)
      haptics.notify('success')
      playSound('success')
    } else {
      haptics.notify('warning')
      playSound('error')
    }
  }

  const handleNextQuestion = () => {
    // Construct structured answers for Neon DB validation
    const userAnswers: AiCourseAnswers = {
      flashcard: {},
      mcq: {},
      cloze: {},
      order: {},
    }

    if (currentItem.rawPractices && currentItem.rawPractices.length > 0) {
      for (const p of currentItem.rawPractices) {
        if (p.kind === 'mcq') {
          userAnswers.mcq[p.id] = selectedOptionId || p.options?.[0]?.id || 'opt-1'
        } else if (p.kind === 'cloze') {
          userAnswers.cloze[p.id] = {}
          if (Array.isArray(p.blanks)) {
            for (const b of p.blanks) {
              userAnswers.cloze[p.id][b.id] = selectedCloze || b.answer || ''
            }
          }
        } else if (p.kind === 'flashcard') {
          userAnswers.flashcard[p.id] = flashcardRating === 'good' ? 'known' : 'unknown'
        } else if (p.kind === 'order') {
          userAnswers.order[p.id] = userOrderIds.length > 0 ? userOrderIds : (p.items?.map((it: any) => it.id) || [])
        }
      }
    } else {
      if (currentItem.quiz.type === 'mcq' && selectedOptionId) {
        userAnswers.mcq[currentItem.quiz.question] = selectedOptionId
      } else if (currentItem.quiz.type === 'cloze' && selectedCloze) {
        userAnswers.cloze['cloze_1'] = { blank_1: selectedCloze }
      } else if (currentItem.quiz.type === 'order') {
        userAnswers.order[currentItem.quiz.question] = userOrderIds
      } else if (currentItem.quiz.type === 'flashcard') {
        userAnswers.flashcard[currentItem.quiz.question] = flashcardRating === 'good' ? 'known' : 'unknown'
      }
    }

    // Save FSRS state for this card with structured answers
    completeLesson(
      currentItem.lessonId,
      isCorrect ? 'good' : 'again',
      15, // 15 XP for quick exercise question
      0,
      userAnswers,
      currentItem.rawPractices,
    )

    if (currentIndex < practiceItems.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedOptionId(null)
      setSelectedCloze(null)
      setSelectedBoolean(null)
      setIsAnswerChecked(false)
      setIsDiscussOpen(false)
      haptics.impact('light')
    } else {
      // Finished all retrieval questions
      const xpEarned = (totalCorrect + (isCorrect ? 1 : 0)) * 15
      playSound('win')
      onCompleteSession({
        streakCount: wonderStreak,
        xpEarned,
      })
    }
  }

  const handleOpenDiscuss = () => {
    const initialText = `We are practicing "${currentItem.lessonTitle}". Question: "${currentItem.quiz.question}". My answer was ${
      isCorrect ? 'correct' : 'incorrect'
    }. Explanation: "${currentItem.quiz.explanation}". Ask me anything!`
    setDiscussMessages([
      {
        sender: 'ai',
        text: initialText,
      },
    ])
    setIsDiscussOpen(true)
  }

  const handleSendDiscuss = (text?: string) => {
    const q = (text || discussInput).trim()
    if (!q) return
    setDiscussInput('')
    setDiscussMessages((prev) => [...prev, { sender: 'user', text: q }])
    setTimeout(() => {
      setDiscussMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `In retrieval practice for "${currentItem.lessonTitle}", actively recalling concepts rather than passively reading strengthens synaptic pathways by up to 50%. Focus on the core mechanism: ${currentItem.quiz.explanation}`,
        },
      ])
    }, 400)
  }

  const canCheck =
    (currentItem.quiz.type === 'mcq' && !!selectedOptionId) ||
    (currentItem.quiz.type === 'cloze' && !!selectedCloze) ||
    (currentItem.quiz.type === 'boolean' && selectedBoolean !== null) ||
    (currentItem.quiz.type === 'order' && userOrderIds.length > 0) ||
    (currentItem.quiz.type === 'flashcard' && isCardFlipped && flashcardRating !== null)

  const isLastQuestion = currentIndex === practiceItems.length - 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#FFFDF8] dark:bg-[#1C1411] overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-stone-200/80 dark:border-stone-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
            <Zap size={13} className="text-amber-600" />
            <span>{sectionTitle ? 'SECTION REVIEW' : 'QUICK EXERCISE'}</span>
          </div>
        </div>

        {/* Progress Bar & Counter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400">
            {currentIndex + 1} / {practiceItems.length}
          </span>
          <div className="w-24 sm:w-32 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-[#59B2E6] transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / practiceItems.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Question Content Area */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 overflow-y-auto pb-44">
        <div className="mb-6">
          <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
            {currentItem.lessonTitle}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 font-display mt-1">
            {currentItem.quiz.question}
          </h2>
        </div>

        {/* MCQ Type */}
        {currentItem.quiz.type === 'mcq' && (
          <div className="space-y-2.5">
            {currentItem.quiz.options?.map((opt: { id: string; text: string }) => {
              const isSelected = selectedOptionId === opt.id
              const isCorrectOption = opt.id === currentItem.quiz.correctOptionId

              let btnStyle =
                'bg-white dark:bg-[#251B17] border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-amber-400'

              if (isAnswerChecked) {
                if (isCorrectOption) {
                  btnStyle =
                    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold'
                } else if (isSelected && !isCorrectOption) {
                  btnStyle =
                    'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-100'
                }
              } else if (isSelected) {
                btnStyle =
                  'bg-amber-100/70 dark:bg-amber-950/50 border-amber-500 font-bold text-stone-950 dark:text-stone-100'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isAnswerChecked}
                  onClick={() => {
                    playSound('click')
                    setSelectedOptionId(opt.id)
                  }}
                  className={`w-full p-3.5 sm:p-4 rounded-2xl border-2 text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
                >
                  <span className="size-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black">
                    {opt.id.slice(-1).toUpperCase()}
                  </span>
                  <span className="flex-1 leading-snug">{opt.text}</span>
                  {isAnswerChecked && isCorrectOption && (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {isAnswerChecked && isSelected && !isCorrectOption && (
                    <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Cloze Fill-In */}
        {currentItem.quiz.type === 'cloze' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm sm:text-base font-medium text-stone-900 dark:text-stone-100">
              {currentItem.quiz.clozeTemplate?.replace(
                '{{blank}}',
                selectedCloze ? `[ ${selectedCloze} ]` : '_______',
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {currentItem.quiz.clozeOptions?.map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  disabled={isAnswerChecked}
                  onClick={() => {
                    playSound('click')
                    setSelectedCloze(opt)
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all cursor-pointer ${
                    selectedCloze === opt
                      ? 'bg-amber-400 border-stone-800 text-stone-950 shadow-[0_2px_0_0_#28231D]'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boolean True/False */}
        {currentItem.quiz.type === 'boolean' && (
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((val) => {
              const isSelected = selectedBoolean === val
              return (
                <button
                  key={String(val)}
                  type="button"
                  disabled={isAnswerChecked}
                  onClick={() => {
                    playSound('click')
                    setSelectedBoolean(val)
                  }}
                  className={`p-4 rounded-2xl font-black text-sm sm:text-base border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 border-stone-800 text-stone-950 shadow-[0_3px_0_0_#28231D]'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {val ? 'TRUE' : 'FALSE'}
                </button>
              )
            })}
          </div>
        )}

        {/* Order Reorder Steps */}
        {currentItem.quiz.type === 'order' && currentItem.quiz.orderSteps && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Bosqichlarni to'g'ri tartibda joylashtiring:
            </div>
            {userOrderIds.map((stepId, index) => {
              const stepObj = currentItem.quiz.orderSteps?.find((s) => s.id === stepId)
              const isCorrectPosition = isAnswerChecked && currentItem.quiz.correctOrderIds?.[index] === stepId
              const isWrongPosition = isAnswerChecked && currentItem.quiz.correctOrderIds?.[index] !== stepId

              return (
                <div
                  key={stepId}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                    isAnswerChecked
                      ? isCorrectPosition
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-950 dark:text-red-100'
                      : 'bg-white dark:bg-[#1C1411] border-[#E7E2D6] dark:border-stone-800 shadow-2xs'
                  }`}
                >
                  <span className="size-7 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-xs sm:text-sm font-medium leading-snug">
                    {stepObj?.text}
                  </span>
                  {!isAnswerChecked && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveStep(index, index - 1)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-all cursor-pointer"
                        title="Yuqoriga"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === userOrderIds.length - 1}
                        onClick={() => handleMoveStep(index, index + 1)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-all cursor-pointer"
                        title="Pastga"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  )}
                  {isAnswerChecked && isCorrectPosition && (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  )}
                  {isAnswerChecked && isWrongPosition && (
                    <XCircle size={18} className="text-red-500 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 3D Flashcard Flip */}
        {currentItem.quiz.type === 'flashcard' && (
          <div className="space-y-4 pt-2">
            <div
              onClick={() => {
                playSound('click')
                setIsCardFlipped(!isCardFlipped)
              }}
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
                    ? (currentItem.quiz.flashcardAnswer || currentItem.quiz.explanation)
                    : (currentItem.quiz.flashcardPrompt || currentItem.quiz.question)}
                </h3>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-500 italic text-center">
                {isCardFlipped
                  ? "Tub mexanizm tushunarlimi? O'z bilmingizni baholang."
                  : 'Kartani bosib javobni tekshiring.'}
              </div>
            </div>

            {isCardFlipped && !isAnswerChecked && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={() => handleRateFlashcard('again')}
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
                  onClick={() => handleRateFlashcard('good')}
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
      </div>

      {/* 1:1 PracticeAnswerPanel Bottom Dock (Bundle line 7798496) */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-[#FAF8F2] dark:bg-[#1A1210] border-t-2 border-stone-200 dark:border-stone-800 shadow-2xl pb-[var(--safe-bottom,0px)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 pb-[calc(1rem+var(--safe-bottom,0px))]">
          {isAnswerChecked && (
            <div className="mb-3 animate-in slide-in-from-bottom duration-200">
              <p
                className={`text-base font-bold mb-1 ${
                  isCorrect
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                {isCorrect ? "That's right!" : 'Not quite right'}
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                {currentItem.quiz.explanation}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Left: DISCUSS button with star mascot */}
            <button
              type="button"
              onClick={handleOpenDiscuss}
              className="px-4 py-3 rounded-2xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700/60 transition-all cursor-pointer shrink-0 shadow-2xs"
            >
              <img src="/star.svg" alt="" className="size-4 shrink-0" />
              <span>DISCUSS</span>
            </button>

            {/* Right: CHECK or CONTINUE button */}
            {!isAnswerChecked ? (
              <button
                type="button"
                disabled={!canCheck}
                onClick={handleCheckAnswer}
                className="flex-1 py-3 px-6 rounded-2xl bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] font-mono font-bold text-xs sm:text-sm uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
              >
                CHECK
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                className={`flex-1 py-3 px-6 rounded-2xl font-mono font-bold text-xs sm:text-sm uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center ${
                  isCorrect
                    ? 'bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_4px_0_0_#047857]'
                    : 'bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312]'
                }`}
              >
                {isLastQuestion ? 'COMPLETE EXERCISE' : 'CONTINUE'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Companion Discuss Drawer */}
      {isDiscussOpen && (
        <div className="fixed inset-x-0 bottom-0 pb-[var(--safe-bottom,0px)] h-96 max-w-2xl mx-auto rounded-t-3xl bg-[#FFFDF8] dark:bg-[#1E1512] border-t-2 border-stone-300 dark:border-stone-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/star.svg" alt="" className="size-4 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                Wonder AI Companion · Quick Practice
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDiscussOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {discussMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#67C2F9] text-stone-950 font-medium'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2">
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
              placeholder="Ask for clarification or a mnemonic..."
              className="flex-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-3 py-2 rounded-xl text-xs text-stone-900 dark:text-stone-100 outline-none"
            />
            <button
              type="button"
              onClick={() => handleSendDiscuss()}
              disabled={!discussInput.trim()}
              className="size-8 rounded-xl bg-[#59B2E6] text-[#261312] flex items-center justify-center disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
