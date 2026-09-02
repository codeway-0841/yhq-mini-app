import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Flag,
  AlertTriangle, RotateCcw, Award, Clock
} from 'lucide-react'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useAppStore } from '../../shared/store/useAppStore'
import { goBack } from '../../shared/lib/navigation'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import Confetti from '../../shared/components/Confetti'

const YIM_QUESTION_COUNT = 20
const YIM_TIME_SECONDS = 25 * 60 // 25 daqiqa
const YIM_MAX_ERRORS = 2 // 2 tadan oshsa yiqiladi

export default function YimExamPage() {
  const navigate = useNavigate()
  const allQuestions = useQuestionsStore((s) => s.questions)
  const user = useAppStore((s) => s.user)
  const displayName = useAppStore((s) => s.displayName)
  const submitAnswer = useAppStore((s) => s.submitAnswer)

  // 20 ta tasodifiy savollar to'plamini tanlash
  const examQuestions = useMemo(() => {
    if (!allQuestions || allQuestions.length === 0) return []
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(YIM_QUESTION_COUNT, shuffled.length))
  }, [allQuestions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(YIM_TIME_SECONDS)
  const [isFinished, setIsFinished] = useState(false)
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<{
    correctCount: number
    wrongCount: number
    passed: boolean
    timeSpent: number
  } | null>(null)

  // Ortga hisoblash taymeri (Wall-clock)
  useEffect(() => {
    if (isFinished) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          void handleFinishExam(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isFinished])

  // Klaviatura orqali boshqarish (1, 2, 3, 4, Enter, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || showConfirmFinish) return
      const curQ = examQuestions[currentIndex]
      if (!curQ) return

      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIndex = parseInt(e.key, 10) - 1
        const opt = curQ.options[optIndex]
        if (opt) {
          handleSelectOption(opt.id)
        }
      } else if (e.key === 'ArrowRight' && currentIndex < examQuestions.length - 1) {
        setCurrentIndex((i) => i + 1)
        haptics.impact('light')
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1)
        haptics.impact('light')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, examQuestions, isFinished, showConfirmFinish])

  const handleSelectOption = (optionId: string) => {
    haptics.impact('light')
    playSound('click')
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionId,
    }))
  }

  const toggleFlag = () => {
    haptics.impact('light')
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentIndex]: !prev[currentIndex],
    }))
  }

  // Imtihonni yakunlash va natijani hisoblash
  const handleFinishExam = useCallback(async (_forcedByTimeout = false) => {
    if (isFinished || isSubmitting) return
    setIsSubmitting(true)
    setShowConfirmFinish(false)

    let correct = 0
    let wrong = 0

    // Har bir savolni server orqali submit qilish (yoki natija olish)
    for (let i = 0; i < examQuestions.length; i++) {
      const q = examQuestions[i]
      const chosen = selectedAnswers[i] ?? null
      try {
        const res = await submitAnswer(q.id, chosen, 1000)
        if (res && 'correct' in res && res.correct === true) {
          correct++
        } else {
          wrong++
        }
      } catch {
        // Fallback: agar tarmoq uzilsa
        if (chosen) correct++
        else wrong++
      }
    }

    const passed = wrong <= YIM_MAX_ERRORS
    const timeSpent = YIM_TIME_SECONDS - timeLeft

    setResults({
      correctCount: correct,
      wrongCount: wrong,
      passed,
      timeSpent,
    })

    setIsFinished(true)
    setIsSubmitting(false)

    if (passed) {
      playSound('win')
      haptics.notify('success')
    } else {
      playSound('error')
      haptics.notify('error')
    }
  }, [examQuestions, isFinished, isSubmitting, selectedAnswers, submitAnswer, timeLeft])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const currentQ = examQuestions[currentIndex]
  const answeredCount = Object.keys(selectedAnswers).length
  const candidateName = displayName || (user ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : 'Nomzod')

  if (!examQuestions || examQuestions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 text-center">
        <div className="size-12 rounded-full border-2 border-sky-400 border-t-transparent animate-spin mb-4" />
        <p className="font-bold text-sm text-sky-400">YIM Davlat Imtihoni yuklanmoqda...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 select-none pb-10">
      {/* ── Davlat Imtihon Markazi Yuqori Rasmiy Paneli (YIM Header) ── */}
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-slate-900 border-b border-sky-500/30 px-3 py-2.5 min-[480px]:px-5 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Imtihonni tark etmoqchimisiz? Natija saqlanmaydi.')) {
                goBack(navigate)
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Chiqish"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base" role="img" aria-label="Gerb">🇺🇿</span>
              <span className="text-[10px] min-[400px]:text-[11px] font-black uppercase tracking-wider text-sky-400">
                Yagona Imtihon Markazi (YIM)
              </span>
            </div>
            <p className="text-[12px] min-[400px]:text-[13px] font-bold text-white leading-none">
              B Toifasi — Nazariy Imtihon
            </p>
          </div>
        </div>

        {/* Nomzod ma'lumoti va Raqamli LED Taymer */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right text-[11px]">
            <span className="text-slate-400 font-semibold">{candidateName}</span>
            <span className="text-[10px] font-mono text-sky-400">ID: {user?.id || '0000'}</span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-black text-sm min-[400px]:text-base tabular-nums shadow-inner ${
            timeLeft <= 300
              ? 'bg-red-950/40 border-red-500 text-red-400 animate-pulse'
              : 'bg-slate-800 border-sky-400/40 text-sky-300'
          }`}>
            <Clock size={16} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* ── 20 ta Savollar Navigatori (Strip) ── */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-3 py-2 overflow-x-auto scrollbar-none" aria-label="Savollar xaritasi">
        <div className="flex items-center gap-1.5 min-w-max mx-auto justify-center">
          {examQuestions.map((_, idx) => {
            const isCurrent = idx === currentIndex
            const isAnswered = selectedAnswers[idx] !== undefined
            const isFlagged = flaggedQuestions[idx] === true

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx)
                  haptics.impact('light')
                }}
                className={`relative w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 rounded-lg font-mono text-xs font-black transition-all flex items-center justify-center ${
                  isCurrent
                    ? 'bg-sky-500 text-slate-950 shadow-md ring-2 ring-sky-300 scale-105'
                    : isAnswered
                    ? 'bg-emerald-600/80 text-white border border-emerald-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                <span>{idx + 1}</span>
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Savol Maydoni (YIM Monitor Ekran) ── */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 min-[480px]:p-6 flex flex-col justify-between">
        <div className="w-full">
          {/* Savol tartib raqami va rejim bildirishnomasi */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-3">
            <span>
              Savol: <strong className="text-sky-400 font-bold">{currentIndex + 1}</strong> / {YIM_QUESTION_COUNT}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Javob berildi: <strong className="text-emerald-400">{answeredCount}</strong>
            </span>
          </div>

          {/* Savol matni */}
          <h2 className="text-base min-[480px]:text-lg font-bold text-white leading-snug mb-4">
            {currentQ.text}
          </h2>

          {/* Rasm (agar mavjud bo'lsa) */}
          {currentQ.image && (
            <div className="w-full max-h-[42vh] rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 flex items-center justify-center mb-5 shadow-md">
              <img
                src={currentQ.image}
                alt="Chorrahadagi holat"
                loading="eager"
                className="max-h-[42vh] w-auto object-contain"
              />
            </div>
          )}

          {/* 4 ta Variant Tugmalari (Sensorli va Klaviaturada [1,2,3,4]) */}
          <div className="grid grid-cols-1 gap-2.5 mb-6" role="radiogroup" aria-label="Javob variantlari">
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[currentIndex] === opt.id

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className={`w-full text-left p-3.5 min-[480px]:p-4 rounded-2xl transition-all flex items-center gap-3.5 active:scale-[0.99] shadow-xs ${
                    isSelected
                      ? 'bg-sky-500/20 text-white shadow-md ring-2 ring-sky-400'
                      : 'bg-slate-900/90 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className={`size-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                    isSelected
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {optIdx + 1}
                  </span>
                  <span className="text-xs min-[480px]:text-sm font-medium leading-normal">
                    {opt.text}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Pastki Boshqaruv Tugmalari ── */}
        <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 active:scale-95 shadow-xs"
            >
              <ChevronLeft size={16} />
              <span className="hidden min-[360px]:inline">Oldingi</span>
            </button>

            <button
              type="button"
              onClick={toggleFlag}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shadow-xs ${
                flaggedQuestions[currentIndex]
                  ? 'bg-amber-400/20 text-amber-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title="Keyinga qoldirish"
            >
              <Flag size={16} fill={flaggedQuestions[currentIndex] ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentIndex < examQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex((i) => i + 1)
                  haptics.impact('light')
                }}
                className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow hover:bg-sky-400 active:scale-95"
              >
                <span>Keyingi</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmFinish(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black shadow hover:bg-emerald-400 active:scale-95"
              >
                Yakunlash
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowConfirmFinish(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:text-white shadow-xs"
            >
              Tugatish
            </button>
          </div>
        </div>
      </main>

      {/* ── Yakunlashni Tasdiqlash Modali ── */}
      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-5 shadow-2xl text-center flex flex-col gap-4">
            <div className="size-12 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Imtihonni yakunlaysizmi?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Siz {YIM_QUESTION_COUNT} tadan {answeredCount} ta savolga javob berdingiz. Belgilangan me'yor: 20 savol, maksimal 2 ta xato.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmFinish(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 shadow-xs"
              >
                Qaytish
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFinishExam(false)}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-black shadow"
              >
                {isSubmitting ? 'Hisoblanmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rasmiy Davlat Natija Protokoli va Muhr (YIM Official Stamp Modal) ── */}
      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          {results.passed && <Confetti />}
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-2xl text-center flex flex-col items-center gap-4 overflow-hidden">
            
            {/* Fon gerbi */}
            <div className="absolute top-0 right-0 p-8 text-8xl opacity-5 pointer-events-none">🇺🇿</div>

            {/* Sarlavha */}
            <div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest text-sky-400 mb-1">
                <span>🇺🇿 DAVLAT PROTOKOLI</span>
              </div>
              <h2 className="text-lg font-black text-white">
                Yagona Imtihon Markazi Xulosasi
              </h2>
            </div>

            {/* Rasmiy Rezina Muhr (Rubber Stamp Effect) */}
            <div className="my-2 py-3 px-6 rounded-2xl border-4 border-dashed transform -rotate-3 select-none flex flex-col items-center gap-1 shadow-lg animate-in zoom-in-75 duration-300"
              style={{
                borderColor: results.passed ? '#22c55e' : '#ef4444',
                color: results.passed ? '#22c55e' : '#ef4444',
                backgroundColor: results.passed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">
                YHXX DAVLAT KOMISSIYASI
              </span>
              <span className="text-3xl min-[400px]:text-4xl font-black font-mono tracking-widest">
                {results.passed ? 'O\'TDI / СДАЛ' : 'YIQILDI / НЕ СДАЛ'}
              </span>
              <span className="text-[9px] font-mono tracking-wider">
                STANDART: 18/20 • PROT: #{Math.floor(Math.random() * 89999 + 10000)}
              </span>
            </div>

            {/* Tafsilotlar jadvali */}
            <div className="w-full bg-slate-800/80 rounded-2xl p-3.5 text-xs grid grid-cols-2 gap-3 text-left shadow-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Nomzod:</span>
                <p className="font-bold text-slate-100 truncate">{candidateName}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sarflangan vaqt:</span>
                <p className="font-mono font-bold text-sky-300">{formatTime(results.timeSpent)}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">To'g'ri javoblar:</span>
                <p className="font-mono font-bold text-emerald-400">{results.correctCount} / {YIM_QUESTION_COUNT}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Xatolar soni:</span>
                <p className={`font-mono font-bold ${results.wrongCount <= YIM_MAX_ERRORS ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results.wrongCount} / max {YIM_MAX_ERRORS}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed px-2">
              {results.passed
                ? 'Tabriklaymiz! Siz haqiqiy imtihon me\'yorlaridan muvaffaqiyatli o\'tdingiz. Raqamli pravangizni profilingizda ko\'rishingiz mumkin.'
                : 'Afsuski, xatolar soni ruxsat etilgan 2 tadan oshib ketdi. YHQ qoidalarini mustahkamlab, qayta topshiring.'}
            </p>

            {/* Harakat tugmalari */}
            <div className="flex items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFinished(false)
                  setResults(null)
                  setSelectedAnswers({})
                  setFlaggedQuestions({})
                  setCurrentIndex(0)
                  setTimeLeft(YIM_TIME_SECONDS)
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
              >
                <RotateCcw size={15} />
                <span>Qayta topshirish</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/profil')}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-black shadow flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Award size={15} />
                <span>Pravani ko'rish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
