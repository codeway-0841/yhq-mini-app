import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Zap, Crown, Sparkles, Lightbulb, Trophy } from 'lucide-react'
import { useT, type Lang } from '../../../shared/i18n'

// ── Carousel Slide Types ────────────────────────────────────────────────────
interface SlideProps {
  lang: Lang
  continueSubject?: string
  progressPct?: number
  onContinue?: () => void
}

const ContinueLearningSlide = memo(function ContinueLearningSlide({ lang, continueSubject, progressPct = 0, onContinue }: SlideProps) {
  const tt = useT(lang)
  return (
    <button onClick={onContinue} className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgb(var(--p-primary-rgb) / 0.12)', border: '1px solid rgb(var(--p-primary-rgb) / 0.25)' }}>
          <BookOpen size={17} className="text-pprimary" />
        </div>
        <span className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">
          {tt('currentTopic')}
        </span>
      </div>
      <div>
        <p className="text-[16px] font-bold text-pfg leading-snug line-clamp-2">{continueSubject}</p>
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-pline overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progressPct, 3)}%`, background: 'var(--p-primary)' }} />
          </div>
          <span className="text-[11px] font-bold text-pprimary tabular-nums">{progressPct}%</span>
        </div>
      </div>
    </button>
  )
})

const DailyChallengeSlide = memo(function DailyChallengeSlide({ lang }: SlideProps) {
  const tt = useT(lang)
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/adaptive')} className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <Zap size={17} className="text-pwarning" fill="currentColor" />
        </div>
        <span className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">
          {tt('dailyTask')}
        </span>
      </div>
      <div>
        <p className="text-[16px] font-bold text-pfg leading-snug">{tt('dailyTaskDesc')}</p>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[12px] font-bold text-pwarning">+50 XP</span>
          <span className="btn-premium-sm px-3 py-1.5 text-[11px] rounded-xl">{tt('startWord')}</span>
        </div>
      </div>
    </button>
  )
})

const PremiumSlide = memo(function PremiumSlide({ lang }: SlideProps) {
  const tt = useT(lang)
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/premium')} className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.30)' }}>
          <Crown size={17} className="text-pgold" />
        </div>
        <span className="text-[11px] font-semibold text-pgold uppercase tracking-wide">Premium</span>
      </div>
      <div>
        <p className="text-[16px] font-bold text-pfg leading-snug">{tt('premiumTagline')}</p>
        <span className="inline-block mt-2.5 btn-premium-gold px-4 py-2 rounded-xl text-[11px]">
          {tt('tryWord')}
        </span>
      </div>
    </button>
  )
})

const TipsSlide = memo(function TipsSlide({ lang }: SlideProps) {
  const tips = {
    uz: [
      "Har kuni 15 daqiqa mashq — imtihonda 90%+ natijaga olib keladi",
      "Xatolarni qayta yechish — eng samarali o'rganish usuli",
      "Belgilarni rangi va shakli bo'yicha guruhlang — tezroq eslab qolasiz",
    ],
    ru: [
      "15 минут практики в день — путь к 90%+ на экзамене",
      "Повторение ошибок — самый эффективный способ обучения",
      "Группируйте знаки по цвету и форме — запоминаются быстрее",
    ],
  }
  const tip = tips[lang][Math.floor(Date.now() / 86400000) % tips[lang].length]
  return (
    <div className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
          <Lightbulb size={17} className="text-ppurple" />
        </div>
        <span className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">
          {lang === 'ru' ? 'Совет дня' : 'Bugungi maslahat'}
        </span>
      </div>
      <p className="text-[15px] font-semibold text-pfg leading-snug">{tip}</p>
    </div>
  )
})

const EventsSlide = memo(function EventsSlide({ lang }: SlideProps) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/reyting')} className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
          <Trophy size={17} className="text-pblue" />
        </div>
        <span className="text-[11px] font-semibold text-psubtle uppercase tracking-wide">
          {lang === 'ru' ? 'Соревнование' : 'Musobaqa'}
        </span>
      </div>
      <div>
        <p className="text-[16px] font-bold text-pfg leading-snug">
          {lang === 'ru' ? 'Еженедельная лига' : 'Haftalik liga'}
        </p>
        <p className="text-[12px] font-medium text-pmuted mt-1">
          {lang === 'ru' ? 'Соревнуйся и поднимись в рейтинге' : "Raqobatlashing va reytingda ko'taring"}
        </p>
      </div>
    </button>
  )
})

const NewFeatureSlide = memo(function NewFeatureSlide({ lang }: SlideProps) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/octagon')} className="w-full h-full p-5 flex flex-col justify-between text-left">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(91, 227, 0, 0.12)', border: '1px solid rgba(91, 227, 0, 0.25)' }}>
          <Sparkles size={17} className="text-pprimary" />
        </div>
        <span className="text-[11px] font-semibold text-pprimary uppercase tracking-wide">
          {lang === 'ru' ? 'Новое' : 'Yangi'}
        </span>
      </div>
      <div>
        <p className="text-[16px] font-bold text-pfg leading-snug">
          {lang === 'ru' ? 'Дуэль с друзьями' : "Do'stlar bilan duel"}
        </p>
        <p className="text-[12px] font-medium text-pmuted mt-1">
          {lang === 'ru' ? 'Вызови друга на дуэль — кто ответит быстрее?' : "Do'stingizni duelga chaqiring — kim tezroq javob beradi?"}
        </p>
      </div>
    </button>
  )
})

// ── Main Carousel ───────────────────────────────────────────────────────────
export const Carousel = memo(function Carousel({ lang, continueSubject, progressPct, onContinue }: {
  lang: Lang
  continueSubject?: string
  progressPct?: number
  onContinue?: () => void
}) {
  const slides = [
    <ContinueLearningSlide lang={lang} continueSubject={continueSubject} progressPct={progressPct} onContinue={onContinue} />,
    <DailyChallengeSlide lang={lang} />,
    <PremiumSlide lang={lang} />,
    <NewFeatureSlide lang={lang} />,
    <TipsSlide lang={lang} />,
    <EventsSlide lang={lang} />,
  ]

  const count = slides.length
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const deltaX = useRef(0)
  const isDragging = useRef(false)
  const isHorizontal = useRef<boolean | null>(null)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noAnim = useRef(typeof document !== 'undefined' && document.body.dataset.noAnimation === 'true')

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % count) + count) % count)
  }, [count])

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    if (noAnim.current) return
    autoRef.current = setInterval(() => setCurrent((c) => (c + 1) % count), 5000)
  }, [count])

  useEffect(() => {
    resetAuto()
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [resetAuto])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    isHorizontal.current = null
    startX.current = e.clientX
    startY.current = e.clientY
    deltaX.current = 0
    if (autoRef.current) clearInterval(autoRef.current)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy)
      }
      return
    }
    if (!isHorizontal.current) return

    deltaX.current = dx
    if (trackRef.current) {
      trackRef.current.style.transition = 'none'
      trackRef.current.style.transform = `translateX(calc(-${current * 100}% + ${dx}px))`
    }
  }, [current])

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const threshold = 50
    if (deltaX.current < -threshold) goTo(current + 1)
    else if (deltaX.current > threshold) goTo(current - 1)
    if (trackRef.current) {
      trackRef.current.style.transition = noAnim.current ? 'none' : 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)'
      trackRef.current.style.transform = ''
    }
    deltaX.current = 0
    resetAuto()
  }, [current, goTo, resetAuto])

  return (
    <div className="px-5 mb-4">
      <div className="relative overflow-hidden rounded-[24px] card-premium"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}>
        <div ref={trackRef}
          className="flex"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: noAnim.current ? 'none' : 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}>
          {slides.map((slide, i) => (
            <div key={i} className="w-full flex-shrink-0 min-h-[148px]">
              {slide}
            </div>
          ))}
        </div>
        {/* Pagination dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => { goTo(i); resetAuto() }}
              aria-label={`Slide ${i + 1}`}
              className="transition-all duration-300"
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? 'var(--p-primary)' : 'var(--p-line)',
                boxShadow: i === current ? '0 0 8px var(--p-glow)' : 'none',
              }} />
          ))}
        </div>
      </div>
    </div>
  )
})
