import type { ReactNode } from 'react'
import { X, Zap } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { ModalShell } from './ModalShell'
import { Button } from './ui/button'

export type BrilliantLessonStage = 'intro' | 'concept' | 'try' | 'synthesis'

export function BrilliantStagePill({
  stage,
  className,
}: {
  stage: BrilliantLessonStage
  className?: string
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)

  const label =
    stage === 'intro'
      ? tt('lessonStageIntro')
      : stage === 'try'
        ? tt('lessonStageTry')
        : stage === 'synthesis'
          ? tt('lessonStageSynthesis')
          : tt('lessonStageConcept')

  const tone =
    stage === 'try'
      ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary'
      : stage === 'synthesis'
        ? 'bg-[rgb(var(--p-success-rgb)/0.14)] text-psuccess'
        : 'bg-psurface text-pmuted'

  return (
    <span
      data-stage={stage}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em]',
        tone,
        className,
      )}
    >
      {label}
    </span>
  )
}

export function BrilliantSparkle({
  size = 16,
  className,
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
      aria-hidden="true"
      className={cn('text-[#21c65b] shrink-0', className)}
    >
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  )
}

export interface BrilliantReaderHeaderProps {
  onClose: () => void
  closeLabel: string
  current: number
  total: number
  progressLabel: string
  eyebrow?: ReactNode
  hot?: boolean
  showLightning?: boolean
  trailing?: ReactNode
  className?: string
}

/**
 * Brilliant 1:1 yagona o'quvchi tepasi: X tugmasi, yumaloq 11px yashil progress bar,
 * chaqmoq indikatori va ixtiyoriy o'ng tugmalar (ovoz, mundarija).
 */
export function BrilliantReaderHeader({
  onClose,
  closeLabel,
  current,
  total,
  progressLabel,
  eyebrow,
  hot = false,
  showLightning = true,
  trailing,
  className,
}: BrilliantReaderHeaderProps) {
  const safeTotal = Math.max(1, total)
  const safeCurrent = Math.min(Math.max(1, current), safeTotal)
  const pct = Math.min(100, Math.round((safeCurrent / safeTotal) * 100))

  return (
    <header
      className={cn(
        'safe-top mx-auto flex min-h-[58px] w-full max-w-[520px] items-center gap-3 px-4 pb-2.5 pt-2',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-pmuted transition-colors hover:bg-psurface hover:text-pfg"
      >
        <X size={21} strokeWidth={2.35} />
      </button>

      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold tracking-wide text-pmuted">
            {eyebrow}
          </div>
        )}
        <div
          className="h-[11px] w-full overflow-hidden rounded-full bg-[#dedede] dark:bg-[#262626]"
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={1}
          aria-valuemax={safeTotal}
          aria-valuenow={safeCurrent}
        >
          <span
            className="block h-full rounded-full bg-[#21c65b] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {showLightning && (
        <Zap
          size={19}
          strokeWidth={2.2}
          aria-hidden="true"
          data-hot={hot ? 'true' : undefined}
          className={cn(
            'shrink-0 transition-[transform,color] duration-200',
            hot ? 'scale-110 fill-[#f5c417] text-[#f5c417]' : 'text-[#aaaaaa] dark:text-[#3c3c3c]',
          )}
        />
      )}

      {trailing}
    </header>
  )
}

export function BrilliantExitDialog({
  open,
  onStay,
  onLeave,
  mascot,
  zIndex = 95,
}: {
  open: boolean
  onStay: () => void
  onLeave: () => void
  mascot?: ReactNode
  zIndex?: number
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  if (!open) return null

  return (
    <ModalShell
      title={tt('rusDarslikExitTitle')}
      subtitle={tt('rusDarslikExitSubtitle')}
      onClose={onStay}
      zIndex={zIndex}
      swipeToDismiss={false}
      showHandle={false}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button type="button" variant="primary" block onClick={onStay}>
            {tt('rusDarslikKeepLearning')}
          </Button>
          <Button type="button" variant="secondary" block onClick={onLeave}>
            {tt('rusDarslikQuitLesson')}
          </Button>
        </div>
      }
    >
      {mascot ? (
        <div className="flex justify-center py-2">{mascot}</div>
      ) : null}
    </ModalShell>
  )
}
