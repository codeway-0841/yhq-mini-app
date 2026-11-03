import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { registerModal } from '../../shared/lib/navigation'
import { playSound } from '../../shared/lib/sounds'
import { haptics } from '../../platform/haptics'
import { speak, stopSpeaking } from '../../shared/lib/speech'
import { useAppStore } from '../../shared/store/useAppStore'
import Confetti from '../../shared/components/Confetti'
import { PathMascot } from '../lessons'
import {
  type BrilliantLesson,
  type BrilliantSlide,
  buildBrilliantLessonFromMarkdown,
} from './literature-brilliant-data'

interface LiteratureBrilliantLessonProps {
  blockId: number
  topicIndex: number
  topicTitle: string
  onClose: () => void
  onNextTopic?: () => void
}

/** Matndagi **qalin** so'zlarni ajratib ko'rsatish */
function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const tokens: { text: string; bold: boolean }[] = []
    const regex = /\*\*([^*]+)\*\*/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: text.slice(lastIndex, match.index), bold: false })
      }
      tokens.push({ text: match[1], bold: true })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
      tokens.push({ text: text.slice(lastIndex), bold: false })
    }
    return tokens
  }, [text])

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-extrabold text-slate-900 dark:text-slate-50">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}

export default function LiteratureBrilliantLesson({
  blockId,
  topicIndex,
  topicTitle,
  onClose,
  onNextTopic,
}: LiteratureBrilliantLessonProps) {
  const lang = useAppStore((s) => s.settings.language)
  const xp = useAppStore((s) => s.xp) ?? 0
  const ru = lang === 'ru'

  const [lesson, setLesson] = useState<BrilliantLesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [slideIndex, setSlideIndex] = useState(0)

  // Quiz holatlari
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [quizChecked, setQuizChecked] = useState(false)
  const [quizCorrect, setQuizCorrect] = useState(false)
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0)
  const [totalQuizzesCount, setTotalQuizzesCount] = useState(0)

  // Tugatish ekrani
  const [isCompleted, setIsCompleted] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Android va Telegram orqaga qaytish tugmasi
  useEffect(() => {
    const id = Symbol('literature-brilliant-lesson')
    return registerModal(id, () => {
      stopSpeaking()
      onCloseRef.current()
    })
  }, [])

  // Dars kontentini yuklash
  useEffect(() => {
    let active = true
    setLoading(true)
    setIsCompleted(false)
    setSlideIndex(0)
    setSelectedOption(null)
    setQuizChecked(false)

    buildBrilliantLessonFromMarkdown(blockId, topicIndex, topicTitle)
      .then((data) => {
        if (!active) return
        setLesson(data)
        const quizzes = data.slides.filter((s) => s.type === 'quiz').length
        setTotalQuizzesCount(quizzes)
      })
      .catch((err) => {
        console.error('Failed to build brilliant lesson:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      stopSpeaking()
    }
  }, [blockId, topicIndex, topicTitle])

  // Har yangi slayd ochilganda yuqoriga scroll qilish
  useEffect(() => {
    setSelectedOption(null)
    setQuizChecked(false)
    setSpeaking(false)
    stopSpeaking()
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [slideIndex])

  const totalSlides = lesson?.slides.length ?? 1
  const currentSlide: BrilliantSlide | undefined = lesson?.slides[slideIndex]

  // Progress foizi
  const progressPercent = isCompleted
    ? 100
    : Math.min(100, Math.round(((slideIndex + 1) / Math.max(1, totalSlides)) * 100))

  // Audio o'qib berish
  const handleToggleAudio = useCallback(() => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    if (!currentSlide) return

    let textToSpeak = ''
    if (currentSlide.type === 'intro') {
      textToSpeak = `${currentSlide.title}. ${currentSlide.text.replace(/\*\*/g, '')}`
    } else if (currentSlide.type === 'visual') {
      textToSpeak = `${currentSlide.caption}. ${currentSlide.text.replace(/\*\*/g, '')}`
    } else if (currentSlide.type === 'quiz') {
      textToSpeak = `${currentSlide.question}. ${currentSlide.options.join('. ')}`
    } else if (currentSlide.type === 'trap') {
      textToSpeak = `${currentSlide.title}. ${currentSlide.trapText} ${currentSlide.solutionText}`
    }

    if (textToSpeak) {
      speak(textToSpeak, 'ru')
      setSpeaking(true)
    }
  }, [currentSlide, speaking])

  // Testni tekshirish
  const handleCheckQuiz = useCallback(() => {
    if (currentSlide?.type !== 'quiz' || selectedOption === null || quizChecked) return

    const isRight = selectedOption === currentSlide.correctIndex
    setQuizCorrect(isRight)
    setQuizChecked(true)

    if (isRight) {
      playSound('success')
      haptics.success()
      setCorrectAnswersCount((c) => c + 1)
    } else {
      playSound('error')
      haptics.error()
    }
  }, [currentSlide, selectedOption, quizChecked])

  // Keyingi slaydga o'tish
  const handleContinue = useCallback(() => {
    stopSpeaking()
    setSpeaking(false)

    if (slideIndex + 1 < totalSlides) {
      setSlideIndex((i) => i + 1)
    } else {
      // Dars yakunlandi!
      setIsCompleted(true)
      playSound('win')
      haptics.success()

      // XP va Streak mukofotlash
      const earnedXp = 50
      useAppStore.setState({ xp: xp + earnedXp })
    }
  }, [slideIndex, totalSlides, xp])

  // Maskot animatsiyasi holatini aniqlash
  const mascotAnimation = useMemo(() => {
    if (isCompleted) return 'celebrate'
    if (currentSlide?.type === 'quiz') {
      if (!quizChecked) return selectedOption !== null ? 'thinking' : 'idle'
      return quizCorrect ? 'happy' : 'oops'
    }
    return 'idle'
  }, [isCompleted, currentSlide, quizChecked, selectedOption, quizCorrect])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-100">
        <div className="size-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {ru ? 'Подготовка интерактивного урока...' : 'Interaktiv dars tayyorlanmoqda...'}
        </p>
      </div>
    )
  }

  if (!lesson) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#ffffff] dark:bg-[#0c1222] text-slate-900 dark:text-slate-100 font-sans select-none overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Konfetti nishonlash */}
      {isCompleted && (
        <div className="pointer-events-none absolute inset-0 z-50">
          <Confetti count={40} />
        </div>
      )}

      {/* 1. TOP HEADER (Brilliant Style) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-white/90 dark:bg-[#0c1222]/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 pt-[calc(0.75rem+var(--safe-top,0px))]">
        {/* Orqaga / Chiqish */}
        <button
          type="button"
          onClick={onClose}
          aria-label={ru ? 'Закрыть урок' : 'Darsni yopish'}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform active:scale-95 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <X size={20} strokeWidth={2.2} />
        </button>

        {/* Progress Bar (Smooth Green Fill - Brilliant) */}
        <div className="flex-1 max-w-md mx-auto">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/90"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalSlides}
            aria-valuenow={slideIndex + 1}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              style={{ width: `${Math.max(6, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Audio / XP Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleAudio}
            aria-label={ru ? 'Озвучить' : 'Ovoz berish'}
            className={`grid size-9 place-items-center rounded-full transition-all cursor-pointer ${
              speaking
                ? 'bg-purple-500 text-white animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Volume2 size={18} strokeWidth={2.2} />
          </button>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
            <Zap size={14} className="fill-amber-500 text-amber-500" />
            <span>{xp}</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CARD VIEWPORT */}
      <main
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:py-8 pb-[calc(7rem+var(--safe-bottom,0px))]"
      >
        <div className="mx-auto w-full max-w-xl">
          {/* YAKUNIY G'ALABA EKRANI */}
          {isCompleted ? (
            <div className="flex flex-col items-center text-center py-6 animate-fadeIn">
              <div className="relative mb-4 grid size-28 place-items-center rounded-3xl bg-emerald-500/10 p-3 ring-8 ring-emerald-500/10">
                <PathMascot variant="avatar" animation="celebrate" />
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                <Sparkles size={14} />
                {ru ? 'Урок успешно завершён' : 'Dars muvaffaqiyatli yakunlandi'}
              </span>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 mb-2">
                {ru ? 'Отличная работа!' : 'Ajoyib natija!'}
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mb-6">
                {ru
                  ? `Вы блестяще освоили тему «${lesson.title}» и закрепили её интерактивными вопросами.`
                  : `Siz «${lesson.titleUz}» mavzusini to'liq o'zlashtirdingiz va bilimlaringizni mustahkamlab oldingiz.`}
              </p>

              {/* Yutuqlar kartasi */}
              <div className="grid w-full grid-cols-3 gap-3 mb-6">
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-500">
                    {ru ? 'Точность' : 'Aniqlik'}
                  </span>
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {totalQuizzesCount > 0
                      ? `${Math.round((correctAnswersCount / totalQuizzesCount) * 100)}%`
                      : '100%'}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-500">
                    XP
                  </span>
                  <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">+50</p>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-500">
                    {ru ? 'Статус' : 'Holat'}
                  </span>
                  <p className="text-base font-extrabold text-purple-600 dark:text-purple-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={16} />
                    <span>{ru ? 'Пройдено' : "O'tildi"}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : currentSlide?.type === 'intro' ? (
            /* SLIDE 1: INTRO (Title + Hook) */
            <div className="space-y-5 animate-fadeIn">
              {currentSlide.badge && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold tracking-wider uppercase">
                  <span>{lesson.eraIcon}</span>
                  <span>{currentSlide.badge}</span>
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                {currentSlide.title}
              </h1>

              {currentSlide.subtitle && (
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 -mt-2">
                  {currentSlide.subtitle}
                </p>
              )}

              {/* Muallif portreti kartasi (agar bo'lsa) */}
              {currentSlide.authorImg && (
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-xs my-3">
                  <img
                    src={currentSlide.authorImg}
                    alt={currentSlide.authorName || 'Автор'}
                    className="size-14 rounded-xl object-cover ring-2 ring-emerald-500/30 shrink-0"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {currentSlide.authorName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentSlide.authorYears || lesson.eraTitle}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300 space-y-4 pt-2">
                {currentSlide.text.split('\n\n').map((paragraph, idx) => (
                  <p key={idx}>
                    <FormattedText text={paragraph} />
                  </p>
                ))}
              </div>
            </div>
          ) : currentSlide?.type === 'visual' ? (
            /* SLIDE 2: VISUAL CONCEPT (Illustration / Portrait + Bullets) */
            <div className="space-y-5 animate-fadeIn">
              {currentSlide.title && (
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                  {currentSlide.title}
                </h2>
              )}

              {/* Rasm yoki Diagramma kartasi */}
              <div className="flex flex-col items-center rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-4 sm:p-5 shadow-xs">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm max-h-64 flex items-center justify-center">
                  <img
                    src={currentSlide.image}
                    alt={currentSlide.imageAlt || 'Иллюстрация'}
                    className="max-h-60 w-auto object-contain rounded-2xl"
                    loading="eager"
                  />
                </div>
                {currentSlide.caption && (
                  <figcaption className="mt-3 text-center text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic max-w-md">
                    {currentSlide.caption}
                  </figcaption>
                )}
              </div>

              {/* Tushuntirish matni */}
              <div className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300 space-y-3">
                <p>
                  <FormattedText text={currentSlide.text} />
                </p>
              </div>

              {/* Bandlar (Bullets) */}
              {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                <ul className="space-y-2.5 pt-1">
                  {currentSlide.bullets.map((bullet, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-sm sm:text-base leading-snug text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/40"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        {idx + 1}
                      </span>
                      <span>
                        <FormattedText text={bullet} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : currentSlide?.type === 'quiz' ? (
            /* SLIDE 3: INTERACTIVE QUIZ (Screenshot 4 format) */
            <div className="space-y-5 animate-fadeIn">
              {currentSlide.image && (
                <div className="flex flex-col items-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-200/80 dark:border-slate-700/60">
                  <img
                    src={currentSlide.image}
                    alt="Вопрос"
                    className="max-h-36 rounded-xl object-contain"
                  />
                  {currentSlide.imageCaption && (
                    <p className="mt-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                      {currentSlide.imageCaption}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {ru ? 'Контрольный вопрос' : 'Oraliq savol'}
                </span>
                <h3 className="text-lg sm:text-xl font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {currentSlide.question}
                </h3>
              </div>

              {/* Variantlar ro'yxati (Selectable Cards) */}
              <div className="flex flex-col gap-3 pt-2">
                {currentSlide.options.map((option, optIdx) => {
                  const isSelected = selectedOption === optIdx
                  const isCorrect = optIdx === currentSlide.correctIndex

                  let btnStyle =
                    'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600'

                  if (isSelected && !quizChecked) {
                    btnStyle =
                      'border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-50 ring-2 ring-emerald-500/20 shadow-md'
                  } else if (quizChecked) {
                    if (isCorrect) {
                      btnStyle =
                        'border-2 border-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                    } else if (isSelected && !isCorrect) {
                      btnStyle =
                        'border-2 border-rose-500 bg-rose-100/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20'
                    } else {
                      btnStyle = 'opacity-50 border-slate-200 dark:border-slate-800'
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={quizChecked}
                      onClick={() => {
                        setSelectedOption(optIdx)
                        playSound('click')
                        haptics.selection()
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-2xl p-4 text-left text-sm sm:text-base font-semibold leading-snug transition-all active:scale-[0.99] ${btnStyle}`}
                    >
                      <span className="flex-1">{option}</span>
                      {quizChecked && isCorrect && (
                        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                      )}
                      {quizChecked && isSelected && !isCorrect && (
                        <XCircle size={20} className="text-rose-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Feedback izohi (Tekshirilgandan so'ng) */}
              {quizChecked && (
                <div
                  className={`mt-4 rounded-2xl p-4 border animate-fadeIn ${
                    quizCorrect
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1.5">
                    {quizCorrect ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <span>{ru ? 'Верно!' : "To'g'ri!"}</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="text-rose-500" />
                        <span>{ru ? 'Не совсем так' : 'Adashdingiz'}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{currentSlide.explanation}</p>
                </div>
              )}
            </div>
          ) : currentSlide?.type === 'trap' ? (
            /* SLIDE 4: EXAM TRAP / ADVICE */
            <div className="space-y-5 animate-fadeIn">
              <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-extrabold text-sm sm:text-base mb-3">
                  <span className="text-xl">⚠️</span>
                  <span>{currentSlide.title}</span>
                </div>

                <div className="space-y-4 text-slate-800 dark:text-slate-200">
                  <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-amber-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-500 block mb-1">
                      {ru ? 'Типичная ловушка тестов:' : 'Keng tarqalgan tuzoq:'}
                    </span>
                    <p className="text-sm sm:text-base leading-snug font-medium">
                      {currentSlide.trapText}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-emerald-500/30">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 block mb-1">
                      {ru ? 'Как правильно отвечать:' : "To'g'ri yechim:"}
                    </span>
                    <p className="text-sm sm:text-base leading-snug font-semibold text-emerald-700 dark:text-emerald-300">
                      {currentSlide.solutionText}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* 3. BOTTOM DOCK (Mascot + Primary Button - Brilliant Style) */}
      <footer className="sticky bottom-0 z-30 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80 px-4 py-3 pb-[calc(1rem+var(--safe-bottom,0px))]">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          {/* Maskot / Mascot Icon */}
          <div className="relative size-12 shrink-0 grid place-items-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 p-1">
            <PathMascot variant="avatar" animation={mascotAnimation} />
          </div>

          {/* Action Button */}
          {isCompleted ? (
            <div className="flex flex-1 items-center gap-2">
              {onNextTopic ? (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking()
                    onNextTopic()
                  }}
                  className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3.5 text-base font-extrabold text-white dark:text-slate-900 shadow-md transition-transform active:scale-[0.98]"
                >
                  <span>{ru ? 'Следующая тема' : 'Keyingi mavzu'}</span>
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3.5 text-base font-extrabold text-white dark:text-slate-900 shadow-md transition-transform active:scale-[0.98]"
                >
                  <span>{ru ? 'Завершить' : 'Yakunlash'}</span>
                </button>
              )}
            </div>
          ) : currentSlide?.type === 'quiz' && !quizChecked ? (
            <button
              type="button"
              disabled={selectedOption === null}
              onClick={handleCheckQuiz}
              className={`flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-extrabold transition-all active:scale-[0.98] ${
                selectedOption !== null
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>{ru ? 'Проверить' : 'Tekshirish'}</span>
            </button>
          ) : currentSlide?.type === 'quiz' && quizChecked && !quizCorrect ? (
            <div className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOption(null)
                  setQuizChecked(false)
                }}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw size={16} />
                <span>{ru ? 'Ещё раз' : 'Qayta urinish'}</span>
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3.5 text-base font-extrabold text-white dark:text-slate-900 shadow-md transition-transform active:scale-[0.98]"
              >
                <span>{ru ? 'Продолжить' : 'Davom etish'}</span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3.5 text-base font-extrabold text-white dark:text-slate-900 shadow-md transition-transform active:scale-[0.98]"
            >
              <span>{ru ? 'Дальше' : 'Davom etish'}</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
