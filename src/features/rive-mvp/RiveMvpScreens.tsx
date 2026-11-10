import { useCallback, useEffect, useState } from 'react'
import { Flame, Lock, Sparkles, Trophy, Zap } from 'lucide-react'
import {
  BrilliantEndstateRive,
  type BrilliantLessonTrigger,
  type BrilliantPracticeTrigger,
  type BrilliantProgressTrigger,
} from '../../shared/components/BrilliantEndstateRive'
import {
  BrilliantExtrasRive,
  type BrilliantLeagueState,
} from '../../shared/components/BrilliantExtrasRive'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { cn } from '../../shared/lib/cn'
import {
  BrilliantCopyContainer,
  BrilliantEndstateShell,
  BrilliantLevelCheckShell,
  BrilliantRiveContainer,
} from './BrilliantEndstateShell'
import { MvpRiveStage } from './MvpRiveStage'
import { renderExtraMvpScreen, type ExtraMvpScreenId } from './ExtraBrilliantScreens'

export type MvpScreenId =
  | 'lesson'
  | 'practice'
  | 'streak'
  | 'charge'
  | 'rate-app'
  | 'premium-lock'
  | 'progress-intro'
  | 'progress-endstate'
  | 'leagues'
  | 'review-mistakes'
  | 'post-checkout'
  | 'recommended-level'
  | 'level-insertion'
  | 'lesson-loader'
  | 'jump-back-in'
  | ExtraMvpScreenId

export interface MvpScreenContext {
  lang: 'uz' | 'ru'
  dark: boolean
  nonce: number
  colorVariant: number
  lessonTrigger: BrilliantLessonTrigger
  lessonMode: 'lesson' | 'level' | 'mastered'
  practiceTrigger: BrilliantPracticeTrigger
  streakVariant: 0 | 1 | 2
  progressTrigger: BrilliantProgressTrigger
  leagueLevel: number
  leagueState: BrilliantLeagueState
  onEvent?: (eventName: string) => void
  onClose: () => void
  onReplay: () => void
}

/** XP sonini 0 dan target ga silliq sanaydi (Brilliant AnimatedCounter) */
function AnimatedXpCounter({
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

function BoltSvg({ variant }: { variant: 'streak' | 'charge' }) {
  if (variant === 'charge') {
    return (
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="11.2" y="9.6" width="9.6" height="12.8" rx="0.8" fill="currentColor" />
        <path
          d="M16.45 12.11L15.61 16.82H13.67L16.45 12.11Z"
          fill="#29cc57"
        />
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

/** 1. LessonComplete & 2. PracticeComplete (ContentCompletionScreen 1:1) */
function ContentCompletionMvp({
  ctx,
  mode,
}: {
  ctx: MvpScreenContext
  mode: 'lesson' | 'practice'
}) {
  const { lang, dark, nonce, colorVariant, lessonTrigger, lessonMode, practiceTrigger, onEvent, onReplay } = ctx
  const [untranslated, setUntranslated] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [xpVisible, setXpVisible] = useState(false)
  const [xpNonce, setXpNonce] = useState(0)

  const allowXp = mode === 'lesson' || practiceTrigger !== 'playFailure'
  const earnedXp = mode === 'lesson' ? (lessonMode === 'level' ? 40 : 25) : practiceTrigger === 'play100' ? 30 : 20

  useEffect(() => {
    setUntranslated(false)
    setTitleVisible(false)
    setXpVisible(false)
    const fallback = setTimeout(() => {
      setUntranslated(true)
      setTitleVisible(true)
      if (allowXp) {
        setXpVisible(true)
        setXpNonce((n) => n + 1)
      }
    }, 3400)
    return () => clearTimeout(fallback)
  }, [nonce, mode, colorVariant, lessonTrigger, lessonMode, practiceTrigger, allowXp])

  const handleRiveEvent = useCallback(
    (name: string) => {
      onEvent?.(name)
      if (name === 'transition_up') {
        setUntranslated(true)
      } else if (name === 'reveal_title') {
        setTitleVisible(true)
      } else if (name === 'reveal_xp' && allowXp) {
        setXpVisible(true)
        setXpNonce((n) => n + 1)
        playSound('chime')
        haptics.notify('success')
      }
    },
    [allowXp, onEvent],
  )

  const heading =
    mode === 'lesson'
      ? lessonMode === 'mastered'
        ? lang === 'ru'
          ? 'Навык освоен!'
          : 'Mavzu mukammal egallandi!'
        : lessonMode === 'level'
          ? lang === 'ru'
            ? 'Уровень пройден!'
            : 'Bosqich yakunlandi!'
          : lang === 'ru'
            ? 'Урок завершён!'
            : 'Dars yakunlandi!'
      : practiceTrigger === 'playFailure'
        ? lang === 'ru'
          ? 'Хорошая попытка!'
          : 'Yaxshi urinish!'
        : practiceTrigger === 'play50Plus'
          ? lang === 'ru'
            ? 'Отличная практика!'
            : "A'lo mashq!"
          : lang === 'ru'
            ? 'Идеальный результат!'
            : 'Mukammal natija!'

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onPrimaryClick={() => {
        playSound('click')
        haptics.impact('light')
        onReplay()
      }}
    >
      {/* AnimatedContainer: translateY(30%) -> translateY(0%) on transition_up */}
      <div
        className="flex flex-col transition-transform duration-500 ease-in-out"
        style={{ transform: untranslated ? 'translateY(0%)' : 'translateY(30%)' }}
      >
        <BrilliantRiveContainer className="aspect-square">
          <BrilliantEndstateRive
            kind={mode}
            dark={dark}
            variant={colorVariant}
            lessonTrigger={lessonTrigger}
            isLevel={lessonMode === 'level'}
            levelNumber={3}
            skillCheckMastered={lessonMode === 'mastered'}
            practiceTrigger={practiceTrigger}
            nonce={nonce}
            label={heading}
            className="size-full"
            onRiveEvent={handleRiveEvent}
          />
        </BrilliantRiveContainer>

        <BrilliantCopyContainer className="gap-4">
          <h1
            className="text-[28px] sm:text-[32px] font-extrabold leading-tight tracking-tight text-pfg transition-opacity duration-500 ease-out"
            style={{ opacity: titleVisible ? 1 : 0 }}
          >
            {heading}
          </h1>

          {allowXp && (
            <div
              className="relative flex w-full max-w-[301px] flex-col items-center gap-0.5 py-2 transition-opacity duration-500 ease-out"
              style={{ opacity: xpVisible ? 1 : 0 }}
            >
              {/* MAIN_xp-starburst (Brilliant exact 226x174px) */}
              {xpVisible && (
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
                {lang === 'ru' ? 'Всего XP' : 'Jami XP'}
              </span>
              <div className="relative z-10 inline-flex items-center justify-center">
                <AnimatedXpCounter active={xpVisible} end={earnedXp} />
                <span className="ml-1.5 inline-flex items-center text-[#29cc57]">
                  <Zap size={24} className="fill-[#29cc57]" />
                </span>
              </div>
            </div>
          )}
        </BrilliantCopyContainer>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 3. StreaksScreen (27qvs7osh1b7y.js — to'liq RiveEvent sinxronizatsiyasi!) */
function StreaksMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, streakVariant, onEvent, onReplay } = ctx
  const [counterStage, setCounterStage] = useState<'initial' | 'reveal' | 'scale-and-color' | 'back-to-default'>('initial')
  const [copyVisible, setCopyVisible] = useState(false)
  const [calVisible, setCalVisible] = useState(false)
  const [animateCal, setAnimateCal] = useState(false)
  const [bgGlow, setBgGlow] = useState(false)

  const prevCount = streakVariant === 0 ? 0 : streakVariant === 2 ? 29 : 6
  const nextCount = prevCount + 1

  const dayCodes =
    lang === 'ru'
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']
      : ['Du', 'Se', 'Ch', 'Pa', 'Ju']

  useEffect(() => {
    setCounterStage('initial')
    setCopyVisible(false)
    setCalVisible(false)
    setAnimateCal(false)
    setBgGlow(false)

    // Ehtiyot fallback: agar qurilma eventlardan birini kechiktirsa
    const t = setTimeout(() => {
      setCounterStage((s) => (s === 'initial' ? 'back-to-default' : s))
      setCopyVisible(true)
      setCalVisible(true)
      setAnimateCal(true)
      if (streakVariant !== 1) setBgGlow(true)
    }, 4500)
    return () => clearTimeout(t)
  }, [nonce, streakVariant])

  const handleRiveEvent = useCallback(
    (name: string) => {
      onEvent?.(name)
      if (name === 'fade-in_bg-gradient' && streakVariant !== 1) {
        setBgGlow(true)
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
    [onEvent, streakVariant],
  )

  const heading =
    streakVariant === 0
      ? lang === 'ru'
        ? 'Вы начали серию!'
        : 'Siz seriyani boshladingiz!'
      : streakVariant === 2
        ? lang === 'ru'
          ? '30 дней подряд!'
          : '30 kunlik marra!'
        : lang === 'ru'
          ? 'Серия продлена!'
          : 'Seriya davom etmoqda!'

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      viewportClassName={bgGlow ? 'brilliant-streak-bg-glow' : undefined}
      onPrimaryClick={() => {
        playSound('click')
        haptics.impact('light')
        onReplay()
      }}
    >
      {/* Desktopda lg:translateY(30%) -> 0% on cal reveal */}
      <div
        className={cn(
          'flex flex-col transition-transform duration-500 ease-in-out',
          calVisible ? 'translate-y-0' : 'translate-y-0 lg:translate-y-[30%]',
        )}
      >
        <BrilliantRiveContainer className="aspect-square">
          <BrilliantEndstateRive
            kind="streak"
            variant={streakVariant}
            dark={dark}
            nonce={nonce}
            label={heading}
            className="size-full"
            onRiveEvent={handleRiveEvent}
          />
        </BrilliantRiveContainer>

        <BrilliantCopyContainer className="gap-4">
          {/* AnimatedCounter (heading.3xl) */}
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
            {counterStage === 'back-to-default' ? nextCount : prevCount}
          </p>

          {/* AnimatedCopyReveal */}
          <h1
            className="text-[24px] sm:text-[26px] font-extrabold leading-snug text-pfg transition-opacity duration-500 ease-out"
            style={{ opacity: copyVisible ? 1 : 0 }}
          >
            {heading}
          </h1>

          {/* AnimatedCalendar (5 kun, 32x32px doira + zarra burst + o'ng fade maska) */}
          <div
            className="mt-auto pt-2 transition-opacity duration-500 ease-in-out"
            style={{ opacity: calVisible ? 1 : 0 }}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'opacity' && calVisible) {
                setAnimateCal(true)
              }
            }}
          >
            <div className="relative flex w-fit items-center gap-4">
              {dayCodes.map((code, idx) => {
                const isPast = idx < 2 && streakVariant !== 0
                const isCurrent = streakVariant === 0 ? idx === 0 : idx === 2
                const showFilled = isPast || (isCurrent && animateCal)
                const shouldPulseToday = isCurrent && animateCal
                const rippleDelay = 833 + 67 * Math.abs(idx - (streakVariant === 0 ? 0 : 2))

                return (
                  <div
                    key={code}
                    className="flex flex-col items-center gap-1.5 isolate"
                  >
                    <div
                      className="brilliant-streak-ripple relative grid size-8 place-content-center"
                      data-animate={!isCurrent && animateCal ? 'true' : undefined}
                      style={{
                        '--ripple-delay': `${rippleDelay}ms`,
                        '--ripple-direction': idx < 2 ? '-1' : '1',
                      } as React.CSSProperties}
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
                                } as React.CSSProperties}
                              >
                                <div className="brilliant-particle-dot" />
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Outline ring */}
                      <div
                        className="brilliant-streak-outline col-start-1 row-start-1 size-full rounded-full border-2 border-plineStrong"
                        data-animate={shouldPulseToday ? 'true' : undefined}
                      />

                      {/* Filled lime circle (#c2e500 / pear.primary) */}
                      <div
                        className="brilliant-streak-bg-circle col-start-1 row-start-1 size-full rounded-full bg-[#b7dc00] opacity-0"
                        data-visible={isPast ? 'true' : undefined}
                        data-animate={shouldPulseToday ? 'true' : undefined}
                      />

                      {/* Bolt */}
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
                      {code}
                    </span>
                  </div>
                )
              })}

              {/* O'ng tarafdagi fade mask (27qvs7osh1b7y.js: linear-gradient(270deg, bg.primary, transparent)) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-4 top-0 bottom-0 w-10"
                style={{
                  backgroundImage: 'linear-gradient(270deg, var(--p-canvas, var(--theme-canvas)) 10%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </BrilliantCopyContainer>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 4. StreakChargesScreen (Streaks Forgive — 2ot92llkvshlf.js) */
function StreakChargeMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Супер!' : "Zo'r!"}
      onPrimaryClick={() => {
        playSound('click')
        onReplay()
      }}
    >
      <BrilliantRiveContainer className="aspect-square">
        <BrilliantEndstateRive
          kind="charge"
          dark={dark}
          nonce={nonce}
          label="Streak Charge"
          className="size-full"
          onRiveEvent={(name) => {
            onEvent?.(name)
            if (name === 'PlayStreakChargeSound') {
              playSound('coins')
              haptics.notify('success')
            }
          }}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer className="justify-center pb-5 px-5 gap-4">
        <h1 className="text-[24px] font-extrabold leading-snug text-pfg">
          {lang === 'ru' ? 'Вы получили Заморозку серии!' : 'Seriya himoyasi qo‘lga kiritildi!'}
        </h1>
        <p className="text-[15px] leading-relaxed text-pmuted">
          {lang === 'ru'
            ? 'Если пропустите день, заморозка автоматически сохранит ваш ударный режим.'
            : 'Biror kun dars o‘tkazib yuborsangiz, zaryad seriyangizni avtomatik saqlab qoladi.'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 5. ReviewPromptScreen (MAIN_RateTheApp — 2hkhikiuvwkb8.js: Fullscreen Layout!) */
function RateAppMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Оценить сейчас' : 'Hozir baholash'}
      secondaryLabel={lang === 'ru' ? 'Не сейчас' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('success')
        haptics.notify('success')
        onReplay()
      }}
      onSecondaryClick={() => {
        playSound('click')
        onClose()
      }}
    >
      <BrilliantRiveContainer className="aspect-[353/243]">
        <BrilliantEndstateRive
          kind="rate-app"
          dark={dark}
          nonce={nonce}
          label="Rate KIVVI"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer className="gap-4">
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Нравится KIVVI?' : 'KIVVI yoqyaptimi?'}
        </h1>
        <p className="text-[15px] leading-relaxed text-pmuted">
          {lang === 'ru'
            ? 'Уделите секунду и оцените нас — это помогает развивать платформу!'
            : 'Bir soniya vaqt ajratib bizni baholang — bu platformani rivojlantirishga yordam beradi!'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 6. ContentMeterScreen (MAIN_premium-nudge / PremiumNudgeLockBounce) */
function PremiumLockMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  const [headerShown, setHeaderShown] = useState(false)

  useEffect(() => {
    setHeaderShown(false)
    const fallback = setTimeout(() => setHeaderShown(true), 2200)
    return () => clearTimeout(fallback)
  }, [nonce])

  return (
    <BrilliantEndstateShell
      viewportClassName="brilliant-iridescent-flipped"
      footerBgClassName="bg-transparent backdrop-blur-md"
      primaryLabel={lang === 'ru' ? 'Попробовать Premium' : 'Premiumni yoqish'}
      secondaryLabel={lang === 'ru' ? 'Продолжить бесплатно' : 'Bepul davom etish'}
      onPrimaryClick={() => {
        playSound('achievement')
        haptics.impact('medium')
        onReplay()
      }}
      onSecondaryClick={() => {
        playSound('click')
        onClose()
      }}
    >
      <BrilliantRiveContainer className="aspect-square">
        <BrilliantEndstateRive
          kind="premium-lock"
          dark={dark}
          nonce={nonce}
          label="Premium Lock Bounce"
          className="size-full"
          onRiveEvent={(name) => {
            onEvent?.(name)
            if (name === 'Play_Text and BG') {
              setHeaderShown(true)
              playSound('chime')
            }
          }}
        />
      </BrilliantRiveContainer>

      {headerShown && (
        <BrilliantCopyContainer className="brilliant-upsell-copy-in justify-center gap-3">
          <h1 className="text-[24px] lg:text-[30px] font-extrabold leading-tight text-pfg">
            {lang === 'ru'
              ? 'Дневной лимит бесплатных уроков исчерпан'
              : 'Bugungi bepul darslar limiti tugadi'}
          </h1>
          <p className="text-[16px] leading-relaxed text-pmuted">
            <strong className="font-bold text-pprimary">Premium</strong>{' '}
            {lang === 'ru'
              ? 'открывает полный доступ ко всем курсам и ИИ-тестам.'
              : 'bilan barcha fanlar va AI testlarga cheklovsiz ruxsat oling.'}
          </p>
        </BrilliantCopyContainer>
      )}
    </BrilliantEndstateShell>
  )
}

/** 7 & 8. ProgressCheckIntro & ProgressCheckEndstate (2r5aem_zhr2z1.js) */
function ProgressCheckMvp({
  ctx,
  phase,
}: {
  ctx: MvpScreenContext
  phase: 'intro' | 'endstate'
}) {
  const { lang, dark, nonce, colorVariant, progressTrigger, onEvent, onReplay, onClose } = ctx
  const isEndstate = phase === 'endstate'
  const scorePct =
    progressTrigger === 'playMastered' ? 100 : progressTrigger === 'playPassed' ? 80 : 40

  return (
    <BrilliantLevelCheckShell
      title={lang === 'ru' ? 'Проверка уровня' : 'Daraja tekshiruvi'}
      progressPercent={isEndstate ? 100 : 25}
      onClose={onClose}
      primaryLabel={
        isEndstate
          ? lang === 'ru'
            ? 'Продолжить курс'
            : 'Kursni davom ettirish'
          : lang === 'ru'
            ? 'Начать проверку'
            : 'Tekshiruvni boshlash'
      }
      secondaryLabel={isEndstate ? (lang === 'ru' ? 'Повторить ошибки' : 'Xatolarni ko‘rish') : undefined}
      onPrimaryClick={() => {
        playSound('success')
        onReplay()
      }}
      onSecondaryClick={isEndstate ? onClose : undefined}
    >
      {/* Brilliant exact pixel stages: Intro 284x283 (md 355x354), Endstate 244x244 (md 284x283) */}
      <div
        className={cn(
          'relative mx-auto shrink-0',
          isEndstate
            ? 'size-[244px] md:w-[284px] md:h-[283px]'
            : 'w-[284px] h-[283px] md:w-[355px] md:h-[354px]',
        )}
      >
        <BrilliantEndstateRive
          kind={isEndstate ? 'progress-endstate' : 'progress-intro'}
          variant={
            isEndstate && progressTrigger === 'playPoor'
              ? 2
              : isEndstate && progressTrigger === 'playMastered'
                ? 4
                : colorVariant
          }
          progressTrigger={progressTrigger}
          dark={dark}
          nonce={nonce}
          label="Progress Check"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </div>

      {/* Brilliant Card (w: 360px, maxW: full, borderRadius: 2xl, borderWidth: 2px, padding: 6) */}
      <div className="bg-pcard w-full max-w-[360px] rounded-2xl p-6 text-center space-y-2">
        <h2 className="text-[20px] font-extrabold text-pfg">
          {!isEndstate
            ? lang === 'ru'
              ? 'Проверим ваши знания!'
              : 'Bilimingizni tekshiramiz!'
            : progressTrigger === 'playMastered'
              ? lang === 'ru'
                ? 'Уровень освоен на 100%!'
                : 'Bosqich 100% zabt etildi!'
              : progressTrigger === 'playPassed'
                ? lang === 'ru'
                  ? 'Отлично! Проверка пройдена'
                  : 'Ajoyib! Sinovdan o‘tdingiz'
                : lang === 'ru'
                  ? 'Стоит повторить тему'
                  : 'Mavzuni qayta ko‘rib chiqamiz'}
        </h2>
        <p className="text-[14px] text-pmuted leading-relaxed">
          {isEndstate
            ? lang === 'ru'
              ? `Результат: ${scorePct}% · Награда: +${scorePct >= 70 ? 50 : 10} XP`
              : `Natija: ${scorePct}% · Mukofot: +${scorePct >= 70 ? 50 : 10} XP`
            : lang === 'ru'
              ? '5 быстрых вопросов помогут определить ваш текущий уровень.'
              : '5 ta tezkor savol hozirgi bilim darajangizni aniqlab beradi.'}
        </p>
      </div>
    </BrilliantLevelCheckShell>
  )
}

/** 9. LeaguesScreen (36qja4cbbolyk.js — 190px badge over radial glow + 1s slide-up leaderboard) */
function LeaguesMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, leagueLevel, leagueState, onReplay } = ctx
  const [slidUp, setSlidUp] = useState(false)
  const [boardShown, setBoardShown] = useState(false)

  useEffect(() => {
    setSlidUp(false)
    setBoardShown(false)
    const t1 = setTimeout(() => setSlidUp(true), 1000)
    const t2 = setTimeout(() => setBoardShown(true), 1150)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [nonce, leagueLevel, leagueState])

  const leagueNamesUz = ['Bronza', 'Kumush', 'Oltin', 'Sapfir', 'Zumrad', 'Rubin', 'Ametist', 'Marvarid', 'Obsidian', 'Olmos']
  const leagueNamesRu = ['Бронза', 'Серебро', 'Золото', 'Сапфир', 'Изумруд', 'Рубин', 'Аметист', 'Жемчуг', 'Обсидиан', 'Алмаз']
  const tierName = (lang === 'ru' ? leagueNamesRu : leagueNamesUz)[Math.max(0, Math.min(9, leagueLevel - 1))]

  const rows = [
    { rank: 1, name: 'Azizbek T.', xp: 640, me: false },
    { rank: 2, name: lang === 'ru' ? 'Вы' : 'Siz', xp: 590, me: true },
    { rank: 3, name: 'Madina K.', xp: 520, me: false },
    { rank: 4, name: 'Sardor R.', xp: 475, me: false },
  ]

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onPrimaryClick={() => {
        playSound('achievement')
        onReplay()
      }}
    >
      <div
        className="flex flex-col items-center transition-transform duration-700 ease-out"
        style={{ transform: slidUp ? 'translateY(0%)' : 'translateY(28%)' }}
      >
        {/* Radial glow + absolute top badge */}
        <div className="relative mx-auto flex w-full max-w-[536px] flex-col items-center px-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[120px] left-1/2 h-[340px] w-[520px] -translate-x-1/2 rounded-full opacity-55"
            style={{
              background:
                leagueState === 'demote'
                  ? 'radial-gradient(circle, rgba(148,163,184,0.22) 0%, transparent 68%)'
                  : 'radial-gradient(circle, rgba(246,179,31,0.28) 0%, rgba(53,87,255,0.12) 45%, transparent 72%)',
            }}
          />
          <div className="relative z-10 mt-6 size-[190px] lg:size-[250px]">
            <BrilliantExtrasRive
              kind="league"
              leagueLevel={leagueLevel}
              leagueState={leagueState}
              dark={dark}
              nonce={nonce}
              label={`League ${tierName}`}
              className="size-full"
            />
          </div>
        </div>

        {/* Leaderboard Fade in 800ms */}
        <div
          className="mt-4 w-full max-w-[393px] px-4 space-y-3 transition-opacity duration-700 ease-out"
          style={{ opacity: boardShown ? 1 : 0 }}
        >
          <div className="text-center space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3 py-1 text-[12px] font-bold text-pfg">
              <Trophy size={13} className="text-[#f6b31f]" />
              {tierName} {lang === 'ru' ? 'лига' : 'ligasi'} ({leagueLevel}/10)
            </span>
            <h1 className="text-[22px] font-extrabold text-pfg">
              {leagueState === 'promote'
                ? lang === 'ru'
                  ? 'Повышение в лиге!'
                  : 'Yangi ligaga ko‘tarildingiz!'
                : leagueState === 'demote'
                  ? lang === 'ru'
                    ? 'Лига обновилась'
                    : 'Liga yangilandi'
                  : lang === 'ru'
                    ? 'Вы удержались в лиге!'
                    : 'Ligada o‘rningizni saqladingiz!'}
            </h1>
          </div>

          <div className="bg-pcard rounded-2xl overflow-hidden divide-y divide-pline">
            {rows.map((r) => (
              <div
                key={r.rank}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5 text-[14px]',
                  r.me && 'bg-[#3557ff]/12 font-bold text-pfg',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center font-extrabold text-pmuted">{r.rank}</span>
                  <span>{r.name}</span>
                </div>
                <span className="font-bold text-[#29cc57] tabular-nums">{r.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 10. LessonLoader standalone (`lesson_loader_apr_13_26.riv` & `lesson-loader.ac940c03.riv`) */
function LessonLoaderMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx
  const [loaderKind, setLoaderKind] = useState<'lesson' | 'warmup'>('lesson')

  return (
    <BrilliantEndstateShell
      primaryLabel={
        loaderKind === 'lesson'
          ? lang === 'ru'
            ? 'Показать Warm-Up Loader'
            : 'Warm-Up Loader ni ko‘rish'
          : lang === 'ru'
            ? 'Показать Lesson Loader'
            : 'Lesson Loader ni ko‘rish'
      }
      secondaryLabel={lang === 'ru' ? 'Назад' : 'Orqaga'}
      onPrimaryClick={() => {
        setLoaderKind((k) => (k === 'lesson' ? 'warmup' : 'lesson'))
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        {loaderKind === 'lesson' ? (
          <MvpRiveStage
            file="lesson_loader_apr_13_26.riv"
            artboard="MAIN_Lesson Loader"
            stateMachine="LessonLoader"
            viewModel="LessonLoaderVM"
            booleans={{ darkMode: dark, level: false }}
            numbers={{ color: colorVariant }}
            vmTriggers={['enter']}
            dark={dark}
            nonce={nonce}
            label="Lesson Loader"
            className="size-full"
            onRiveEvent={onEvent}
          />
        ) : (
          <MvpRiveStage
            file="lesson-loader.ac940c03.riv"
            artboard="MAIN_practice-warm-up-loader"
            stateMachine="practice-loader"
            dark={dark}
            nonce={nonce}
            label="Warm-Up Loader"
            className="size-full"
            onRiveEvent={onEvent}
          />
        )}
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[22px] font-extrabold text-pfg">
          {loaderKind === 'lesson'
            ? lang === 'ru'
              ? 'Подбираем задания для вас…'
              : 'Siz uchun topshiriqlar tayyorlanmoqda…'
            : lang === 'ru'
              ? 'Готовим разминку…'
              : 'Qizdirish mashqi yuklanmoqda…'}
        </h1>
        <p className="text-[14px] text-pmuted">
          {loaderKind === 'lesson'
            ? 'lesson_loader_apr_13_26.riv · LessonLoaderVM (enter)'
            : 'lesson-loader.ac940c03.riv · practice-loader'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** Qolgan barcha Brilliant ekranlar uchun 1:1 Layout adapteri */
function GenericEndstateMvp({
  ctx,
  screenId,
}: {
  ctx: MvpScreenContext
  screenId:
    | 'review-mistakes'
    | 'post-checkout'
    | 'recommended-level'
    | 'level-insertion'
    | 'lesson-loader'
    | 'jump-back-in'
}) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx

  if (screenId === 'review-mistakes') {
    return (
      <BrilliantLevelCheckShell
        title={lang === 'ru' ? 'Работа над ошибками' : 'Xatolar ustida ishlash'}
        progressPercent={60}
        onClose={onClose}
        primaryLabel={lang === 'ru' ? 'Разобрать ошибки' : 'Xatolarni tuzatish'}
        onPrimaryClick={() => {
          playSound('click')
          onReplay()
        }}
      >
        <div className="size-[240px] sm:size-[280px]">
          <BrilliantEndstateRive
            kind="review-mistakes"
            variant={colorVariant}
            correctNum={4}
            totalNum={5}
            dark={dark}
            nonce={nonce}
            label="Review Mistakes"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </div>
        <div className="bg-pcard w-full max-w-[360px] rounded-2xl p-6 text-center space-y-2">
          <h2 className="text-[22px] font-extrabold text-pfg">
            {lang === 'ru' ? '4 из 5 верно!' : '5 tadan 4 tasi to‘g‘ri!'}
          </h2>
          <p className="text-[14px] text-pmuted">
            {lang === 'ru'
              ? 'Исправьте оставшуюся ошибку, чтобы закрепить материал на 100%.'
              : 'Mavzuni 100% mustahkamlash uchun qolgan xatoni birga ko‘rib chiqamiz.'}
          </p>
        </div>
      </BrilliantLevelCheckShell>
    )
  }

  if (screenId === 'post-checkout') {
    return (
      <BrilliantEndstateShell
        viewportClassName="brilliant-iridescent-flipped"
        footerBgClassName="bg-transparent"
        primaryLabel={lang === 'ru' ? 'Начать обучение' : 'O‘rganishni boshlash'}
        onPrimaryClick={() => {
          playSound('win')
          haptics.notify('success')
          onReplay()
        }}
      >
        <BrilliantRiveContainer className="aspect-square">
          <MvpRiveStage
            file="post_checkout_apr_01_26.riv"
            artboard="MAIN_PostCheckoutFlow"
            stateMachine="PostCheckoutFlow"
            viewModel="PostCheckoutFlowVM"
            booleans={{ darkMode: dark, text: false }}
            numbers={{ copyVariation: 0 }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="Post Checkout Pro"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </BrilliantRiveContainer>
        <BrilliantCopyContainer>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3557ff]/15 px-3 py-1 text-[12px] font-bold text-pprimary">
            <Sparkles size={13} /> KIVVI PRO
          </span>
          <h1 className="text-[26px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Добро пожаловать в Premium!' : 'Premiumga xush kelibsiz!'}
          </h1>
          <p className="text-[15px] text-pmuted">
            {lang === 'ru'
              ? 'Все курсы, тренажёры и ИИ-разборы теперь полностью открыты.'
              : 'Barcha darsliklar, testlar va AI tushuntirishlar endi to‘liq ochiq.'}
          </p>
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    )
  }

  if (screenId === 'lesson-loader') {
    return <LessonLoaderMvp ctx={ctx} />
  }

  if (screenId === 'level-insertion') {
    return (
      <BrilliantEndstateShell
        primaryLabel={lang === 'ru' ? 'Посмотреть карту' : 'Xaritani ko‘rish'}
        secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
        onPrimaryClick={() => {
          playSound('click')
          onReplay()
        }}
        onSecondaryClick={onClose}
      >
        <BrilliantRiveContainer className="aspect-square">
          <MvpRiveStage
            file="level-insertion-intro.fb376b71.riv"
            artboard="MAIN_LevelInsertionIntro"
            stateMachine="LevelInsertionIntro"
            viewModel="LevelInsertionIntroVM"
            booleans={{ darkMode: dark, isTalking: false }}
            numbers={{ color: colorVariant, numberOfSkills1to4: 3 }}
            strings={{
              levelTitle: lang === 'ru' ? 'Алгебра II' : 'Algebra II',
              skillTitle01: lang === 'ru' ? 'Функции' : 'Funksiyalar',
              skillTitle02: lang === 'ru' ? 'Графики' : 'Grafiklar',
              skillTitle03: lang === 'ru' ? 'Уравнения' : 'Tenglamalar',
            }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="Level Insertion Intro"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </BrilliantRiveContainer>
        <BrilliantCopyContainer>
          <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Добавлен новый модуль!' : 'Yangi modul qo‘shildi!'}
          </h1>
          <p className="text-[15px] text-pmuted leading-relaxed">
            {lang === 'ru'
              ? 'Специально подобранные уроки встроены в ваш план обучения.'
              : 'Bilimingizga mos yangi darslar o‘quv xaritangizga joylashtirildi.'}
          </p>
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    )
  }

  const copyMap = {
    'recommended-level': {
      kind: 'recommended-level' as const,
      title: lang === 'ru' ? 'Перейти на уровень выше?' : 'Yuqori bosqichga sakraymizmi?',
      body:
        lang === 'ru'
          ? 'Пройдите быстрый чек и откройте более сложные задания сразу.'
          : 'Tezkor sinovdan o‘ting va keyingi daraja darslarini darhol oching.',
      cta: lang === 'ru' ? 'Пройти проверку' : 'Sinovni boshlash',
    },
    'jump-back-in': {
      kind: 'recommended-level' as const,
      title: lang === 'ru' ? 'Продолжим с того же места!' : 'Qolgan joydan davom etamiz!',
      body:
        lang === 'ru'
          ? 'До завершения текущего модуля осталось всего 2 урока.'
          : 'Joriy modulni tugatishga atigi 2 ta dars qoldi.',
      cta: lang === 'ru' ? 'Продолжить урок' : 'Darsni davom ettirish',
    },
  }
  const c = copyMap[screenId]

  return (
    <BrilliantEndstateShell
      primaryLabel={c.cta}
      secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('click')
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        {screenId === 'jump-back-in' ? (
          <BrilliantExtrasRive
            kind="jump-back-in"
            dark={dark}
            nonce={nonce}
            label={c.title}
            className="size-full"
          />
        ) : (
          <BrilliantEndstateRive
            kind={c.kind}
            variant={colorVariant}
            dark={dark}
            nonce={nonce}
            label={c.title}
            className="size-full"
            onRiveEvent={onEvent}
          />
        )}
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">{c.title}</h1>
        <p className="text-[15px] text-pmuted leading-relaxed">{c.body}</p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** Tanlangan ekran bo'yicha to'liq 1:1 Brilliant sahifani chizadi */
export function renderMvpScreen(id: MvpScreenId, ctx: MvpScreenContext) {
  switch (id) {
    case 'lesson':
      return <ContentCompletionMvp ctx={ctx} mode="lesson" />
    case 'practice':
      return <ContentCompletionMvp ctx={ctx} mode="practice" />
    case 'streak':
      return <StreaksMvp ctx={ctx} />
    case 'charge':
      return <StreakChargeMvp ctx={ctx} />
    case 'rate-app':
      return <RateAppMvp ctx={ctx} />
    case 'premium-lock':
      return <PremiumLockMvp ctx={ctx} />
    case 'progress-intro':
      return <ProgressCheckMvp ctx={ctx} phase="intro" />
    case 'progress-endstate':
      return <ProgressCheckMvp ctx={ctx} phase="endstate" />
    case 'leagues':
      return <LeaguesMvp ctx={ctx} />
    case 'review-mistakes':
    case 'post-checkout':
    case 'recommended-level':
    case 'level-insertion':
    case 'lesson-loader':
    case 'jump-back-in':
      return <GenericEndstateMvp ctx={ctx} screenId={id} />
    default:
      return renderExtraMvpScreen(id, ctx)
  }
}

export const MVP_CATALOG_ICONS = {
  Flame,
  Lock,
  Sparkles,
  Trophy,
}
