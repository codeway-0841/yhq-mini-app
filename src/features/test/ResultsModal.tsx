import { useEffect } from 'react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import Confetti from '../../shared/components/Confetti'
import { BrilliantEndstateShell } from '../../shared/components/BrilliantEndstateShell'
import { BrilliantCompletionStage } from '../../shared/components/BrilliantCompletionContent'
import { type BrilliantPracticeTrigger } from '../../shared/components/BrilliantEndstateRive'
import { getSubjectBrilliantColor } from '../../shared/config/subjects'
import { useReviewPromptStore } from '../../shared/store/useReviewPromptStore'
import type { TopicBreakdownItem } from './topic-diagnosis'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' | 'pending' }

export default function ResultsModal({
  results,
  onRetry,
  onFinish,
  onOpenReview,
  threshold = 80,
  disqualifiedByCheat = false,
  earnedXp,
}: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion?: (i: number) => void
  onOpenReview?: () => void
  threshold?: number
  hideVerdict?: boolean
  topicBreakdown?: TopicBreakdownItem[]
  disqualifiedByCheat?: boolean
  earnedXp?: number
  earnedCoins?: number
  examPresetId?: string | null
}) {
  const lang = useAppStore((s) => s.settings.language)
  const isRu = lang === 'ru'
  const tt = useT(lang)

  const total = results.length
  const correct = results.filter((r) => r.status === 'correct').length
  const wrong = results.filter((r) => r.status === 'incorrect').length
  const pending = results.filter((r) => r.status === 'pending').length
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0

  const subjectId = useSubjectStore((s) => s.subjectId)
  const colorVariant = getSubjectBrilliantColor(subjectId)
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'

  const passed = percent >= threshold && !disqualifiedByCheat

  const practiceTrigger: BrilliantPracticeTrigger =
    disqualifiedByCheat || percent < 50
      ? 'playFailure'
      : percent === 100
        ? 'play100'
        : 'play50Plus'

  const heading =
    practiceTrigger === 'play100'
      ? (isRu ? 'Идеальный результат!' : 'Mukammal natija!')
      : practiceTrigger === 'play50Plus'
        ? (isRu ? 'Отличная практика!' : "A'lo mashq!")
        : (isRu ? 'Хорошая попытка!' : 'Yaxshi urinish!')

  const actualEarnedXp = typeof earnedXp === 'number'
    ? earnedXp
    : practiceTrigger === 'play100' ? 30 : practiceTrigger === 'play50Plus' ? 20 : 0

  const allowXp = practiceTrigger !== 'playFailure' && actualEarnedXp > 0

  useEffect(() => {
    if (disqualifiedByCheat) return
    if (total < 5 || percent < 70) return
    useReviewPromptStore.getState().request('test-result')
  }, [disqualifiedByCheat, total, percent])

  useEffect(() => {
    if (disqualifiedByCheat) {
      playSound('error')
      haptics.error()
    } else if (percent === 100) {
      playSound('win')
      haptics.achievement()
    } else if (passed) {
      playSound('win')
      haptics.success()
    } else {
      playSound('click')
      haptics.complete()
    }
  }, [disqualifiedByCheat, passed, percent])

  const confettiCount = percent === 100 ? 45 : percent >= 95 ? 25 : 0

  const primaryLabel = passed
    ? (isRu ? 'Продолжить' : 'Davom etish')
    : (isRu ? 'Повторить' : 'Qayta urinish')

  const secondaryLabel = wrong > 0 && onOpenReview
    ? (isRu ? `Работа над ошибками (${wrong})` : `Xatolar tahlili (${wrong})`)
    : undefined

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-between bg-pcanvas"
      role="dialog"
      aria-modal="true"
    >
      <BrilliantEndstateShell
        primaryLabel={primaryLabel}
        onPrimaryClick={() => {
          playSound('click')
          haptics.impact('light')
          if (passed) {
            onFinish()
          } else {
            onRetry()
          }
        }}
        secondaryLabel={secondaryLabel}
        onSecondaryClick={
          secondaryLabel
            ? () => {
                playSound('click')
                haptics.impact('light')
                onOpenReview?.()
              }
            : undefined
        }
        overlaySlot={confettiCount > 0 && !disqualifiedByCheat ? <Confetti count={confettiCount} /> : undefined}
      >
        <BrilliantCompletionStage
          mode="practice"
          heading={heading}
          xpLabel={isRu ? 'Всего XP' : 'Jami XP'}
          dark={dark}
          variant={colorVariant}
          practiceTrigger={practiceTrigger}
          showXp={allowXp}
          earnedXp={actualEarnedXp}
        >
          {/* Toza Brilliant uslubidagi natija chipi */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-psurface px-4 py-1.5 text-[14px] font-bold text-pfg border border-pline">
            <span className="font-black text-psuccess">{correct}</span>
            <span className="font-medium text-pmuted">/ {total} {isRu ? 'правильно' : 'to‘g‘ri'}</span>
            <span className="text-pmuted">•</span>
            <span className="tabular-nums font-black text-pfg">{percent}%</span>
          </div>

          {disqualifiedByCheat && (
            <div className="mt-3 rounded-2xl bg-pcard p-3 text-center text-xs font-semibold text-pdanger ring-1 ring-[rgb(var(--p-danger-rgb)/0.4)]">
              {tt('antiCheatDisqualifiedTitle')}
            </div>
          )}

          {pending > 0 && (
            <p className="mt-2 text-center text-[11.5px] font-medium text-psubtle">
              ⏳ {pending} {tt('pendingSyncNotice') || `${pending} ta javob oflayn saqlandi`}
            </p>
          )}
        </BrilliantCompletionStage>
      </BrilliantEndstateShell>
    </div>
  )
}
