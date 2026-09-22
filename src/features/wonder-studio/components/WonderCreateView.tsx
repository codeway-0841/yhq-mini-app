import { useState, useRef, useEffect } from 'react'
import {
  Upload,
  BookOpen,
  Mic,
  ArrowUp,
  ChevronLeft,
} from 'lucide-react'
import { useWonderStore } from '../store/useWonderStore'
import { useAppStore } from '../../../shared/store/useAppStore'
import { api } from '../../../shared/api'
import { convertAiCourseToWonderCourse, createLocalCourseFallback } from '../lib/aiCourseAdapter'
import { haptics } from '../../../platform/haptics'
import type { WonderCourse } from '../types'

type CreateFlowState =
  | 'initial'
  | 'step1_experience'
  | 'step2_goal'
  | 'loading_plan'
  | 'review_outline'

type LessonDepthOption = 'short' | 'standard' | 'deep'

export default function WonderCreateView() {
  const setCurrentNav = useWonderStore((s) => s.setCurrentNav)
  const addCustomCourse = useWonderStore((s) => s.addCustomCourse)
  const setActiveCourse = useWonderStore((s) => s.setActiveCourse)

  const [flowState, setFlowState] = useState<CreateFlowState>('initial')
  const [topicInput, setTopicInput] = useState('')
  const [customResponse, setCustomResponse] = useState('')
  const [inputKind, setInputKind] = useState<'topic' | 'link' | 'pdf'>('topic')
  const [inputRefVal, setInputRefVal] = useState('')
  const [isListening, setIsListening] = useState(false)

  // Conversational choices
  const [selectedExperience, setSelectedExperience] = useState('')
  const [selectedGoal, setSelectedGoal] = useState('')

  // Goal confirmation state
  const [courseNameInput, setCourseNameInput] = useState('')
  const [courseGoalInput, setCourseGoalInput] = useState('')
  const [courseBackgroundInput, setCourseBackgroundInput] = useState('')
  const [lessonDepth] = useState<LessonDepthOption>('standard')

  // Loading and generated outline state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCourse, setGeneratedCourse] = useState<WonderCourse | null>(null)

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    haptics.impact('medium')

    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim()

    setInputKind('pdf')
    setInputRefVal(file.name)
    setTopicInput(cleanName)
    setCourseNameInput(`${cleanName}: Core Concepts & Principles`)

    // If text/markdown file, read snippet for contextual richness
    if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = (re) => {
        const text = (re.target?.result as string) || ''
        const firstLine = text.split('\n').find((l) => l.trim().length > 3)
        if (firstLine && firstLine.length < 100) {
          setTopicInput(firstLine.replace(/^[#*-\s]+/, '').trim())
        }
      }
      reader.readAsText(file.slice(0, 2000))
    }

    setFlowState('step1_experience')
  }

  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setIsListening(false)
      return
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!SpeechRec) {
      return
    }

    try {
      const recognition = new SpeechRec()
      recognition.continuous = false
      recognition.interimResults = false
      const lang = useAppStore.getState().settings.language || 'uz'
      recognition.lang = lang === 'ru' ? 'ru-RU' : 'uz-UZ'

      recognition.onstart = () => {
        setIsListening(true)
        haptics.impact('medium')
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript
        if (transcript) {
          setTopicInput(transcript)
          haptics.notify('success')
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  // Scroll chat thread to bottom on message progression
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [flowState])

  const lang = useAppStore((s) => s.settings.language) || 'uz'

  // Extract clean subject name from topic for experience pills
  const cleanSubjectName = (text: string) => {
    const t = text.trim()
    const lower = t.toLowerCase()
    if (lower.includes('physics') || lower.includes('fizika')) return lang === 'uz' ? 'fizika' : lang === 'ru' ? 'физике' : 'physics'
    if (lower.includes('math') || lower.includes('matematika')) return lang === 'uz' ? 'matematika' : lang === 'ru' ? 'математике' : 'math'
    if (lower.includes('biology') || lower.includes('biologiya')) return lang === 'uz' ? 'biologiya' : lang === 'ru' ? 'биологии' : 'biology'
    if (lower.includes('history') || lower.includes('tarix')) return lang === 'uz' ? 'tarix' : lang === 'ru' ? 'истории' : 'history'
    if (lower.includes('chemistry') || lower.includes('kimyo')) return lang === 'uz' ? 'kimyo' : lang === 'ru' ? 'химии' : 'chemistry'
    if (lower.includes('programming') || lower.includes('python') || lower.includes('coding') || lower.includes('dasturlash')) {
      return lang === 'uz' ? 'dasturlash' : lang === 'ru' ? 'программировании' : 'coding'
    }
    if (lower.includes('economics') || lower.includes('finance') || lower.includes('iqtisodiyot')) {
      return lang === 'uz' ? 'moliya' : lang === 'ru' ? 'финансах' : 'finance'
    }
    return t.length > 20 ? t.slice(0, 18) + '...' : t
  }

  const subject = cleanSubjectName(topicInput)

  const experienceOptions = ((): string[] => {
    if (lang === 'ru') {
      return [
        `Нет опыта в теме «${subject}»`,
        `Школьный уровень ${subject}`,
        `Университетский уровень ${subject}`,
        `Изучал смежные науки или математику`,
      ]
    }
    if (lang === 'uz') {
      return [
        `${subject} bo'yicha bilimim yo'q`,
        `Maktab darajasida bilaman`,
        `Universitet / professional darajada`,
        `Matematika yoki turdosh sohani bilaman`,
      ]
    }
    return [
      `No ${subject} background`,
      `High-school ${subject}`,
      `College-level ${subject}`,
      `I have studied math or another science`,
    ]
  })()

  const goalOptions = ((): string[] => {
    if (lang === 'ru') {
      return [
        'Быстрый обзор ключевых концепций',
        'Понять глубокие теоретические основы',
        'Практическое применение в реальной жизни',
        'Повторить и подготовиться к экзамену/работе',
      ]
    }
    if (lang === 'uz') {
      return [
        'Asosiy tushunchalarni tezda tushunish',
        'Chuqur nazariy asoslarni o\'rganish',
        'Haqiqiy amaliyot va loyihalarda qo\'llash',
        'Imtihon yoki ish uchun takrorlash',
      ]
    }
    return [
      'Get a solid overview of core concepts',
      'Understand deep theoretical fundamentals',
      'Build real-world practical applications',
      'Brush up & review for exam or work',
    ]
  })()

  // Step 0 -> Step 1
  const handleProceedToStep1 = () => {
    const topic = topicInput.trim()
    if (!topic) return
    haptics.impact('light')
    const titleSuffix =
      lang === 'ru' ? ': Основы и практика' : lang === 'uz' ? ': Asoslar va Amaliyot' : ': Foundations & Applications'
    setCourseNameInput(`${topic}${titleSuffix}`)
    setFlowState('step1_experience')
  }

  // Step 1 -> Step 2
  const handleSelectExperience = (exp: string) => {
    haptics.impact('light')
    setSelectedExperience(exp)
    setCourseBackgroundInput(exp)
    setCustomResponse('')
    setFlowState('step2_goal')
  }

  // Step 2 -> Start Generation (1:1 with Wondering 2-step personalization)
  const handleSelectGoal = (goal: string) => {
    haptics.impact('light')
    setSelectedGoal(goal)
    setCourseGoalInput(goal)
    setCustomResponse('')
    handleStartGeneration(false, undefined, goal)
  }

  // Direct or Step 2 -> Trigger generation
  const handleStartGeneration = async (
    directBypass = false,
    customExp?: string,
    customGoal?: string,
  ) => {
    const topic = topicInput.trim()
    if (!topic || isGenerating) return

    haptics.impact('medium')
    setIsGenerating(true)
    setFlowState('loading_plan')

    const defaultExp = lang === 'ru' ? 'Базовый уровень' : lang === 'uz' ? 'Boshlang\'ich daraja' : 'Standard background'
    const defaultGoal = lang === 'ru' ? 'Полное понимание темы' : lang === 'uz' ? 'Mavzuni to\'liq o\'rganish' : 'Core concept mastery'
    const exp = customExp || (directBypass ? defaultExp : (courseBackgroundInput || selectedExperience || defaultExp))
    const goal = customGoal || (directBypass ? defaultGoal : (courseGoalInput || selectedGoal || defaultGoal))
    const depth = lessonDepth

    const userFacts = useWonderStore.getState().factsAboutYou?.trim()
    const enrichedBackground = userFacts
      ? `${exp}. Shaxsiy o'rganuvchi profili: ${userFacts}`
      : exp

    const language: 'uz' | 'ru' | 'en' = lang === 'ru' ? 'ru' : (lang as string) === 'en' ? 'en' : 'uz'

    try {
      // 1. Backend real generation call
      const createRes = await api.createAiCourse({
        topic: topic.slice(0, 200),
        inputKind,
        inputRef: inputRefVal ? inputRefVal.slice(0, 500) : `${enrichedBackground} | ${goal}`,
        lessonLength: depth,
        language,
        learnerRole: cleanSubjectName(topic),
        learningGoal: goal,
        backgroundLevel: enrichedBackground.slice(0, 400),
      })

      if (createRes?.ok && createRes.course?.id) {
        const detailRes = await api.getAiCourse(createRes.course.id)
        if (detailRes?.ok && detailRes.course) {
          const wonderCourse = convertAiCourseToWonderCourse(detailRes.course)
          if (courseNameInput.trim()) {
            wonderCourse.title = courseNameInput.trim()
          }
          setGeneratedCourse(wonderCourse)
          if (directBypass) {
            addCustomCourse(wonderCourse)
            setActiveCourse(wonderCourse.id)
            setCurrentNav('home')
            haptics.notify('success')
            return
          }
          setFlowState('review_outline')
          haptics.notify('success')
          return
        }
      }
      throw new Error('Fallback to local deterministic course')
    } catch {
      // 2. Local fallback
      const fallbackCourse = createLocalCourseFallback(topic, language)
      if (courseNameInput.trim()) {
        fallbackCourse.title = courseNameInput.trim()
      }
      setGeneratedCourse(fallbackCourse)
      if (directBypass) {
        addCustomCourse(fallbackCourse)
        setActiveCourse(fallbackCourse.id)
        setCurrentNav('home')
        haptics.notify('success')
        return
      }
      setFlowState('review_outline')
      haptics.notify('success')
    } finally {
      setIsGenerating(false)
    }
  }

  // Accept and Start Course from Outline Review
  const handleAcceptOutline = () => {
    if (!generatedCourse) return
    haptics.notify('success')
    addCustomCourse(generatedCourse)
    setActiveCourse(generatedCourse.id)
    setCurrentNav('home')
  }

  // --- VIEW 1: LOADING PLAN SCREEN (1:1 Wondering bundle line 6783000) ---
  if (flowState === 'loading_plan') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFDF8] dark:bg-[#150F0D] text-center px-6 select-none animate-in fade-in duration-200">
        <div className="max-w-md mx-auto space-y-6">
          <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
            {lang === 'ru' ? 'ГЕНЕРАЦИЯ ПЛАНА КУРСА' : lang === 'uz' ? 'KURS REJASI YARATILMOQDA' : 'GENERATING LESSON PLAN'}
          </p>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            {lang === 'ru' ? 'Создаём ваш курс' : lang === 'uz' ? 'Kurs tuzilmoqda' : 'Building your course'}
          </h1>

          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
            {courseNameInput || topicInput}
          </p>

          {/* Animated Mascot */}
          <div className="py-6 flex items-center justify-center">
            <div className="relative">
              <img
                src="/star.svg"
                alt=""
                className="size-24 sm:size-28 animate-bounce transition-transform duration-700"
              />
              <div className="absolute -bottom-2 inset-x-0 h-3 bg-black/10 dark:bg-black/30 rounded-full blur-xs animate-pulse" />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-stone-400 dark:text-stone-500 font-medium">
            {lang === 'ru' ? 'Обычно это занимает несколько секунд.' : lang === 'uz' ? 'Bu odatda bir necha soniya vaqt oladi.' : 'This usually takes a few seconds.'}
          </p>
        </div>
      </div>
    )
  }

  // --- VIEW 2: COURSE OUTLINE REVIEW SCREEN (1:1 Wondering bundle line 6784000) ---
  if (flowState === 'review_outline' && generatedCourse) {
    const totalSections = generatedCourse.sections.length
    const totalLessons = generatedCourse.sections.reduce((acc, s) => acc + s.lessons.length, 0)
    const totalMinutes = generatedCourse.sections.reduce(
      (acc, s) => acc + s.lessons.reduce((lAcc, l) => lAcc + (l.durationMinutes || 5), 0),
      0,
    )

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#FFFDF8] dark:bg-[#150F0D] text-stone-900 dark:text-stone-100 select-none overflow-hidden animate-in fade-in duration-200 font-sans">
        {/* Top Header */}
        <header className="sticky top-[var(--safe-top,0px)] z-30 bg-[#FFFDF8]/95 dark:bg-[#150F0D]/95 backdrop-blur-md border-b border-[#E7E2D6] dark:border-stone-800 px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFlowState('step2_goal')}
              className="p-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              {lang === 'ru' ? 'План курса' : lang === 'uz' ? 'Kurs rejasi' : 'Course outline'}
            </h2>
          </div>
        </header>

        {/* Scrollable Outline Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-28">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug">
                {generatedCourse.title}
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1.5">
                {generatedCourse.description}
              </p>
            </div>

            {/* Meta summary chips */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
              <span className="px-3 py-1 rounded-full border border-[#E7E2D6] dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-800/60 shadow-2xs">
                {totalSections} {lang === 'ru' ? 'раздела' : lang === 'uz' ? 'ta bo\'lim' : 'sections'}
              </span>
              <span className="px-3 py-1 rounded-full border border-[#E7E2D6] dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-800/60 shadow-2xs">
                {totalLessons} {lang === 'ru' ? 'уроков' : lang === 'uz' ? 'ta dars' : 'lessons'}
              </span>
              <span className="px-3 py-1 rounded-full border border-[#E7E2D6] dark:border-stone-800 bg-[#FAF8F2] dark:bg-stone-800/60 shadow-2xs">
                ~{totalMinutes} {lang === 'ru' ? 'мин всего' : lang === 'uz' ? 'daq jami' : 'min total'}
              </span>
            </div>

            {/* Sections Accordion / Preview */}
            <div className="space-y-4 pt-2">
              {generatedCourse.sections.map((sec, secIdx) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-[#E7E2D6] dark:border-stone-800 bg-white dark:bg-[#1E1512] p-4 sm:p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                      {secIdx + 1}. {sec.title.replace(/^\d+\.\s*/, '')}
                    </h3>
                    <span className="text-xs text-stone-400 font-mono">
                      {sec.lessons.length} {lang === 'ru' ? 'уроков' : lang === 'uz' ? 'dars' : 'lessons'}
                    </span>
                  </div>

                  <div className="divide-y divide-[#F2EDE2] dark:divide-stone-800/80">
                    {sec.lessons.map((l, lIdx) => (
                      <div
                        key={l.id}
                        className="py-2.5 flex items-start justify-between gap-3 text-xs sm:text-sm"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="size-6 rounded-full bg-[#EFECE3] dark:bg-stone-800 flex items-center justify-center text-[11px] font-bold text-stone-600 dark:text-stone-400 shrink-0 mt-0.5">
                            {lIdx + 1}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="block font-medium text-stone-900 dark:text-stone-100">
                                {l.title}
                              </span>
                              {l.objective && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] font-mono">
                                  🎯 {l.objective}
                                </span>
                              )}
                            </div>
                            {l.hook ? (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 italic">
                                &ldquo;{l.hook}&rdquo;
                              </p>
                            ) : l.tldr ? (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1">
                                {l.tldr}
                              </p>
                            ) : null}
                            {l.likelyConfusion && (
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 line-clamp-1 font-sans">
                                ⚠️ <span className="font-semibold">{lang === 'ru' ? 'Заблуждение:' : lang === 'uz' ? 'Xato tasavvur:' : 'Misconception:'}</span> {l.likelyConfusion}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-stone-400 shrink-0 font-mono mt-0.5">
                          {l.durationMinutes || 5}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <footer className="fixed inset-x-0 bottom-0 z-30 pb-[var(--safe-bottom,0px)] bg-gradient-to-t from-[#FFFDF8] via-[#FFFDF8]/95 to-transparent dark:from-[#150F0D] dark:via-[#150F0D]/95 pt-4 px-4 select-none">
          <div className="max-w-3xl mx-auto flex items-center gap-3 py-3 border-t border-[#E7E2D6]/80 dark:border-stone-800/80">
            <button
              type="button"
              onClick={() => setFlowState('step2_goal')}
              className="flex-1 py-3 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-bold uppercase tracking-wider shadow-[0_3px_0_0_#DCD6CA] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center"
            >
              {lang === 'ru' ? 'ИЗМЕНИТЬ' : lang === 'uz' ? "O'ZGARISHLAR SO'RASH" : 'REQUEST CHANGES'}
            </button>

            <button
              type="button"
              onClick={handleAcceptOutline}
              className="flex-1 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
            >
              {lang === 'ru' ? 'НАЧАТЬ КУРС' : lang === 'uz' ? 'KURSNI BOSHLASH' : 'START COURSE'}
            </button>
          </div>
        </footer>
      </div>
    )
  }

  // --- VIEW 3: FULLSCREEN CONVERSATIONAL QUESTIONNAIRE (Steps 1, 2) ---
  if (
    flowState === 'step1_experience' ||
    flowState === 'step2_goal'
  ) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-between bg-[#FFFDF8] dark:bg-[#150F0D] text-stone-900 dark:text-stone-100 font-sans select-none overflow-hidden animate-in fade-in duration-200">
        {/* Top Navigation Bar: Back & Create Course Directly (1:1 with course_generation_step1.png) */}
        <header className="sticky top-[var(--safe-top,0px)] z-30 bg-[#FFFDF8]/95 dark:bg-[#150F0D]/95 px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (flowState === 'step2_goal') setFlowState('step1_experience')
                else setFlowState('initial')
              }}
              className="px-4 py-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#DCD6CA] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {lang === 'ru' ? 'НАЗАД' : lang === 'uz' ? 'ORTGA' : 'BACK'}
            </button>

            <button
              type="button"
              onClick={() => handleStartGeneration(true)}
              className="px-4 py-1.5 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono font-bold uppercase tracking-wider shadow-[0_3px_0_0_#DCD6CA] dark:shadow-[0_3px_0_0_#292524] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {lang === 'ru' ? 'СОЗДАТЬ НАПРЯМУЮ' : lang === 'uz' ? "TO'G'RIDAN-TO'G'RI YARATISH" : 'CREATE COURSE DIRECTLY'}
            </button>
          </div>
        </header>

        {/* Scrollable Conversation Thread */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-32"
        >
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Centered Personalization Intro */}
            <p className="text-center text-xs sm:text-sm text-[#6B6255] dark:text-stone-400 font-medium leading-relaxed max-w-xl mx-auto pt-2">
              {lang === 'ru'
                ? 'Чтобы персонализировать ваш курс, определим ваш начальный уровень и цель обучения.'
                : lang === 'uz'
                  ? 'Kursni sizga moslashtirish uchun, keling, maqsadingiz va bilim darajangizni aniqlaymiz.'
                  : "To personalize your course, let's understand your learning goal and background knowledge."}
            </p>

            {/* User Topic Bubble (Right) */}
            <div className="flex justify-end">
              <div className="px-5 py-2.5 rounded-2xl bg-[#E0F2FE] dark:bg-[#0C4A6E]/60 text-stone-900 dark:text-[#38BDF8] text-xs sm:text-sm font-semibold shadow-2xs">
                {topicInput}
              </div>
            </div>

            {/* AI Question 1: Experience (Left) */}
            <div className="space-y-3.5 pt-1">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                {lang === 'ru'
                  ? `Какой у вас опыт в теме «${topicInput}» или смежных предметах?`
                  : lang === 'uz'
                    ? `${topicInput} yoki turdosh sohalar bo'yicha qanday tajribaga egasiz?`
                    : `What experience do you bring to ${topicInput} or related subjects?`}
              </h2>

              {flowState === 'step1_experience' && (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {experienceOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectExperience(opt)}
                      className="px-4 py-2.5 rounded-2xl border border-[#E7E2D6] dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 hover:border-stone-400 hover:shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Experience Choice Bubble (Right) */}
            {selectedExperience && (
              <div className="flex justify-end animate-in fade-in duration-150">
                <div className="px-5 py-2.5 rounded-2xl bg-[#E0F2FE] dark:bg-[#0C4A6E]/60 text-stone-900 dark:text-[#38BDF8] text-xs sm:text-sm font-semibold shadow-2xs">
                  {selectedExperience}
                </div>
              </div>
            )}

            {/* AI Question 2: Goal (Left) */}
            {flowState === 'step2_goal' && (
              <div className="space-y-3.5 pt-2 animate-in fade-in duration-200">
                <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                  {lang === 'ru'
                    ? `Какова ваша основная цель в изучении «${topicInput}»?`
                    : lang === 'uz'
                      ? `${topicInput} bo'yicha asosiy maqsadingiz nima?`
                      : `What is your primary goal with ${topicInput}?`}
                </h2>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {goalOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectGoal(opt)}
                      className="px-4 py-2.5 rounded-2xl border border-[#E7E2D6] dark:border-stone-700 bg-white dark:bg-stone-800 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 hover:border-stone-400 hover:shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User Goal Choice Bubble (Right) */}
            {selectedGoal && (
              <div className="flex justify-end animate-in fade-in duration-150">
                <div className="px-5 py-2.5 rounded-2xl bg-[#E0F2FE] dark:bg-[#0C4A6E]/60 text-stone-900 dark:text-[#38BDF8] text-xs sm:text-sm font-semibold shadow-2xs">
                  {selectedGoal}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Custom Response Bar (When in step1 or step2) */}
        <div className="sticky bottom-0 inset-x-0 pb-[var(--safe-bottom,0px)] bg-gradient-to-t from-[#FFFDF8] via-[#FFFDF8]/95 to-transparent dark:from-[#150F0D] dark:via-[#150F0D]/95 pt-4 px-4 select-none">
          <div className="max-w-2xl mx-auto w-full pb-3">
            <div className="rounded-2xl border border-[#E5E0D5] dark:border-stone-800 bg-white dark:bg-[#1C1411] p-3 shadow-xs space-y-2">
              <input
                type="text"
                value={customResponse}
                onChange={(e) => setCustomResponse(e.target.value)}
                placeholder={
                  lang === 'ru'
                    ? 'Или напишите свой ответ здесь...'
                    : lang === 'uz'
                      ? "Yoki o'z javobingizni bu yerga yozing..."
                      : 'Or type your own response here...'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customResponse.trim()) {
                    e.preventDefault()
                    if (flowState === 'step1_experience') {
                      handleSelectExperience(customResponse.trim())
                    } else if (flowState === 'step2_goal') {
                      handleSelectGoal(customResponse.trim())
                    }
                  }
                }}
                className="w-full bg-transparent px-1 py-0.5 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-hidden font-medium"
              />

              <div className="flex items-center justify-between pt-1.5 border-t border-[#F0EBE0] dark:border-stone-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Upload file"
                    aria-label="Upload file"
                    className="size-8 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Upload size={14} />
                  </button>
                  <button
                    type="button"
                    title="Voice input"
                    aria-label="Voice input"
                    className="size-8 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Mic size={14} />
                  </button>
                </div>

                {customResponse.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      if (flowState === 'step1_experience') {
                        handleSelectExperience(customResponse.trim())
                      } else if (flowState === 'step2_goal') {
                        handleSelectGoal(customResponse.trim())
                      }
                    }}
                    className="size-8 rounded-full flex items-center justify-center bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <ArrowUp size={15} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- VIEW 0: INITIAL CREATE SCREEN (1:1 with live_auth_create.png) ---
  return (
    <div className="flex flex-col justify-between h-full min-h-[520px] max-w-3xl mx-auto w-full select-none animate-in fade-in duration-150 py-4 px-2 sm:px-6">
      {/* Hidden File Input for PDF / Document upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.epub,.doc,.docx"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top & Center Hero Content (1:1 with live_auth_create.png) */}
      <div className="my-auto flex flex-col items-center text-center space-y-6 pt-4 sm:pt-10">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            {lang === 'ru'
              ? 'Чему вы хотите научиться?'
              : lang === 'uz'
                ? "Nima o'rganishni xohlaysiz?"
                : 'What do you want to learn?'}
          </h1>
          <p className="text-[#6B6255] dark:text-stone-400 text-sm sm:text-base mt-2.5 max-w-lg mx-auto leading-relaxed font-sans">
            {lang === 'ru'
              ? 'Расскажите о том, что вам интересно, и я создам для вас персональный курс'
              : lang === 'uz'
                ? "Qiziqayotgan mavzungizni ayting, men siz uchun shaxsiy kurs tuzib beraman"
                : "Tell me what you're curious about, and I'll create a personalized course for you"}
          </p>
        </div>

        {/* Center Dashed Box: Browse Curated Courses (1:1 with live_auth_create.png) */}
        <div className="w-full max-w-xl mx-auto pt-2">
          <div className="rounded-3xl border-2 border-dashed border-[#D5CEBE] dark:border-stone-700 bg-[#F7F4EC]/30 dark:bg-stone-800/20 p-8 sm:p-10 text-center flex flex-col items-center gap-4">
            <p className="text-sm sm:text-base font-medium text-[#443E36] dark:text-stone-300">
              {lang === 'ru'
                ? 'Посмотрите подборку готовых курсов для старта'
                : lang === 'uz'
                  ? 'Tayyor sara kurslar bilan tanishing'
                  : 'Browse curated courses to get started'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentNav('courses')}
                className="px-6 py-3 rounded-xl bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] font-mono text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                {lang === 'ru'
                  ? 'ОБЗОР КАТАЛОГА'
                  : lang === 'uz'
                    ? "KUTUBXONANI KO'RISH"
                    : 'BROWSE LIBRARY'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Prompt Bar (1:1 with live_auth_create.png) */}
      <div className="w-full max-w-2xl mx-auto pt-4 pb-2">
        <div className="rounded-2xl border border-[#E5E0D5] dark:border-stone-800 bg-white dark:bg-[#1C1411] p-3.5 sm:p-4 shadow-xs">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleProceedToStep1()
              }
            }}
            placeholder={
              lang === 'ru'
                ? 'Я хочу изучить...'
                : lang === 'uz'
                  ? "Men o'rganmoqchiman..."
                  : 'I want to learn about...'
            }
            className="w-full bg-transparent outline-hidden text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 px-1 py-1 font-medium pb-3"
          />

          <div className="flex items-center justify-between pt-2.5 border-t border-[#F0EBE0] dark:border-stone-800 px-1">
            {/* Left Tools: 3D Upload & Book buttons (matching live_auth_create.png) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload document (PDF, TXT, MD)"
                aria-label="Upload document"
                className="size-8 sm:size-9 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
              >
                <Upload size={15} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentNav('courses')}
                title="Browse library"
                aria-label="Browse library"
                className="size-8 sm:size-9 rounded-xl border border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
              >
                <BookOpen size={15} />
              </button>
            </div>

            {/* Right Tools: Mic and Submit */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleVoice}
                title={isListening ? 'Listening...' : 'Voice input'}
                aria-label="Voice input"
                className={`size-8 sm:size-9 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                  isListening
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-600 animate-pulse shadow-xs'
                    : 'border-[#DCD6CA] dark:border-stone-700 bg-[#FAF8F2] dark:bg-stone-800 text-stone-600 dark:text-stone-300 shadow-[0_2px_0_0_#DCD6CA] dark:shadow-[0_2px_0_0_#292524] active:translate-y-0.5 active:shadow-none'
                }`}
              >
                <Mic size={15} />
              </button>

              {topicInput.trim() && (
                <button
                  type="button"
                  onClick={handleProceedToStep1}
                  className="size-8 sm:size-9 rounded-full flex items-center justify-center bg-[#59B2E6] hover:bg-[#4BA8DC] text-[#261312] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
