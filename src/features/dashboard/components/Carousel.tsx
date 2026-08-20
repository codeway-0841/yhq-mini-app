import { memo, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Crown, Swords, Trophy, GraduationCap, type LucideIcon } from 'lucide-react'
import { type Lang, useT } from '../../../shared/i18n'

// ── Slide config — har slayd o'z route/action'iga o'tadi ────────────────────
// Rang intizomi (v2.1): semantik tokenlar — aksent (davom), warning (kunlik),
// purple (Premium), blue (duel), gold (liga sovrini). Hex-alpha konkat YO'Q —
// tokenlar color-mix bilan aralashadi.
interface SlideConfig {
  icon: LucideIcon
  color: string
  title: (lang: Lang) => string
  subtitle: (lang: Lang) => string
  route?: string
  /** true — darsni davom ettirish (progress bar + onContinue) */
  useOnContinue?: boolean
}

const SLIDES: SlideConfig[] = [
  {
    icon: GraduationCap,
    color: 'var(--p-primary)',
    title: (l) => l === 'ru' ? 'Продолжить обучение' : 'Darsni davom ettiring',
    subtitle: (l) => l === 'ru' ? 'С того места, где остановились' : "To'xtagan joyingizdan",
    useOnContinue: true,
  },
  {
    icon: Zap,
    color: 'var(--p-warning)',
    title: (l) => l === 'ru' ? 'Ежедневный вызов' : 'Kunlik mashq',
    subtitle: (l) => l === 'ru' ? '10 вопросов · +50 XP' : '10 ta savol · +50 XP',
    route: '/adaptive',
  },
  {
    icon: Crown,
    color: 'var(--p-purple)',
    title: (l) => l === 'ru' ? 'Попробуйте Premium' : 'Premium sinab ko\'ring',
    subtitle: (l) => l === 'ru' ? 'Без рекламы · Полный доступ' : 'Reklamasiz · To\'liq kirish',
    route: '/premium',
  },
  {
    icon: Swords,
    color: 'var(--p-blue)',
    title: (l) => l === 'ru' ? 'Дуэль с друзьями' : 'Do\'stlar bilan duel',
    subtitle: (l) => l === 'ru' ? 'Кто ответит быстрее?' : 'Kim tezroq javob beradi?',
    route: '/octagon',
  },
  {
    icon: Trophy,
    color: 'var(--p-gold)',
    title: (l) => l === 'ru' ? 'Еженедельная лига' : 'Haftalik liga',
    subtitle: (l) => l === 'ru' ? 'Поднимайтесь в рейтинге' : 'Reytingda ko\'taring',
    route: '/reyting',
  },
]

// ── Slide card (1ga 1 Premium banner uslubi) ────────────────────────────────
const CarouselSlide = memo(function CarouselSlide({ config, lang, progressPct = 0, lessonLabel, onOpen }: {
  config: SlideConfig
  lang: Lang
  progressPct?: number
  lessonLabel?: string
  onOpen: () => void
}) {
  const Icon = config.icon
  const tt = useT(lang)

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="w-full h-full card-premium p-4 flex items-center gap-3.5 cursor-pointer select-none active:scale-[0.99] transition-transform"
    >
      {/* Icon tile */}
      <div
        className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
        }}
      >
        <Icon size={19} style={{ color: config.color }} />
      </div>

      {/* Title + subtitle/progress */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-pfg truncate">{config.title(lang)}</p>
        {config.useOnContinue ? (
          <>
            <p className="text-[11px] font-medium text-psubtle mt-0.5 tabular-nums truncate">
              {lessonLabel ?? config.subtitle(lang)}
            </p>
            <div className="h-1.5 rounded-full bg-pline overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(progressPct, 3)}%`, background: config.color }}
              />
            </div>
          </>
        ) : (
          <p className="text-[11px] font-medium text-psubtle mt-0.5 truncate">{config.subtitle(lang)}</p>
        )}
      </div>

      {/* CTA button — 1ga 1 Premium banner o'lchami */}
      <button
        type="button"
        className="btn-neon px-4 py-2.5 rounded-xl text-[12px] font-extrabold flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onOpen() }}
      >
        {config.useOnContinue ? tt('continueLearn') : tt('startWord')}
      </button>
    </div>
  )
})

// ── Main Carousel — native scroll-snap (JS gesture-math YO'Q) ───────────────
export const Carousel = memo(function Carousel({ lang, progressPct, lessonLabel, onContinue }: {
  lang: Lang
  progressPct?: number
  lessonLabel?: string
  onContinue?: () => void
}) {
  const navigate = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)
  const paused = useRef(false)

  const openSlide = useCallback((config: SlideConfig) => {
    if (config.useOnContinue) onContinue?.()
    else if (config.route) navigate(config.route)
  }, [navigate, onContinue])

  // Avto — 3.5s da 1 slayd, qo'lda surilganda 4s pauza
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let timer: ReturnType<typeof setInterval> | null = null
    let resumeTimer: ReturnType<typeof setTimeout> | null = null
    const step = () => {
      if (paused.current || !el) return
      const slideW = (el.children[0] as HTMLElement)?.offsetWidth + 12 || el.clientWidth
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: 'smooth' })
      else el.scrollBy({ left: slideW, behavior: 'smooth' })
    }
    timer = setInterval(step, 3500)
    const pause = () => {
      paused.current = true
      if (resumeTimer) clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => { paused.current = false }, 4000)
    }
    const onEnter = () => { paused.current = true; if (resumeTimer) clearTimeout(resumeTimer) }
    const onLeave = () => { paused.current = false }
    const onScroll = () => pause()
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (timer) clearInterval(timer)
      if (resumeTimer) clearTimeout(resumeTimer)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="mb-3.5">
      <div ref={trackRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth-x px-5 pb-1 touch-pan-x select-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const, touchAction: 'pan-x' as const }}>
        {SLIDES.map((config, i) => (
          <div key={i} className="w-full flex-shrink-0 snap-center sm:w-80">
            <CarouselSlide config={config} lang={lang}
              progressPct={progressPct} lessonLabel={lessonLabel}
              onOpen={() => openSlide(config)} />
          </div>
        ))}
      </div>
    </div>
  )
})
