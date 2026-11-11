import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BrilliantEndstateRive,
  type BrilliantLessonTrigger,
  type BrilliantPracticeTrigger,
} from './BrilliantEndstateRive'
import { BrilliantCopyContainer, BrilliantRiveContainer } from './BrilliantEndstateShell'
import { haptics } from '../../platform/haptics'
import { playSound } from '../lib/sounds'
import { cn } from '../lib/cn'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** XP sonini 0 dan target ga silliq sanaydi (Brilliant AnimatedCounter) */
export function AnimatedXpCounter({
  active,
  end,
  duration = 650,
}: {
  active: boolean
  end: number
  duration?: number
}) {
  const [val, setVal] = useState(0)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (!active) {
      setVal(0)
      setPulsing(false)
      return
    }
    if (prefersReducedMotion()) {
      setVal(end)
      setPulsing(false)
      return
    }
    let raf = 0
    let startTs: number | null = null
    setPulsing(false)
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      setVal(Math.round(end * p))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setVal(end)
        setPulsing(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, end, duration])

  return (
    <span
      className={cn(
        'inline-block text-[40px] leading-none font-extrabold tracking-tight text-[#29cc57] tabular-nums',
        pulsing && 'brilliant-xp-pulse',
      )}
    >
      +{val}
    </span>
  )
}

/** Sonni 0 dan target ga silliq sanaydi (Brilliant AnimatedCounter) */
export function AnimatedNumber({
  active,
  end,
  duration = 650,
  delay = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  active: boolean
  end: number
  duration?: number
  delay?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const [val, setVal] = useState(0)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (!active) {
      setVal(0)
      setPulsing(false)
      return
    }
    if (prefersReducedMotion()) {
      setVal(end)
      setPulsing(false)
      return
    }
    let raf = 0
    let startTs: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    setPulsing(false)

    const startAnimation = () => {
      const tick = (ts: number) => {
        if (startTs === null) startTs = ts
        const p = Math.min(1, (ts - startTs) / duration)
        setVal(Math.round(end * p))
        if (p < 1) {
          raf = requestAnimationFrame(tick)
        } else {
          setVal(end)
          setPulsing(true)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    if (delay > 0) {
      timeoutId = setTimeout(startAnimation, delay)
    } else {
      startAnimation()
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [active, end, duration, delay])

  return (
    <span className={cn('tabular-nums', pulsing && 'brilliant-xp-pulse', className)}>
      {prefix}{val}{suffix}
    </span>
  )
}

/** Brilliant 1:1 4-qirrali oltin yulduzcha (Sparkle Star) */
export function BrilliantSparkleStar({
  size = 24,
  className = 'text-[#f6b31f]',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z" />
    </svg>
  )
}

function BoltSvg({ variant }: { variant: 'streak' | 'charge' }) {
  if (variant === 'charge') {
    return (
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="11.2" y="9.6" width="9.6" height="12.8" rx="0.8" fill="currentColor" />
        <path d="M16.45 12.11L15.61 16.82H13.67L16.45 12.11Z" fill="#29cc57" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.29 16.23L16.57 8.25C16.94 7.77 17.71 8.10 17.61 8.71L16.71 14.38H20.59C21.33 14.38 21.75 15.24 21.29 15.82L15.01 23.79C14.64 24.27 13.87 23.94 13.97 23.34L14.87 17.66H10.99C10.25 17.66 9.83 16.81 10.29 16.23Z"
        fill="currentColor"
      />
    </svg>
  )
}

const PARTICLES = [
  { angle: 35, size: '2px', start: 18, end: 28, delay: 66 },
  { angle: 45, size: '2.5px', start: 16, end: 26, delay: 0 },
  { angle: 135, size: '2px', start: 20, end: 26, delay: 33 },
  { angle: 225, size: '2.5px', start: 20, end: 26, delay: 0 },
  { angle: 270, size: '3px', start: 16, end: 28, delay: 66 },
  { angle: 305, size: '2px', start: 16, end: 26, delay: 33 },
]

/** Brilliant 1:1 Dars va Mashq yakuni sahnasi (`transition_up` + `reveal_title` + `reveal_xp` + `MAIN_xp-starburst`) */
export function BrilliantCompletionStage({
  mode,
  heading,
  headingId,
  subtitle,
  xpLabel,
  dark,
  variant = 0,
  nonce = 0,
  lessonTrigger = 'kojiFlip',
  isLevel = false,
  levelNumber = 1,
  skillCheckMastered = false,
  practiceTrigger = 'play100',
  practiceStats,
  showXp = true,
  earnedXp = 0,
  animateXpCount = true,
  compact = false,
  fallback,
  onRiveEvent,
  children,
}: {
  mode: 'lesson' | 'practice'
  heading: string
  headingId?: string
  subtitle?: string
  xpLabel: string
  dark: boolean
  variant?: number
  nonce?: number
  lessonTrigger?: BrilliantLessonTrigger
  isLevel?: boolean
  levelNumber?: number
  skillCheckMastered?: boolean
  practiceTrigger?: BrilliantPracticeTrigger
  practiceStats?: {
    correct: number
    wrong?: number
    total: number
    percent: number
    isRu?: boolean
  }
  showXp?: boolean
  earnedXp?: number
  animateXpCount?: boolean
  compact?: boolean
  fallback?: ReactNode
  onRiveEvent?: (name: string) => void
  children?: ReactNode
}) {
  const reduced = prefersReducedMotion()
  const [untranslated, setUntranslated] = useState(reduced)
  const [titleVisible, setTitleVisible] = useState(reduced)
  const [statsVisible, setStatsVisible] = useState(reduced)
  const [xpNonce, setXpNonce] = useState(reduced && showXp ? 1 : 0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setUntranslated(true)
      setTitleVisible(true)
      setStatsVisible(true)
      if (showXp) setXpNonce((n) => n + 1)
      return
    }
    setUntranslated(false)
    setTitleVisible(false)
    setStatsVisible(false)
    const fallbackTimer = setTimeout(() => {
      setUntranslated(true)
      setTitleVisible(true)
      setStatsVisible(true)
      if (showXp) setXpNonce((n) => n + 1)
    }, 3200)
    return () => clearTimeout(fallbackTimer)
  }, [nonce, mode, variant, lessonTrigger, isLevel, skillCheckMastered, practiceTrigger, showXp])

  const handleRiveEvent = useCallback(
    (name: string) => {
      onRiveEvent?.(name)
      if (name === 'transition_up') {
        setUntranslated(true)
      } else if (name === 'reveal_title') {
        setTitleVisible(true)
      } else if (name === 'reveal_xp') {
        setStatsVisible(true)
        setXpNonce((n) => n + 1)
        playSound('chime')
        haptics.notify('success')
      }
    },
    [onRiveEvent],
  )

  return (
    <div
      className="flex flex-col transition-transform duration-500 ease-in-out"
      style={{ transform: untranslated ? 'translateY(0%)' : 'translateY(30%)' }}
    >
      <BrilliantRiveContainer
        className={cn(
          'aspect-square',
          compact && '!h-[clamp(172px,30dvh,272px)] !min-h-[172px] !p-3',
        )}
      >
        <BrilliantEndstateRive
          kind={mode}
          dark={dark}
          variant={variant}
          lessonTrigger={lessonTrigger}
          isLevel={isLevel}
          levelNumber={levelNumber}
          skillCheckMastered={skillCheckMastered}
          practiceTrigger={practiceTrigger}
          nonce={nonce}
          label={heading}
          className="size-full"
          fallback={fallback}
          onRiveEvent={handleRiveEvent}
        />
      </BrilliantRiveContainer>

      <BrilliantCopyContainer className={compact ? '!min-h-0 gap-2.5 pb-2' : 'gap-3.5 pb-4'}>
        <div
          className="space-y-1 transition-opacity duration-500 ease-out"
          style={{ opacity: titleVisible ? 1 : 0 }}
        >
          <h1
            id={headingId}
            className="text-[28px] sm:text-[32px] font-extrabold leading-tight tracking-tight text-pfg"
          >
            {heading}
          </h1>
          {subtitle && (
            <p className="text-[13.5px] font-semibold text-pmuted">{subtitle}</p>
          )}
        </div>

        {(showXp || practiceStats) && (
          <div
            className="relative flex w-full max-w-[360px] flex-col items-center gap-2 py-2 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              opacity: statsVisible ? 1 : 0,
              transform: statsVisible ? 'translateY(0)' : 'translateY(28px)',
            }}
          >
            {/* MAIN_xp-starburst (Brilliant exact 226x174px) */}
            {statsVisible && (
              <div
                className="pointer-events-none absolute left-1/2 -top-6 h-[174px] w-[226px] -translate-x-1/2"
                aria-hidden="true"
              >
                <BrilliantEndstateRive
                  kind="xp"
                  dark={dark}
                  nonce={xpNonce}
                  label="XP starburst"
                  className="size-full"
                />
              </div>
            )}

            <span className="relative z-10 text-[12px] font-bold uppercase tracking-wider text-pmuted">
              {practiceStats
                ? showXp && earnedXp > 0
                  ? xpLabel
                  : practiceStats.isRu
                    ? 'Общий результат'
                    : 'Yakuniy natija'
                : xpLabel}
            </span>

            <div className="relative z-10 inline-flex items-center justify-center">
              {practiceStats ? (
                showXp && earnedXp > 0 ? (
                  <div className="inline-flex items-center justify-center">
                    {animateXpCount ? (
                      <AnimatedXpCounter active={statsVisible} end={earnedXp} />
                    ) : (
                      <span
                        className={cn(
                          'inline-block text-[40px] leading-none font-extrabold tracking-tight text-[#29cc57] tabular-nums',
                          statsVisible && 'brilliant-xp-pulse',
                        )}
                      >
                        +{earnedXp}
                      </span>
                    )}
                    <span className="ml-2 inline-flex items-center text-[#f6b31f]">
                      <BrilliantSparkleStar size={24} />
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-baseline justify-center gap-1.5">
                    <span className="text-[40px] sm:text-[44px] leading-none font-black tracking-tight text-pfg tabular-nums">
                      <AnimatedNumber active={statsVisible} end={practiceStats.percent} suffix="%" />
                    </span>
                    <span className="ml-2 inline-flex items-center text-[#f6b31f]">
                      <BrilliantSparkleStar size={24} />
                    </span>
                  </div>
                )
              ) : (
                <>
                  {animateXpCount ? (
                    <AnimatedXpCounter active={statsVisible} end={earnedXp} />
                  ) : (
                    <span
                      className={cn(
                        'inline-block text-[40px] leading-none font-extrabold tracking-tight text-[#29cc57] tabular-nums',
                        statsVisible && 'brilliant-xp-pulse',
                      )}
                    >
                      +{earnedXp}
                    </span>
                  )}
                  <span className="ml-2 inline-flex items-center text-[#f6b31f]">
                    <BrilliantSparkleStar size={24} />
                  </span>
                </>
              )}
            </div>

            {/* Kak XP uslubidagi 3-ustunli animatsiyali statistika (Bloksiz, toza Brilliant minimalist) */}
            {practiceStats && (
              <div className="relative z-10 mt-2.5 flex w-full items-center justify-center gap-6 sm:gap-8">
                {/* To'g'ri (Green) */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[26px] sm:text-[28px] font-black leading-none text-[#29cc57] tabular-nums">
                    <AnimatedNumber active={statsVisible} end={practiceStats.correct} delay={100} />
                  </span>
                  <span className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider text-pmuted">
                    {practiceStats.isRu ? 'верно' : 'to‘g‘ri'}
                  </span>
                </div>

                {/* Xato (Red) */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[26px] sm:text-[28px] font-black leading-none text-pdanger tabular-nums">
                    <AnimatedNumber
                      active={statsVisible}
                      end={practiceStats.wrong ?? Math.max(0, practiceStats.total - practiceStats.correct)}
                      delay={180}
                    />
                  </span>
                  <span className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider text-pmuted">
                    {practiceStats.isRu ? 'ошибок' : 'xato'}
                  </span>
                </div>

                {/* Natija / Foiz */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[26px] sm:text-[28px] font-black leading-none text-pfg tabular-nums">
                    <AnimatedNumber active={statsVisible} end={practiceStats.percent} suffix="%" delay={260} />
                  </span>
                  <span className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider text-pmuted">
                    {practiceStats.isRu ? 'результат' : 'natija'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {children}
      </BrilliantCopyContainer>
    </div>
  )
}

const WEEK_DAYS_UZ = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const WEEK_DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Brilliant 1:1 5-kunlik Streak Kalendari + diamond zarralar portlashi (`27qvs7osh1b7y.js`) */
export function BrilliantStreakCalendar({
  streak,
  lang,
  animate = true,
  className,
}: {
  streak: number
  lang: 'uz' | 'ru'
  animate?: boolean
  className?: string
}) {
  const names = lang === 'ru' ? WEEK_DAYS_RU : WEEK_DAYS_UZ
  const today = new Date().getDay()
  const isFirstDay = streak <= 1
  const currentIdx = isFirstDay ? 0 : Math.min(2, streak - 1)
  const startOffset = isFirstDay ? 0 : -currentIdx

  const days = [0, 1, 2, 3, 4].map((slot) => {
    const dayIdx = (((today + startOffset + slot) % 7) + 7) % 7
    const isPast = slot < currentIdx
    const isCurrent = slot === currentIdx
    return { key: `${slot}-${dayIdx}`, code: names[dayIdx], isPast, isCurrent }
  })

  return (
    <div className={cn('relative flex w-fit items-center gap-4', className)}>
      {days.map((d, idx) => {
        const showFilled = d.isPast || (d.isCurrent && animate)
        const shouldPulseToday = d.isCurrent && animate
        const rippleDelay = 833 + 67 * Math.abs(idx - currentIdx)

        return (
          <div key={d.key} className="flex flex-col items-center gap-1.5 isolate">
            <div
              className="brilliant-streak-ripple relative grid size-8 place-content-center"
              data-animate={!d.isCurrent && animate ? 'true' : undefined}
              style={{
                '--ripple-delay': `${rippleDelay}ms`,
                '--ripple-direction': idx < currentIdx ? '-1' : '1',
              } as CSSProperties}
            >
              {shouldPulseToday && (
                <div className="pointer-events-none absolute inset-0 grid place-content-center" aria-hidden="true">
                  {PARTICLES.map((p, pIdx) => {
                    const rad = (p.angle * Math.PI) / 180
                    return (
                      <div
                        key={pIdx}
                        className="brilliant-particle-burst absolute"
                        style={{
                          '--particle-direction-x': String(Math.cos(rad)),
                          '--particle-direction-y': String(Math.sin(rad)),
                          '--particle-starting-distance': `${p.start}px`,
                          '--particle-ending-distance': `${p.end}px`,
                          '--particle-size': p.size,
                          '--particle-start-delay': `${667 + p.delay}ms`,
                        } as CSSProperties}
                      >
                        <div className="brilliant-particle-dot" />
                      </div>
                    )
                  })}
                </div>
              )}

              <div
                className="brilliant-streak-outline col-start-1 row-start-1 size-full rounded-full border-2 border-plineStrong"
                data-animate={shouldPulseToday ? 'true' : undefined}
              />
              <div
                className="brilliant-streak-bg-circle col-start-1 row-start-1 size-full rounded-full bg-[#b7dc00] opacity-0"
                data-visible={d.isPast ? 'true' : undefined}
                data-animate={shouldPulseToday ? 'true' : undefined}
              />
              <div
                className="brilliant-streak-bolt col-start-1 row-start-1 flex items-center justify-center text-[#141414]"
                data-visible={showFilled ? 'true' : undefined}
                data-animate={shouldPulseToday ? 'true' : undefined}
              >
                <BoltSvg variant="streak" />
              </div>
            </div>

            <span
              className={cn(
                'brilliant-streak-day-label text-[12px] font-bold',
                showFilled ? 'text-pfg' : 'text-pmuted',
              )}
              data-animate={shouldPulseToday ? 'true' : undefined}
            >
              {d.code}
            </span>
          </div>
        )
      })}

      {/* O'ng tarafdagi fade mask (Brilliant 27qvs7osh1b7y.js) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 top-0 bottom-0 w-10"
        style={{
          backgroundImage: 'linear-gradient(270deg, var(--p-canvas, var(--theme-canvas)) 10%, transparent 100%)',
        }}
      />
    </div>
  )
}

/** Brilliant 1:1 Seriya sahnasi (`fade-in_bg-gradient` -> `number-in` -> `number-scaling` -> `copy-in` -> `slide-up_cal-in_animation`) */
export function BrilliantStreakStage({
  streak,
  heading,
  lang,
  dark,
  variant,
  nonce = 0,
  titleId,
  onGlowChange,
  onRiveEvent,
}: {
  streak: number
  heading: string
  lang: 'uz' | 'ru'
  dark: boolean
  variant?: 0 | 1 | 2
  nonce?: number
  titleId?: string
  onGlowChange?: (glow: boolean) => void
  onRiveEvent?: (name: string) => void
}) {
  const resolvedVariant = variant ?? (streak <= 1 ? 0 : streak >= 30 ? 2 : 1)
  const prevCount = Math.max(0, streak - 1)
  const reduced = prefersReducedMotion()
  const [counterStage, setCounterStage] = useState<'initial' | 'reveal' | 'scale-and-color' | 'back-to-default'>(
    reduced ? 'back-to-default' : 'initial',
  )
  const [copyVisible, setCopyVisible] = useState(reduced)
  const [calVisible, setCalVisible] = useState(reduced)
  const [animateCal, setAnimateCal] = useState(reduced)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCounterStage('back-to-default')
      setCopyVisible(true)
      setCalVisible(true)
      setAnimateCal(true)
      if (resolvedVariant !== 1) onGlowChange?.(true)
      return
    }
    setCounterStage('initial')
    setCopyVisible(false)
    setCalVisible(false)
    setAnimateCal(false)
    onGlowChange?.(false)

    const t = setTimeout(() => {
      setCounterStage((s) => (s === 'initial' ? 'back-to-default' : s))
      setCopyVisible(true)
      setCalVisible(true)
      setAnimateCal(true)
      if (resolvedVariant !== 1) onGlowChange?.(true)
    }, 4500)
    return () => clearTimeout(t)
  }, [nonce, resolvedVariant, onGlowChange])

  const handleRiveEvent = useCallback(
    (name: string) => {
      onRiveEvent?.(name)
      if (name === 'fade-in_bg-gradient' && resolvedVariant !== 1) {
        onGlowChange?.(true)
      } else if (name === 'number-in') {
        setCounterStage((s) => (s === 'initial' ? 'reveal' : s))
      } else if (name === 'number-scaling') {
        setCounterStage((s) => (s === 'reveal' ? 'scale-and-color' : s))
        playSound('chime')
        haptics.impact('medium')
      } else if (name === 'copy-in') {
        setCounterStage('back-to-default')
        setCopyVisible(true)
      } else if (name === 'slide-up_cal-in_animation') {
        setCalVisible(true)
      }
    },
    [onRiveEvent, onGlowChange, resolvedVariant],
  )

  return (
    <div
      className={cn(
        'flex flex-col transition-transform duration-500 ease-in-out',
        calVisible ? 'translate-y-0' : 'translate-y-0 lg:translate-y-[30%]',
      )}
    >
      <BrilliantRiveContainer className="aspect-square">
        <BrilliantEndstateRive
          kind="streak"
          variant={resolvedVariant}
          dark={dark}
          nonce={nonce}
          label={heading}
          className="size-full"
          onRiveEvent={handleRiveEvent}
        />
      </BrilliantRiveContainer>

      <BrilliantCopyContainer className="gap-4">
        <p
          className="text-[48px] font-black leading-none tabular-nums"
          style={{
            opacity: counterStage === 'initial' ? 0 : 1,
            color: counterStage === 'scale-and-color' ? '#ff8d23' : 'var(--p-fg)',
            transform: counterStage === 'scale-and-color' ? 'scale(1.2)' : 'scale(1)',
            transition:
              'opacity 250ms ease-out, transform 333ms cubic-bezier(0.25, 0.75, 0.18, 1.09), color 167ms ease',
          }}
        >
          {counterStage === 'back-to-default' ? streak : prevCount}
        </p>

        <h1
          id={titleId}
          className="text-[24px] sm:text-[26px] font-extrabold leading-snug text-pfg transition-opacity duration-500 ease-out"
          style={{ opacity: copyVisible ? 1 : 0 }}
        >
          {heading}
        </h1>

        <div
          className="mt-auto pt-2 transition-opacity duration-500 ease-in-out"
          style={{ opacity: calVisible ? 1 : 0 }}
          onTransitionEnd={(e) => {
            if (e.propertyName === 'opacity' && calVisible) {
              setAnimateCal(true)
            }
          }}
        >
          <BrilliantStreakCalendar streak={streak} lang={lang} animate={animateCal} />
        </div>
      </BrilliantCopyContainer>
    </div>
  )
}

/** Brilliant 1:1 Seriya Zaryadi (`Streaks Forgive`) sahnasi */
export function BrilliantChargeStage({
  heading,
  description,
  dark,
  nonce = 0,
  titleId,
  onRiveEvent,
  children,
}: {
  heading: string
  description: string
  dark: boolean
  nonce?: number
  titleId?: string
  onRiveEvent?: (name: string) => void
  children?: ReactNode
}) {
  return (
    <>
      <BrilliantRiveContainer className="aspect-square">
        <BrilliantEndstateRive
          kind="charge"
          dark={dark}
          nonce={nonce}
          label={heading}
          className="size-full"
          onRiveEvent={(name) => {
            onRiveEvent?.(name)
            if (name === 'PlayStreakChargeSound') {
              playSound('coins')
              haptics.notify('success')
            }
          }}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer className="justify-center pb-5 px-5 gap-4">
        <h1 id={titleId} className="text-[24px] font-extrabold leading-snug text-pfg">
          {heading}
        </h1>
        <p className="text-[15px] leading-relaxed text-pmuted">{description}</p>
        {children}
      </BrilliantCopyContainer>
    </>
  )
}
