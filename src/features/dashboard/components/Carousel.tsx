import { memo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Zap, Crown, Swords, Trophy, GraduationCap, type LucideIcon } from 'lucide-react'
import { type Lang, useT } from '../../../shared/i18n'

// ── Slide config — har slayd o'z route/action'iga o'tadi ────────────────────
interface SlideConfig {
  icon: LucideIcon
  color: string
  colorDark: string
  title: (lang: Lang) => string
  subtitle: (lang: Lang) => string
  route?: string
  /** true — darsni davom ettirish (progress bar + onContinue) */
  useOnContinue?: boolean
}

const SLIDES: SlideConfig[] = [
  {
    icon: GraduationCap,
    color: '#58cc02', colorDark: '#46a302',
    title: (l) => l === 'ru' ? 'Продолжить обучение' : 'Darsni davom ettiring',
    subtitle: (l) => l === 'ru' ? 'С того места, где остановились' : "To'xtagan joyingizdan",
    useOnContinue: true,
  },
  {
    icon: Zap,
    color: '#ff9600', colorDark: '#e59400',
    title: (l) => l === 'ru' ? 'Ежедневный вызов' : 'Kunlik mashq',
    subtitle: (l) => l === 'ru' ? '10 вопросов · +50 XP' : '10 ta savol · +50 XP',
    route: '/adaptive',
  },
  {
    icon: Crown,
    color: '#ce82ff', colorDark: '#a85ed4',
    title: (l) => l === 'ru' ? 'Попробуйте Premium' : 'Premium sinab ko\'ring',
    subtitle: (l) => l === 'ru' ? 'Без рекламы · Полный доступ' : 'Reklamasiz · To\'liq kirish',
    route: '/premium',
  },
  {
    icon: Swords,
    color: '#1cb0f6', colorDark: '#1899d6',
    title: (l) => l === 'ru' ? 'Дуэль с друзьями' : 'Do\'stlar bilan duel',
    subtitle: (l) => l === 'ru' ? 'Кто ответит быстрее?' : 'Kim tezroq javob beradi?',
    route: '/octagon',
  },
  {
    icon: Trophy,
    color: '#ff4b4b', colorDark: '#d93f3f',
    title: (l) => l === 'ru' ? 'Еженедельная лига' : 'Haftalik liga',
    subtitle: (l) => l === 'ru' ? 'Поднимайтесь в рейтинге' : 'Reytingda ko\'taring',
    route: '/reyting',
  },
]

// ── Slide card ──────────────────────────────────────────────────────────────
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
    <div className="relative w-full h-full card-premium rounded-[24px] p-4 cursor-pointer select-none"
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      {/* Ghost icon — top-right dekor */}
      <Icon size={22} className="absolute top-3.5 right-3.5 opacity-25" style={{ color: config.color }} aria-hidden />

      <div className="flex items-center gap-3.5">
        {/* Icon tile */}
        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(145deg, ${config.color}, ${config.colorDark})`, boxShadow: `0 4px 12px ${config.color}40` }}>
          <Icon size={22} className="text-white" />
        </div>

        {/* Title + subtitle/progress */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[15px] font-bold text-pfg leading-tight truncate">{config.title(lang)}</p>
          {config.useOnContinue ? (
            <>
              <p className="text-[11px] font-medium text-psubtle mt-0.5 tabular-nums">
                {lessonLabel ?? config.subtitle(lang)}
              </p>
              <div className="h-1.5 rounded-full bg-pline overflow-hidden mt-2">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progressPct, 3)}%`, background: config.color }} />
              </div>
            </>
          ) : (
            <p className="text-[11px] font-medium text-psubtle mt-0.5 truncate">{config.subtitle(lang)}</p>
          )}
        </div>

        {/* CTA */}
        <button type="button"
          className="btn-premium btn-premium-sm flex items-center gap-1 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onOpen() }}>
          {config.useOnContinue ? tt('continueLearn') : tt('startWord')}
          <ChevronRight size={14} />
        </button>
      </div>
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
  const [current, setCurrent] = useState(0)

  const openSlide = useCallback((config: SlideConfig) => {
    if (config.useOnContinue) onContinue?.()
    else if (config.route) navigate(config.route)
  }, [navigate, onContinue])

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || el.children.length === 0) return
    const slideW = (el.children[0] as HTMLElement).offsetWidth + 12 // gap-3
    setCurrent(Math.min(SLIDES.length - 1, Math.max(0, Math.round(el.scrollLeft / slideW))))
  }, [])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el || !el.children[i]) return
    const slideW = (el.children[i] as HTMLElement).offsetWidth + 12
    el.scrollTo({ left: i * slideW, behavior: 'smooth' })
  }, [])

  return (
    <div className="mb-4">
      <div ref={trackRef} onScroll={onScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth-x px-5 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}>
        {SLIDES.map((config, i) => (
          <div key={i} className="w-full flex-shrink-0 snap-center min-h-[104px]">
            <CarouselSlide config={config} lang={lang}
              progressPct={progressPct} lessonLabel={lessonLabel}
              onOpen={() => openSlide(config)} />
          </div>
        ))}
      </div>
      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {SLIDES.map((_, i) => (
          <button key={i} type="button" onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            className="transition-all duration-300 cursor-pointer"
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
  )
})
