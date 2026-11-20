import { useEffect, useState } from 'react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import type { LeagueWeekly } from '../../shared/api'
import { leaderboardPageCaches } from '../../shared/lib/leaderboard-cache'
import { BrilliantEndstateShell } from '../../shared/components/BrilliantEndstateShell'
import {
  BrilliantChargeStage,
  BrilliantCompletionStage,
  BrilliantLeagueStage,
  BrilliantPracticeNudgeStage,
  BrilliantStreakStage,
  buildLeagueClimb,
} from '../../shared/components/BrilliantCompletionContent'
import { type BrilliantPracticeTrigger } from '../../shared/components/BrilliantEndstateRive'
import {
  BRILLIANT_LEAGUES,
  LeagueShield,
  getDaysLeftInWeek,
  resolveBrilliantLeagueId,
} from '../profile'
import { getSubjectBrilliantColor } from '../../shared/config/subjects'
import { useReviewPromptStore } from '../../shared/store/useReviewPromptStore'
import type { TopicBreakdownItem } from './topic-diagnosis'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' | 'pending' }

export interface PracticeEndstateStreak {
  streak: number
  showCharge: boolean
  charges: number
  chargeSaved: boolean
  chargeEarned: boolean
  streakExtended?: boolean
}

type EndstateStep = 'summary' | 'streak' | 'charge' | 'league' | 'nudge'

export default function ResultsModal({
  results,
  onRetry,
  onFinish,
  onOpenReview,
  onOpenPremium,
  threshold = 80,
  disqualifiedByCheat = false,
  earnedXp,
  endstateChain = false,
  endstateStreak = null,
  weeklyLeague: initialWeeklyLeague = null,
  preLessonScore = null,
}: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion?: (i: number) => void
  onOpenReview?: () => void
  onOpenPremium?: () => void
  threshold?: number
  hideVerdict?: boolean
  topicBreakdown?: TopicBreakdownItem[]
  disqualifiedByCheat?: boolean
  earnedXp?: number
  earnedCoins?: number
  examPresetId?: string | null
  endstateChain?: boolean
  endstateStreak?: PracticeEndstateStreak | null
  weeklyLeague?: LeagueWeekly | null
  preLessonScore?: number | null
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tariff = useAppStore((s) => s.tariff)
  const userId = useAppStore((s) => s.user?.id) ?? '0'
  const storeLeague = useAppStore((s) => s.league)
  const isRu = lang === 'ru'
  const tt = useT(lang)

  const [stepIdx, setStepIdx] = useState(0)
  const [streakGlow, setStreakGlow] = useState(false)
  const [weeklyLeague, setWeeklyLeague] = useState<LeagueWeekly | null>(() => initialWeeklyLeague ?? leaderboardPageCaches.weekly.peek())

  useEffect(() => {
    if (!endstateChain || weeklyLeague || !userId || userId === '0') return
    let cancelled = false
    leaderboardPageCaches.weekly.fetch(userId)
      .then((data) => { if (!cancelled) setWeeklyLeague(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [endstateChain, userId, weeklyLeague])

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

  const leagueClimb = endstateChain && passed
    ? buildLeagueClimb(weeklyLeague, userId, actualEarnedXp, preLessonScore)
    : null
  const leagueTierId = resolveBrilliantLeagueId(weeklyLeague?.myLeague || storeLeague)
  const leagueTier = BRILLIANT_LEAGUES.find((l) => l.id === leagueTierId) ?? BRILLIANT_LEAGUES[0]

  const endstateQueue: EndstateStep[] = ['summary']
  if (endstateChain && passed) {
    if (endstateStreak && endstateStreak.streakExtended !== false && endstateStreak.streak > 0) {
      endstateQueue.push('streak')
    }
    if (endstateStreak?.showCharge) endstateQueue.push('charge')
    if (leagueClimb) endstateQueue.push('league')
    if (tariff !== 'premium') endstateQueue.push('nudge')
  } else if (passed && (endstateStreak?.chargeEarned || endstateStreak?.chargeSaved)) {
    endstateQueue.push('charge')
  }
  const currentStep: EndstateStep = endstateQueue[Math.min(stepIdx, endstateQueue.length - 1)] ?? 'summary'

  useEffect(() => {
    if (endstateChain) return
    if (disqualifiedByCheat) return
    if (total < 5 || percent < 70) return
    useReviewPromptStore.getState().request('test-result')
  }, [disqualifiedByCheat, endstateChain, total, percent])

  useEffect(() => {
    if (disqualifiedByCheat || !passed) {
      playSound('lesson-failed')
      haptics.error()
    } else if (percent === 100) {
      playSound('diagnostic-complete')
      haptics.achievement()
    } else {
      playSound('endstate')
      haptics.success()
    }
  }, [disqualifiedByCheat, passed, percent])

  const primaryLabel = !passed
    ? (isRu ? 'Повторить' : 'Qayta urinish')
    : currentStep === 'nudge'
      ? tt('rusDarslikLearnMore')
      : (isRu ? 'Продолжить' : 'Davom etish')

  const secondaryLabel = currentStep === 'summary' && wrong > 0 && onOpenReview
    ? (isRu ? `Работа над ошибками (${wrong})` : `Xatolar tahlili (${wrong})`)
    : currentStep === 'nudge'
      ? tt('rusDarslikRemindLater')
      : undefined

  const streakHeading = endstateStreak
    ? endstateStreak.streak <= 1
      ? (isRu ? 'Вы начали новую серию!' : 'Yangi seriyani boshladingiz!')
      : (isRu ? `Серия ${endstateStreak.streak} дн.!` : `${endstateStreak.streak} kunlik seriya!`)
    : ''

  const maybeRequestReview = () => {
    if (!disqualifiedByCheat && total >= 5 && percent >= 70) {
      useReviewPromptStore.getState().request('test-result')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-between bg-pcanvas"
      role="dialog"
      aria-modal="true"
      data-endstate={endstateChain ? currentStep : undefined}
    >
      <BrilliantEndstateShell
        viewportClassName={
          currentStep === 'streak' && streakGlow
            ? 'brilliant-streak-bg-glow'
            : currentStep === 'nudge'
              ? 'brilliant-iridescent-flipped'
              : undefined
        }
        primaryLabel={primaryLabel}
        primaryVariant={endstateChain && passed && currentStep !== 'nudge' ? 'secondary' : 'primary'}
        onPrimaryClick={() => {
          playSound('continue')
          haptics.impact('light')
          if (!passed) {
            onRetry()
            return
          }
          if (currentStep === 'nudge') {
            if (endstateChain) maybeRequestReview()
            if (onOpenPremium) onOpenPremium()
            else {
              if (typeof window !== 'undefined') window.location.hash = '#/premium'
              onFinish()
            }
            return
          }
          if (stepIdx + 1 < endstateQueue.length) {
            setStepIdx((prev) => prev + 1)
            return
          }
          if (endstateChain) maybeRequestReview()
          onFinish()
        }}
        secondaryLabel={secondaryLabel}
        secondaryVariant={currentStep === 'summary' ? 'ghost' : 'secondary'}
        onSecondaryClick={
          currentStep === 'nudge'
            ? () => {
                playSound('click')
                if (endstateChain) maybeRequestReview()
                onFinish()
              }
            : secondaryLabel
              ? () => {
                  playSound('hint')
                  haptics.impact('light')
                  onOpenReview?.()
                }
              : undefined
        }
      >
        {currentStep === 'streak' && endstateStreak ? (
          <BrilliantStreakStage
            streak={endstateStreak.streak}
            heading={streakHeading}
            lang={lang}
            dark={dark}
            onGlowChange={setStreakGlow}
          />
        ) : currentStep === 'charge' ? (
          <BrilliantChargeStage
            heading={endstateStreak?.chargeSaved
              ? (isRu ? 'Серия сохранена!' : 'Seriya saqlandi!')
              : (isRu ? 'Вы получили Заряд серии!' : 'Seriya zaryadini oldingiz!')}
            description={endstateStreak?.chargeSaved
              ? (isRu
                  ? 'Заряд серии спас вашу серию за вчерашний день.'
                  : 'Seriya zaryadi kechagi kun uchun seriyangizni saqlab qoldi.')
              : (isRu
                  ? 'Заряды сохраняют вашу серию, если вы пропустите день.'
                  : 'Kunni o‘tkazib yuborsangiz ham, zaryad seriyangizni saqlab qoladi.')}
            dark={dark}
          />
        ) : currentStep === 'league' && leagueClimb ? (
          <BrilliantLeagueStage
            heading={tt('rusDarslikLeagueHeading')}
            subtitle={tt('rusDarslikLeagueDaysLeft')
              .replace('{league}', leagueTier.name)
              .replace('{days}', String(getDaysLeftInWeek()))}
            leagueLevel={leagueTier.level}
            entries={leagueClimb.entries}
            oldRank={leagueClimb.oldRank}
            dark={dark}
            fallback={<LeagueShield tierId={leagueTier.id} size={112} />}
          />
        ) : currentStep === 'nudge' ? (
          <BrilliantPracticeNudgeStage
            heading={tt('rusDarslikPracticeNudgeTitle')}
            description={tt('rusDarslikPracticeNudgeDesc')}
            dark={dark}
          />
        ) : (
          <BrilliantCompletionStage
            mode="practice"
            heading={heading}
            xpLabel={isRu ? 'Всего XP' : 'Jami XP'}
            dark={dark}
            variant={colorVariant}
            practiceTrigger={practiceTrigger}
            showXp={allowXp}
            earnedXp={actualEarnedXp}
            practiceStats={{
              correct,
              wrong,
              total,
              percent,
              isRu,
            }}
          >
            {disqualifiedByCheat && (
              <div className="mt-3 rounded-2xl border-2 border-[rgb(var(--p-danger-rgb)/0.45)] bg-psurface p-3 text-center text-xs font-semibold text-pdanger">
                {tt('antiCheatDisqualifiedTitle')}
              </div>
            )}

            {pending > 0 && (
              <p className="mt-2 text-center text-[11.5px] font-medium text-psubtle">
                ⏳ {pending} {tt('pendingSyncNotice') || `${pending} ta javob oflayn saqlandi`}
              </p>
            )}
          </BrilliantCompletionStage>
        )}
      </BrilliantEndstateShell>
    </div>
  )
}
