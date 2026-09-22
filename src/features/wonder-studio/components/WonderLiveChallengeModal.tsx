import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X,
  Flame,
  Zap,
  Clock,
  Award,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { haptics } from '../../../platform/haptics'
import { playSound } from '../../../shared/lib/sounds'
import { useAppStore } from '../../../shared/store/useAppStore'
import type { WonderCourse, WonderLessonQuiz } from '../types'

interface WonderLiveChallengeModalProps {
  course: WonderCourse
  sectionTitle: string
  onClose: () => void
  onComplete: (result: { score: number; xpEarned: number; coinsEarned: number }) => void
}

interface ChallengeItem {
  lessonId: string
  lessonTitle: string
  quiz: WonderLessonQuiz
}

/**
 * 1:1 Authentic Wondering Live Challenge / Section Boss Battle
 * Extracted from Wondering bundle lines 5268000 & 8192000.
 * A high-stakes, 60-second rapid-fire blitz challenge covering all lessons in a section.
 */
export default function WonderLiveChallengeModal({
  course,
  sectionTitle,
  onClose,
  onComplete,
}: WonderLiveChallengeModalProps) {
  const lang: string = useAppStore((s) => s.settings.language) || 'uz'

  // Extract all questions from the targeted section
  const sectionQuestions = useMemo<ChallengeItem[]>(() => {
    const targetSection = course.sections.find((s) => s.title === sectionTitle)
    const questions: ChallengeItem[] = []
    const lessons = targetSection ? targetSection.lessons : course.sections.flatMap((s) => s.lessons)

    for (const l of lessons) {
      if (l.quiz) {
        questions.push({
          lessonId: l.id,
          lessonTitle: l.title,
          quiz: l.quiz,
        })
      }
    }

    // Shuffle
    return [...questions].sort(() => 0.5 - Math.random())
  }, [course, sectionTitle])

  // Challenge States
  const [hasStarted, setHasStarted] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60) // 60s total
  const [currentIndex, setCurrentIndex] = useState(0)

  // Combo & Scoring
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)

  // Active Question Feedback state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const currentItem = sectionQuestions[currentIndex % Math.max(1, sectionQuestions.length)]
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Multiplier based on combo
  const multiplier = combo >= 5 ? 3 : combo >= 3 ? 2 : combo >= 2 ? 1.5 : 1

  // Start timer on challenge start
  useEffect(() => {
    if (!hasStarted || isFinished) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleFinishChallenge()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [hasStarted, isFinished])

  const handleStartChallenge = () => {
    haptics.impact('heavy')
    playSound('match')
    setHasStarted(true)
  }

  const handleSelectOption = (optId: string) => {
    if (isEvaluating || !currentItem) return
    setSelectedOptionId(optId)
    setIsEvaluating(true)

    const isCorrect =
      currentItem.quiz.type === 'mcq'
        ? optId === currentItem.quiz.correctOptionId
        : currentItem.quiz.type === 'boolean'
          ? (optId === 'true') === currentItem.quiz.booleanCorrect
          : true

    if (isCorrect) {
      haptics.notify('success')
      const newCombo = combo + 1
      setCombo(newCombo)
      if (newCombo > maxCombo) setMaxCombo(newCombo)
      setCorrectCount((prev) => prev + 1)
      setScore((prev) => prev + Math.round(100 * multiplier))
      playSound(newCombo >= 2 ? 'combo' : 'success')
    } else {
      haptics.notify('warning')
      setCombo(0)
      setWrongCount((prev) => prev + 1)
      playSound('error')
    }

    // Auto-advance rapidly in 350ms
    setTimeout(() => {
      setSelectedOptionId(null)
      setIsEvaluating(false)

      if (currentIndex + 1 >= sectionQuestions.length) {
        // Completed all available questions in this section
        handleFinishChallenge()
      } else {
        setCurrentIndex((prev) => prev + 1)
      }
    }, 400)
  }

  const handleFinishChallenge = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsFinished(true)
    haptics.notify('success')
    playSound('win')

    const xpEarned = Math.round(score * 0.25) + 30
    const coinsEarned = Math.min(10, Math.floor(correctCount * 1.5))

    onComplete({
      score,
      xpEarned,
      coinsEarned,
    })
  }

  // Pre-Start Splash View
  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
        <div className="relative w-full max-w-md rounded-3xl border-2 border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Glowing Boss Icon */}
          <div className="relative mx-auto mb-5 size-24 rounded-3xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-amber-400 flex items-center justify-center text-white shadow-[0_8px_0_0_#0369A1] animate-bounce duration-1000">
            <Zap size={44} className="fill-current text-white" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-300 font-mono text-xs font-black uppercase tracking-wider mb-2">
            60s LIVE CHALLENGE
          </span>

          <h2 className="text-xl sm:text-2xl font-serif font-black text-stone-900 dark:text-stone-100">
            {sectionTitle}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">
            {lang === 'ru'
              ? '60-секундный блиц-челлендж по пройденным урокам. Отвечайте быстро, держите комбо и заработайте титул чемпиона раздела!'
              : lang === 'en'
              ? 'A 60-second rapid-fire blitz challenge on this section. Answer fast, hold your combo, and claim the Section Champion title!'
              : "Ushbu bo'lim darslari bo'yicha 60 soniyalik tezkor blitz-sinov. To'g'ri javoblar bilan kombo to'plang va Bo'lim Chempioni unvonini oling!"}
          </p>

          <div className="grid grid-cols-2 gap-3 my-6 text-left">
            <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
              <span className="text-[11px] font-mono text-stone-500 block uppercase">Vaqt</span>
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1 mt-0.5">
                <Clock size={14} className="text-sky-500" />
                60 soniya
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
              <span className="text-[11px] font-mono text-stone-500 block uppercase">Kombo</span>
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1 mt-0.5">
                <Flame size={14} className="text-amber-500" />
                3x gacha Fire
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartChallenge}
            className="w-full py-4 rounded-2xl bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] font-mono font-bold text-sm uppercase tracking-wider shadow-[0_5px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            {lang === 'ru' ? 'НАЧАТЬ ЧЕЛЛЕНДЖ' : lang === 'en' ? 'START CHALLENGE' : 'CHALLENGENI BOSHLASH'}
          </button>
        </div>
      </div>
    )
  }

  // Post-Challenge Results View
  if (isFinished) {
    const totalAnswered = correctCount + wrongCount
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
    const xpEarned = Math.round(score * 0.25) + 30
    const coinsEarned = Math.min(10, Math.floor(correctCount * 1.5))

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
        <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-400/50 dark:border-amber-500/40 bg-[#FFFDF8] dark:bg-[#1C1411] p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="relative mx-auto mb-4 size-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-stone-950 shadow-lg animate-bounce duration-1000">
            <Award size={40} strokeWidth={2.2} />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-amber-400/20 text-amber-900 dark:text-amber-300 font-mono text-xs font-black uppercase tracking-wider mb-2">
            CHALLENGE YAKUNLANDI!
          </span>

          <h2 className="text-2xl font-serif font-black text-stone-900 dark:text-stone-100">
            {accuracy >= 70 ? 'Bo\'lim O\'zlashtirildi!' : 'Yaxshi Urinish!'}
          </h2>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 my-6">
            <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="text-[10px] font-mono text-stone-500 uppercase">Ball</span>
              <span className="text-lg font-black text-stone-900 dark:text-stone-100 block mt-0.5">
                {score}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="text-[10px] font-mono text-stone-500 uppercase">Aniqlik</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {accuracy}%
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#FAF8F2] dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="text-[10px] font-mono text-stone-500 uppercase">Max Combo</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
                {maxCombo}x 🔥
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-2 mb-6 text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
              <Zap size={14} /> +{xpEarned} XP
            </span>
            {coinsEarned > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Award size={14} /> +{coinsEarned} Tanga
              </span>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-mono font-bold text-sm uppercase tracking-wider shadow-[0_4px_0_0_#047857] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              DAVOM ETISH
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeLeft(60)
                setScore(0)
                setCombo(0)
                setMaxCombo(0)
                setCorrectCount(0)
                setWrongCount(0)
                setCurrentIndex(0)
                setIsFinished(false)
                setHasStarted(true)
              }}
              className="w-full py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>QAYTA O'YNASH</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active Blitz Game View
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#FFFDF8] dark:bg-[#150F0D] select-none animate-in fade-in duration-150 overflow-hidden">
      {/* Top Header Dock */}
      <div className="px-4 sm:px-6 py-3 border-b border-stone-200/90 dark:border-stone-800 bg-[#FAF8F2] dark:bg-[#1A1210] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-mono font-black">
            <Flame size={14} className="text-amber-600 fill-amber-500" />
            <span>{combo > 0 ? `${combo}x COMBO` : 'LIVE CHALLENGE'}</span>
          </div>
        </div>

        {/* Center: 60s Countdown Timer Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
            <Clock size={14} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-sky-500'} />
            <span className={timeLeft <= 10 ? 'text-red-600 font-black' : ''}>{timeLeft}s</span>
          </div>
          <div className="w-24 sm:w-36 h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                timeLeft <= 10 ? 'bg-red-500' : timeLeft <= 25 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${(timeLeft / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: Live Score */}
        <div className="text-right">
          <span className="text-[10px] font-mono text-stone-400 block uppercase">Ball</span>
          <span className="text-sm font-mono font-black text-stone-900 dark:text-stone-100">
            {score}
          </span>
        </div>
      </div>

      {/* Main Blitz Question Card */}
      <div className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-center">
        {currentItem && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 block mb-1">
                {currentItem.lessonTitle}
              </span>
              <h3 className="text-lg sm:text-xl font-bold font-display text-stone-900 dark:text-stone-100 leading-snug">
                {currentItem.quiz.question}
              </h3>
            </div>

            {/* MCQ Options */}
            {currentItem.quiz.type === 'mcq' && (
              <div className="space-y-2.5">
                {currentItem.quiz.options?.map((opt: { id: string; text: string }) => {
                  const isSelected = selectedOptionId === opt.id
                  const isCorrect = opt.id === currentItem.quiz.correctOptionId

                  let btnStyle =
                    'bg-white dark:bg-[#251B17] border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-amber-400'

                  if (isEvaluating) {
                    if (isCorrect) {
                      btnStyle =
                        'bg-emerald-500 text-white border-emerald-600 shadow-md font-bold'
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-500 text-white border-red-600'
                    }
                  } else if (isSelected) {
                    btnStyle = 'bg-amber-400 border-stone-900 text-stone-950 font-bold'
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full p-4 rounded-2xl border-2 text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
                    >
                      <span className="size-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black">
                        {opt.id.slice(-1).toUpperCase()}
                      </span>
                      <span className="flex-1 leading-snug font-medium">{opt.text}</span>
                      {isEvaluating && isCorrect && (
                        <CheckCircle2 size={18} className="text-white shrink-0 mt-0.5" />
                      )}
                      {isEvaluating && isSelected && !isCorrect && (
                        <XCircle size={18} className="text-white shrink-0 mt-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Boolean Options */}
            {currentItem.quiz.type === 'boolean' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {['true', 'false'].map((val) => {
                  const isSelected = selectedOptionId === val
                  const isCorrect = (val === 'true') === currentItem.quiz.booleanCorrect

                  let btnStyle =
                    'bg-white dark:bg-[#251B17] border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200'

                  if (isEvaluating) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-500 text-white border-emerald-600 font-bold'
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-500 text-white border-red-600'
                    }
                  }

                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleSelectOption(val)}
                      className={`p-5 rounded-2xl border-2 font-mono font-black text-sm uppercase tracking-wider text-center transition-all cursor-pointer ${btnStyle}`}
                    >
                      {val === 'true' ? 'TRUE' : 'FALSE'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Cloze quick pick */}
            {currentItem.quiz.type === 'cloze' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm font-medium">
                  {currentItem.quiz.clozeTemplate?.replace('{{blank}}', '_______')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {currentItem.quiz.clozeOptions?.map((opt: string) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleSelectOption(opt)}
                      className="p-3.5 rounded-xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold hover:border-amber-400 transition-all cursor-pointer text-center"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Dock Bar with mascot and motivation */}
      <div className="px-6 py-3 border-t border-stone-200/80 dark:border-stone-800 bg-[#FAF8F2] dark:bg-[#1A1210] flex items-center justify-between text-xs text-stone-500 pb-[calc(0.75rem+var(--safe-bottom,0px))]">
        <span className="font-mono">
          Savol {currentIndex + 1} / {sectionQuestions.length}
        </span>
        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
          Multiplier: {multiplier}x
        </span>
      </div>
    </div>
  )
}
