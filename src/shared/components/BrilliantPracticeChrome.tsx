import type { ReactNode } from 'react'
import { X, Zap } from 'lucide-react'
import { CoinIcon } from './CoinIcon'
import { cn } from '../lib/cn'
import { useT } from '../i18n'
import { splitLessonPhases } from './BrilliantCompletionContent'
import './brilliant-practice.css'

export function BrilliantMissedTargetIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true" className="shrink-0 text-pfg">
      <circle cx="14" cy="14" r="10.5" stroke="#ef4444" strokeWidth="3.2" />
      <circle cx="14" cy="14" r="5" fill="#ef4444" />
      <path d="M21.5 6.5 14 14M21.5 6.5h-4M21.5 6.5v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BrilliantConfettiBurstIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6 22 10.5 9.5 18.5 17.5 6 22Z" fill="#f59e0b" />
      <path d="M8.5 15 14 20.5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 5c0 2 1.5 3.5 3.5 3.5M20.5 12.5c1.5 0 2.5 1 2.5 2.5M12 4.5l1 2" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21" cy="7" r="1.4" fill="#f43f5e" />
      <circle cx="22.5" cy="18.5" r="1.4" fill="#a855f7" />
    </svg>
  )
}

export interface BrilliantPracticeDot {
  status?: 'correct' | 'wrong'
  current?: boolean
}

export interface BrilliantPracticeHeaderProps {
  currentIndex: number
  total: number
  answeredCount: number
  outcomes: Record<number, 'correct' | 'wrong'>
  onClose: () => void
  closeLabel: string
  language: 'uz' | 'ru'
  devAction?: ReactNode
  hideProgressBar?: boolean
  centeredDots?: boolean
  dots?: BrilliantPracticeDot[]
  dotsClassName?: string
  progressClassName?: string
  progressLabel?: string
  progressValue?: number
  progressMax?: number
  progressPct?: number
  streakHot?: boolean
  srStatus?: ReactNode
}

/**
 * Brilliant 1:1 2-fazali mashq va dars tepasi: faqat 3 toza element — X | 11px yashil bar + checkpoint nuqtalari | ⚡.
 */
export function BrilliantPracticeHeader({
  currentIndex,
  total,
  answeredCount,
  outcomes,
  onClose,
  closeLabel,
  language,
  devAction,
  hideProgressBar = false,
  centeredDots = false,
  dots,
  dotsClassName,
  progressClassName,
  progressLabel,
  progressValue,
  progressMax,
  progressPct,
  streakHot: streakHotOverride,
  srStatus,
}: BrilliantPracticeHeaderProps) {
  const isRu = language === 'ru'
  const safeTotal = Math.max(1, total)
  const { phase1Count, phase2Count } = splitLessonPhases(safeTotal, true)
  const isPhase2 = phase2Count > 0 && currentIndex >= phase1Count
  const phase1Completed = Math.min(currentIndex + (outcomes[currentIndex] ? 1 : 0), phase1Count)
  const computedPct = phase1Count > 0 ? Math.round((phase1Completed / phase1Count) * 100) : 100
  const barPct = progressPct ?? Math.max(phase1Completed > 0 ? computedPct : 6, 6)
  const streakHot = streakHotOverride ?? (answeredCount >= safeTotal || isPhase2)
  const resolvedDots: BrilliantPracticeDot[] | null = dots
    ? dots
    : phase2Count > 0
      ? Array.from({ length: phase2Count }, (_, idx) => {
          const pos = phase1Count + idx
          return { status: outcomes[pos], current: currentIndex === pos }
        })
      : null

  return (
    <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] lg:mt-0 bg-pcanvas pt-[var(--safe-top,0px)]">
      <div className="mx-auto flex min-h-[56px] w-full max-w-[540px] items-center gap-3 px-4 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-pmuted transition-colors hover:bg-psurface hover:text-pfg"
        >
          <X size={21} strokeWidth={2.35} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {!hideProgressBar && (
            <div
              className={cn('brilliant-practice-progress', progressClassName)}
              role="progressbar"
              aria-label={progressLabel ?? (isRu ? 'Прогресс практики' : 'Mashq progressi')}
              aria-valuemin={progressValue !== undefined ? 0 : 1}
              aria-valuemax={progressMax ?? safeTotal}
              aria-valuenow={progressValue ?? Math.min(currentIndex + 1, safeTotal)}
            >
              <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, barPct / 100))})` }} />
            </div>
          )}

          {srStatus}

          {resolvedDots && resolvedDots.length > 0 && (
            <div
              className={cn('brilliant-practice-dots', dotsClassName)}
              data-centered={centeredDots ? 'true' : undefined}
              aria-hidden="true"
            >
              {resolvedDots.map((dot, idx) => (
                <i
                  key={idx}
                  data-current={dot.current ? 'true' : undefined}
                  data-status={dot.status}
                />
              ))}
            </div>
          )}
        </div>

        <Zap
          size={19}
          strokeWidth={2.2}
          aria-hidden="true"
          className={cn(
            'shrink-0 transition-[transform,color] duration-200',
            streakHot ? 'scale-110 fill-[#f5c417] text-[#f5c417]' : 'text-[#aaaaaa] dark:text-[#3c3c3c]',
          )}
        />

        {devAction}
      </div>
    </header>
  )
}

export interface BrilliantPracticeFeedbackDockProps {
  answeredStatus: 'correct' | 'wrong' | 'pending' | null
  isPhase2: boolean
  xpEarned?: number
  coinsEarned?: number
  language: 'uz' | 'ru'
  mascotSlot?: ReactNode
  canCheck?: boolean
  checking?: boolean
  onCheck?: () => void
  onExplain: () => void
  onContinue: () => void
  continueLabel?: string
}

/**
 * Brilliant 1:1 pastki feedback sheet:
 * - Javob berilmaganda: sokin 52px "Variantni tanlang" paneli + chapda Koji
 * - 1-faza xato: issiq qahrabo (Amber) sheet + Koji tepa chetda, 52px [Nima uchun?] + [Davom etish]
 * - 2-faza xato: to'q kulrang (Charcoal) sheet + Koji yo'q, 52px [Nima uchun?] + [Davom etish]
 * - 1-faza to'g'ri: yashil sheet + "+XP" + ixcham chip "Nima uchun?" + Koji + 52px yashil 3D Davom etish
 * - 2-faza to'g'ri: yashil sheet + konfetti + "+XP" + 52px [Nima uchun?] + [Davom etish / Yakunlash]
 */
export function BrilliantPracticeFeedbackDock({
  answeredStatus,
  isPhase2,
  xpEarned = 0,
  coinsEarned = 0,
  language,
  mascotSlot,
  canCheck = false,
  checking = false,
  onCheck,
  onExplain,
  onContinue,
  continueLabel,
}: BrilliantPracticeFeedbackDockProps) {
  const tt = useT(language)

  if (!answeredStatus || answeredStatus === 'pending') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 bg-pcanvas px-4 pb-[calc(0.875rem+var(--safe-bottom,0px))] pt-2.5">
        <div className="mx-auto flex w-full max-w-[540px] items-center gap-3">
          {!isPhase2 && mascotSlot && (
            <div aria-hidden="true" className="relative block size-12 shrink-0">
              {mascotSlot}
            </div>
          )}
          {onCheck ? (
            <button
              type="button"
              disabled={!canCheck || checking}
              onClick={onCheck}
              className="brilliant-practice-check flex min-w-0 flex-1 cursor-pointer items-center justify-center px-5 text-[16px]"
            >
              {checking ? tt('rusDarslikCheckSubmitting') : tt('rusDarslikCheckSubmit')}
            </button>
          ) : (
            <div className="brilliant-practice-idle-pill flex flex-1 items-center justify-center px-5 text-[15px] font-bold">
              {tt('practiceSelectHint')}
            </div>
          )}
        </div>
      </div>
    )
  }

  const isCorrect = answeredStatus === 'correct'
  const dockState = isCorrect ? 'correct' : isPhase2 ? 'phase2-wrong' : 'wrong'
  const showKojiOverhang = !isCorrect && !isPhase2 && Boolean(mascotSlot)
  const nextLabel = continueLabel || tt('rusDarslikLessonContinue')

  return (
    <div
      data-testid="practice-feedback-dock"
      data-state={dockState}
      role="status"
      className="brilliant-practice-dock brilliant-practice-feedback-pop fixed inset-x-0 bottom-0 z-40 rounded-t-3xl px-5 pb-[calc(1rem+var(--safe-bottom,0px))] pt-5 shadow-[0_-8px_30px_rgb(0_0_0/0.10)] dark:shadow-[0_-8px_30px_rgb(0_0_0/0.45)]"
    >
      {showKojiOverhang && (
        <div className="brilliant-practice-koji-overhang" aria-hidden="true">
          {mascotSlot}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[540px] flex-col gap-3.5">
        {isCorrect ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {isPhase2 && <BrilliantConfettiBurstIcon />}
              <p className="brilliant-practice-correct-title text-[20px] font-extrabold leading-tight tracking-tight">
                {tt('rusDarslikLessonCorrect')}
              </p>
              {xpEarned > 0 && (
                <span className="brilliant-practice-correct-xp text-[14.5px] font-extrabold tabular-nums">
                  +{xpEarned} XP
                </span>
              )}
              {coinsEarned > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--p-gold-rgb)/0.2)] px-2 py-0.5 text-[12.5px] font-extrabold tabular-nums text-pgold">
                  <CoinIcon size={13} />+{coinsEarned}
                </span>
              )}
            </div>
            {!isPhase2 && (
              <button
                type="button"
                onClick={onExplain}
                className="brilliant-practice-chip shrink-0 cursor-pointer whitespace-nowrap px-3.5 text-[13.5px]"
              >
                {tt('rusDarslikWhy')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <BrilliantMissedTargetIcon />
              <p className="text-[20px] font-extrabold leading-tight tracking-tight text-pfg">
                {tt('rusDarslikIncorrect')}
              </p>
            </div>
            <p className={cn('text-[14.5px] font-medium leading-snug', isPhase2 ? 'text-pmuted' : 'brilliant-practice-wrong-sub')}>
              {tt('practiceMistakeHint')}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {(!isCorrect || isPhase2) && (
            <button
              type="button"
              onClick={onExplain}
              className="brilliant-practice-secondary min-w-0 flex-[0.4] cursor-pointer whitespace-nowrap px-4 text-[15px]"
            >
              {tt('rusDarslikWhy')}
            </button>
          )}

          {isCorrect && mascotSlot && !isPhase2 && (
            <div aria-hidden="true" className="relative block size-12 shrink-0">
              {mascotSlot}
            </div>
          )}

          <button
            type="button"
            onClick={onContinue}
            className={cn(
              'brilliant-practice-action min-w-0 cursor-pointer whitespace-nowrap px-5 text-[16px]',
              !isCorrect || isPhase2 ? 'flex-[0.6]' : 'flex-1',
            )}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
