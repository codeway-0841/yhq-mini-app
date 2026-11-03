import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { SignalIndicator } from './illustrations/SignalIndicator'
import { KojiMascot } from './KojiMascot'
import {
  type OnboardingStep,
  type OnboardingState,
  ONBOARDING_STEPS_ORDER,
  STEP_PROGRESS,
} from './types'

export const OB_TIMING = {
  slide: 300,
  reveal: 250,
  exit: 300,
  syncHold: 5400,
  finish: 120,
  welcome: {
    logo: 0,
    title: 260,
    sub: 360,
    cardFirst: 500,
    cardStep: 120,
    button: 1160,
  },
} as const

const isUnitTest =
  typeof process !== 'undefined' &&
  Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test') &&
  typeof window !== 'undefined' &&
  Boolean(window.navigator?.userAgent?.includes('jsdom'))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export interface OnboardingProps {
  onDone: () => void
  authed?: boolean
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const instant = useMemo(() => isUnitTest || prefersReducedMotion(), [])

  // Splash animation at start (0:00 - 0:02)
  const [showSplash, setShowSplash] = useState(!instant)
  useEffect(() => {
    if (instant) return
    const timer = setTimeout(() => setShowSplash(false), 1400)
    return () => clearTimeout(timer)
  }, [instant])

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [animating, setAnimating] = useState(false)

  const [answers, setAnswers] = useState<OnboardingState>({
    persona: null,
    interest: null,
    dailyGoal: null,
    level: null,
    notificationsAllowed: null,
  })

  const currentStep: OnboardingStep = ONBOARDING_STEPS_ORDER[stepIndex]
  const progressPercent = STEP_PROGRESS[currentStep]

  const goToStep = useCallback(
    (nextIndex: number, dir: 'forward' | 'backward') => {
      if (animating && !instant) return
      setDirection(dir)
      if (instant) {
        setStepIndex(nextIndex)
        return
      }
      setAnimating(true)
      setTimeout(() => {
        setStepIndex(nextIndex)
        setAnimating(false)
      }, 180)
    },
    [animating, instant],
  )

  const handleNext = useCallback(() => {
    if (stepIndex < ONBOARDING_STEPS_ORDER.length - 1) {
      goToStep(stepIndex + 1, 'forward')
    } else {
      onDone()
    }
  }, [stepIndex, goToStep, onDone])

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1, 'backward')
    }
  }, [stepIndex, goToStep])

  return (
    <main className="first-launch-screen relative flex h-full w-full select-none flex-col overflow-hidden bg-white text-[#111827]">
      <style>{`
        @keyframes kojiFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes kojiCurl {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-1.5deg); }
          50% { transform: translateY(-13px) rotate(1deg); }
          75% { transform: translateY(-5px) rotate(0deg); }
        }
        @keyframes kojiAura {
          0%, 100% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.95; }
        }
        @keyframes kojiAuraOuter {
          0%, 100% { transform: scale(1.0); opacity: 0.25; }
          50% { transform: scale(1.3); opacity: 0.65; }
        }
        .animate-koji-float {
          animation: kojiFloat 3.2s ease-in-out infinite;
        }
        .animate-koji-curl {
          animation: kojiCurl 2.2s ease-in-out infinite;
        }
        .animate-koji-aura {
          animation: kojiAura 2.4s ease-in-out infinite;
        }
        .animate-koji-aura-outer {
          animation: kojiAuraOuter 2.4s ease-in-out infinite;
        }
      `}</style>

      {/* Initial Splash Logo Overlay (video 0:00 - 0:02) */}
      {showSplash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300">
          <span className="text-[38px] font-black tracking-tight text-[#111827] animate-pulse">
            Brilliant
          </span>
        </div>
      )}

      <div className="relative mx-auto flex h-full w-full flex-col lg:grid lg:max-w-[1080px] lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12 lg:px-8">
        {/* Desktop Side Column */}
        <aside className="hidden flex-col justify-between py-12 lg:flex">
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-black tracking-tight text-[#111827]">
              Brilliant
            </span>
          </div>

          <div className="max-w-[380px]">
            <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-[#10B981]" />
            <h2 className="mt-6 text-[32px] font-bold leading-[1.18] tracking-[-0.02em] text-[#111827]">
              The best way to learn math and computer science
            </h2>
            <p className="mt-4 text-[15px] leading-[22px] text-gray-500">
              Effective, hands-on learning, while learning at your level with guided bite-sized lessons.
            </p>
          </div>

          <p className="text-[12px] font-semibold tracking-wider text-gray-400 uppercase">
            Interactive Learning
          </p>
        </aside>

        {/* Mobile / Interaction Viewport */}
        <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-white px-5 pt-3 pb-[calc(18px+var(--safe-bottom,0px))] sm:px-6">
          {/* Top Progress Header (Steps 1 to 8) */}
          {currentStep !== 'welcome' && (
            <header className="flex h-11 shrink-0 items-center gap-3.5" aria-label="Progress">
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-100 active:scale-95 cursor-pointer"
              >
                <ChevronLeft size={26} strokeWidth={2.4} />
              </button>

              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#EAEAEA]">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="h-full rounded-full bg-[#10B981] transition-all duration-300 ease-out"
                />
              </div>
            </header>
          )}

          {/* Carousel Slide Area */}
          <div
            className={`flex min-h-0 flex-1 flex-col transition-all duration-200 ease-out ${
              animating
                ? direction === 'forward'
                  ? 'opacity-0 translate-x-4'
                  : 'opacity-0 -translate-x-4'
                : 'opacity-100 translate-x-0'
            }`}
          >
            {/* Step 0: Welcome Screen */}
            {currentStep === 'welcome' && (
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                <div className="flex flex-1 flex-col items-center justify-center pt-2">
                  <KojiMascot mode="hero" className="h-64 w-64" />

                  <h1 className="mt-5 max-w-[360px] text-[24px] sm:text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-[#111827]">
                    The best way to learn math and <br />computer science
                  </h1>

                  <p className="mt-3.5 max-w-[310px] text-[14.5px] leading-[21px] text-[#6B7280]">
                    Effective, hands-on learning, while learning at your level with guided bite-sized lessons.
                  </p>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#18181B] px-6 text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    Continue
                  </button>

                  <button
                    type="button"
                    onClick={onDone}
                    className="py-2.5 text-[15px] font-semibold text-[#111827] transition-opacity hover:opacity-80 active:opacity-60 cursor-pointer"
                  >
                    Log in
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Persona */}
            {currentStep === 'persona' && (
              <div className="flex h-full flex-col justify-between pt-2">
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    Which describes you best?
                  </h2>
                  <p className="mt-2 text-[14.5px] text-[#6B7280]">
                    This will help us personalize your experience.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Which describes you best?"
                  className="my-auto flex flex-col gap-2.5 overflow-y-auto py-2"
                >
                  {[
                    {
                      id: 'student',
                      icon: '/images/onboarding/avatar_student.png',
                      bold: 'Student',
                      rest: ' or soon to be enrolled',
                    },
                    {
                      id: 'professional',
                      icon: '/images/onboarding/avatar_professional.png',
                      bold: 'Professional',
                      rest: ' pursuing a career',
                    },
                    {
                      id: 'parent',
                      icon: '/images/onboarding/avatar_parent.png',
                      bold: 'Parent',
                      rest: ' of a school-aged child',
                    },
                    {
                      id: 'lifelong',
                      icon: '/images/onboarding/avatar_lifelong.png',
                      bold: 'Lifelong Learner',
                      rest: '',
                    },
                    {
                      id: 'teacher',
                      icon: '/images/onboarding/avatar_teacher.png',
                      bold: 'Teacher',
                      rest: '',
                    },
                    {
                      id: 'other',
                      icon: '/images/onboarding/avatar_other.png',
                      bold: 'Other',
                      rest: '',
                    },
                  ].map((item) => {
                    const active = answers.persona === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAnswers((prev) => ({ ...prev, persona: item.id }))}
                        className={`flex h-[62px] w-full items-center gap-3.5 rounded-2xl border px-4 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#3B82F6] bg-[#EFF6FF] shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex size-[42px] shrink-0 items-center justify-center">
                          <img
                            src={item.icon}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[15px] leading-snug text-[#111827]">
                          <strong className="font-semibold">{item.bold}</strong>
                          {item.rest}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="shrink-0 pt-3">
                  <button
                    type="button"
                    disabled={!answers.persona}
                    onClick={handleNext}
                    className={`flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-semibold transition-all ${
                      answers.persona
                        ? 'bg-[#18181B] text-white active:scale-[0.98] cursor-pointer'
                        : 'bg-[#EAEAEA] text-[#9E9E9E] cursor-not-allowed'
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Interests */}
            {currentStep === 'interest' && (
              <div className="flex h-full flex-col justify-between pt-2">
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-[21px] sm:text-[24px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    Which are you most interested in?
                  </h2>
                  <p className="mt-2 max-w-[320px] text-[14px] leading-snug text-[#6B7280]">
                    Choose just one. This will help us get you started (but won't limit your experience).
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Which are you most interested in?"
                  className="my-auto flex flex-col gap-2.5 overflow-y-auto py-2"
                >
                  {[
                    {
                      id: 'skills',
                      icon: '/images/onboarding/interest_skills.png',
                      label: 'Gain new skills to progress at work',
                    },
                    {
                      id: 'explore',
                      icon: '/images/onboarding/interest_explore.png',
                      label: 'Explore new topics',
                    },
                    {
                      id: 'math',
                      icon: '/images/onboarding/interest_math.png',
                      label: 'Refresh my math foundations',
                    },
                    {
                      id: 'brain',
                      icon: '/images/onboarding/interest_brain.png',
                      label: 'Exercise my brain to stay sharp',
                    },
                    {
                      id: 'school',
                      icon: '/images/onboarding/interest_school.png',
                      label: 'Excel in school',
                    },
                    {
                      id: 'other',
                      icon: '/images/onboarding/interest_other.png',
                      label: 'Something else',
                    },
                  ].map((item) => {
                    const active = answers.interest === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAnswers((prev) => ({ ...prev, interest: item.id }))}
                        className={`flex h-[62px] w-full items-center gap-3.5 rounded-2xl border px-4 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#3B82F6] bg-[#EFF6FF] shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex size-[38px] shrink-0 items-center justify-center">
                          <img
                            src={item.icon}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[15px] font-medium text-[#111827]">
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="shrink-0 pt-3">
                  <button
                    type="button"
                    disabled={!answers.interest}
                    onClick={handleNext}
                    className={`flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-semibold transition-all ${
                      answers.interest
                        ? 'bg-[#18181B] text-white active:scale-[0.98] cursor-pointer'
                        : 'bg-[#EAEAEA] text-[#9E9E9E] cursor-not-allowed'
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Interstitial Place */}
            {currentStep === 'interstitial_place' && (
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                <div className="flex flex-1 flex-col items-center justify-center">
                  <KojiMascot mode="place" className="h-56 w-56 sm:h-64 sm:w-64" />

                  <h2 className="mt-5 text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    You're in the right place
                  </h2>

                  <p className="mt-3.5 max-w-[320px] text-[14.5px] leading-[22px] text-[#6B7280]">
                    Brilliant gets you hands-on with a whole universe of concepts in math, science, and computer science. You'll solve fun problems while growing your critical thinking skills.
                  </p>
                </div>

                <div className="w-full shrink-0 pt-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#18181B] px-6 text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Daily Learning Goal */}
            {currentStep === 'daily_goal' && (
              <div className="flex h-full flex-col justify-between pt-2">
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    What's your daily learning goal?
                  </h2>
                </div>

                <div
                  role="radiogroup"
                  aria-label="What's your daily learning goal?"
                  className="my-auto flex flex-col gap-3 py-2"
                >
                  {[
                    { minutes: 5, bold: 'Casual', rest: '5 min / day' },
                    { minutes: 10, bold: 'Regular', rest: '10 min / day' },
                    { minutes: 15, bold: 'Serious', rest: '15 min / day' },
                    { minutes: 20, bold: 'Intense', rest: '20 min / day' },
                  ].map((item) => {
                    const active = answers.dailyGoal === item.minutes
                    return (
                      <button
                        key={item.minutes}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAnswers((prev) => ({ ...prev, dailyGoal: item.minutes }))}
                        className={`flex h-[64px] w-full items-center rounded-2xl border px-5 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#3B82F6] bg-[#EFF6FF] shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-[16px] text-[#111827]">
                          <strong className="font-bold mr-2">{item.bold}</strong>
                          <span className="text-gray-700">{item.rest}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="shrink-0 pt-3">
                  <button
                    type="button"
                    disabled={answers.dailyGoal === null}
                    onClick={handleNext}
                    className={`flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-semibold transition-all ${
                      answers.dailyGoal !== null
                        ? 'bg-[#18181B] text-white active:scale-[0.98] cursor-pointer'
                        : 'bg-[#EAEAEA] text-[#9E9E9E] cursor-not-allowed'
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Reminders */}
            {currentStep === 'reminders' && (
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                <div className="flex flex-1 flex-col items-center justify-center">
                  <KojiMascot mode="reminders" className="h-56 w-56 sm:h-64 sm:w-64" />

                  <h2 className="mt-4 text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    Reach your daily goal<br />with reminders
                  </h2>

                  <p className="mt-3 max-w-[300px] text-[14.5px] leading-[21px] text-[#6B7280]">
                    Enable push notifications to keep you motivated and on track.
                  </p>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, notificationsAllowed: true }))
                      handleNext()
                    }}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#18181B] px-6 text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    Allow notifications
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, notificationsAllowed: false }))
                      handleNext()
                    }}
                    className="py-2.5 text-[15px] font-medium text-gray-700 hover:text-black transition-colors cursor-pointer"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Level Comfort */}
            {currentStep === 'level' && (
              <div className="flex h-full flex-col justify-between pt-2">
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-[23px] sm:text-[25px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    What is your programming<br />comfort level?
                  </h2>
                  <p className="mt-2 text-[14px] leading-snug text-[#6B7280] max-w-[320px]">
                    Choose the highest level you feel confident in — you can always adjust later.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="What is your programming comfort level?"
                  className="my-auto flex flex-col gap-2.5 overflow-y-auto py-2"
                >
                  {[
                    {
                      id: 'beginner',
                      level: 1 as const,
                      bold: 'Beginner',
                      rest: "I've never written a line of code",
                    },
                    {
                      id: 'novice',
                      level: 2 as const,
                      bold: 'Novice',
                      rest: "I've written some simple programs",
                    },
                    {
                      id: 'intermediate',
                      level: 3 as const,
                      bold: 'Intermediate',
                      rest: "I've written longer programs",
                    },
                    {
                      id: 'advanced',
                      level: 4 as const,
                      bold: 'Advanced',
                      rest: "I've been coding for a long time",
                    },
                  ].map((item) => {
                    const active = answers.level === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAnswers((prev) => ({ ...prev, level: item.id }))}
                        className={`flex h-[66px] w-full items-center gap-3.5 rounded-2xl border px-4 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#3B82F6] bg-[#EFF6FF] shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                        }`}
                      >
                        <SignalIndicator level={item.level} />
                        <div className="flex flex-col text-left">
                          <strong className="text-[15px] font-bold text-[#111827]">{item.bold}</strong>
                          <span className="text-[13px] text-gray-500 leading-tight">{item.rest}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="shrink-0 pt-3">
                  <button
                    type="button"
                    disabled={!answers.level}
                    onClick={handleNext}
                    className={`flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-semibold transition-all ${
                      answers.level
                        ? 'bg-[#18181B] text-white active:scale-[0.98] cursor-pointer'
                        : 'bg-[#EAEAEA] text-[#9E9E9E] cursor-not-allowed'
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 7: Interstitial Efficacy */}
            {currentStep === 'interstitial_efficacy' && (
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                <div className="flex flex-1 flex-col items-center justify-center">
                  <KojiMascot mode="workout" className="h-56 w-56 sm:h-64 sm:w-64" />

                  <h2 className="mt-5 text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    Learn 6x more effectively
                  </h2>

                  <p className="mt-3.5 max-w-[320px] text-[14.5px] leading-[22px] text-[#6B7280]">
                    Brilliant's interactive lessons will start at your level and help you advance. Interactive learning has been shown to be 6x more effective than watching lecture videos.
                  </p>
                </div>

                <div className="w-full shrink-0 pt-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#18181B] px-6 text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 8: Testimonial & Completion */}
            {currentStep === 'testimonial' && (
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                <div className="flex flex-1 flex-col items-center justify-center">
                  <KojiMascot mode="testimonial" className="h-52 w-52 sm:h-60 sm:w-60" />

                  <h2 className="mt-4 text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111827]">
                    You're on your way!
                  </h2>

                  <p className="mt-3.5 max-w-[310px] text-[14px] leading-[21px] text-[#6B7280]">
                    "If you like bending your mind over interesting problems or want to explore a rich world full of beautiful mysteries, this app will be a sure thing for you."
                  </p>

                  <span className="mt-3 text-[14px] font-medium text-gray-500">
                    — Bob V.
                  </span>
                </div>

                <div className="w-full shrink-0 pt-4">
                  <button
                    type="button"
                    onClick={onDone}
                    className="flex h-[52px] w-full items-center justify-center rounded-full bg-[#18181B] px-6 text-[17px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
