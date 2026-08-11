import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { type Lang } from '../../../shared/i18n'

// ── Carousel Slide Types ────────────────────────────────────────────────────
interface SlideProps {
  lang: Lang
  continueSubject?: string
  progressPct?: number
  lessonLabel?: string
  onContinue?: () => void
}

interface SlideConfig {
  title: (lang: Lang) => string
  subtitle: (lang: Lang, props: SlideProps) => string
  gradient: string
  progress?: boolean
  route?: string
  useOnContinue?: boolean
}

const SLIDE_CONFIGS: SlideConfig[] = [
  {
    title: (lang) => lang === 'ru' ? 'Продолжить обучение' : 'Darsni davom ettiring',
    subtitle: (lang, props) => props.lessonLabel ?? '',
    gradient: 'linear-gradient(135deg, #1a3a2a 0%, #0d1f17 50%, #162b20 100%)',
    progress: true,
    useOnContinue: true,
  },
  {
    title: (lang) => lang === 'ru' ? 'Ежедневный вызов' : 'Kunlik mashq',
    subtitle: (lang) => lang === 'ru' ? '10 вопросов · +50 XP' : '10 ta savol · +50 XP',
    gradient: 'linear-gradient(135deg, #2a1a0a 0%, #1f1400 50%, #2b1e0a 100%)',
    route: '/adaptive',
  },
  {
    title: (lang) => lang === 'ru' ? 'Попробуйте Premium' : 'Premium sinab ko\'ring',
    subtitle: (lang) => lang === 'ru' ? 'Без рекламы · Полный доступ' : 'Reklamasiz · To\'liq kirish',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    route: '/premium',
  },
  {
    title: (lang) => lang === 'ru' ? 'Дуэль с друзьями' : 'Do\'stlar bilan duel',
    subtitle: (lang) => lang === 'ru' ? 'Кто ответит быстрее?' : 'Kim tezroq javob beradi?',
    gradient: 'linear-gradient(135deg, #0a2a1a 0%, #0d3320 50%, #1a4a2e 100%)',
    route: '/octagon',
  },
  {
    title: (lang) => lang === 'ru' ? 'Еженедельная лига' : 'Haftalik liga',
    subtitle: (lang) => lang === 'ru' ? 'Соревнуйся в рейтинге' : 'Reytingda ko\'taring',
    gradient: 'linear-gradient(135deg, #1a1a3a 0%, #0d1040 50%, #1e1a4a 100%)',
    route: '/reyting',
  },
]

const CarouselSlide = memo(function CarouselSlide({ config, lang, continueSubject, progressPct = 0, lessonLabel, onContinue }: SlideProps & { config: SlideConfig }) {
  const navigate = useNavigate()
  const handleClick = config.useOnContinue ? onContinue : config.route ? () => navigate(config.route!) : undefined

  const title = config.useOnContinue && continueSubject
    ? (lang === 'ru' ? 'Продолжить: ' : '') + continueSubject + (lang === 'uz' ? ' darsini davom ettiring' : '')
    : config.title(lang)

  return (
    <button onClick={handleClick} className="w-full h-full relative overflow-hidden flex items-center text-left">
      <div className="absolute inset-0" style={{ background: config.gradient }} />
      <div className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)' }} />
      <div className="relative z-10 flex items-center justify-between w-full px-5 py-4">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-[15px] font-bold text-white leading-snug line-clamp-2">{title}</p>
          {config.progress ? (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.max(progressPct, 3)}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                {config.subtitle(lang, { lang, lessonLabel })}
              </span>
            </div>
          ) : (
            <p className="text-[12px] text-white/60 mt-1">{config.subtitle(lang, { lang })}</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <ChevronRight size={18} className="text-white" />
        </div>
      </div>
    </button>
  )
})

// ── Main Carousel ───────────────────────────────────────────────────────────
export const Carousel = memo(function Carousel({ lang, continueSubject, progressPct, lessonLabel, onContinue }: {
  lang: Lang
  continueSubject?: string
  progressPct?: number
  lessonLabel?: string
  onContinue?: () => void
}) {
  const slides = SLIDE_CONFIGS.map((config, i) => (
    <CarouselSlide key={i} config={config} lang={lang} continueSubject={continueSubject}
      progressPct={progressPct} lessonLabel={lessonLabel} onContinue={onContinue} />
  ))

  const count = slides.length
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const deltaX = useRef(0)
  const isDragging = useRef(false)
  const isHorizontal = useRef<boolean | null>(null)
  const didSwipe = useRef(false)
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
    didSwipe.current = false
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
    if (Math.abs(deltaX.current) > 10) didSwipe.current = true
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
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => { if (didSwipe.current) { e.stopPropagation(); e.preventDefault() } }}>
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
