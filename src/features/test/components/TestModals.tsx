import type { LeagueWeekly, Question } from '../../../shared/api'
import { useT } from '../../../shared/i18n'
import TestImageAnnotatorModal from './TestImageAnnotatorModal'
import SettingsModal from '../../../shared/components/SettingsModal'
import ResultsModal, { type PracticeEndstateStreak, type QuestionResult } from '../ResultsModal'
import AntiCheatModal from './AntiCheatModal'
import ExamReviewModal, { type ExamReviewItem } from './ExamReviewModal'
import { formatImageSrc } from '../hooks/useImagePreload'

interface TestModalsProps {
  // Results
  showResults:         boolean
  results:             QuestionResult[]
  onRetry:             () => void
  threshold:           number
  hideVerdict:         boolean
  topicBreakdown?:     any
  disqualifiedByCheat: boolean
  onOpenReview:        () => void
  onFinishFromModal:   () => void
  onGoToQuestion:      (index: number) => void
  earnedXp?:           number
  earnedCoins?:        number
  examPresetId?:       string | null
  endstateChain?:      boolean
  endstateStreak?:     PracticeEndstateStreak | null
  weeklyLeague?:       LeagueWeekly | null
  preLessonScore?:     number | null
  onOpenPremium?:      () => void

  // Settings
  showSettings:        boolean
  onCloseSettings:     () => void

  // Review
  showReview:          boolean
  reviewItems:         ExamReviewItem[]
  language:            'uz' | 'ru'
  onCloseReview:       () => void

  // Anti-Cheat
  activeStrike:        number | null
  onDismissStrike:     () => void

  // Image Zoom
  zoomed:              boolean
  onCloseZoom:         () => void
  currentQuestion?:    Question
  currentIndex:        number
  sessionKey?:         string
}

export default function TestModals({
  showResults,
  results,
  onRetry,
  threshold,
  hideVerdict,
  topicBreakdown,
  disqualifiedByCheat,
  onOpenReview,
  onFinishFromModal,
  onGoToQuestion,
  earnedXp,
  earnedCoins,
  examPresetId,
  endstateChain,
  endstateStreak,
  weeklyLeague,
  preLessonScore,
  onOpenPremium,

  showSettings,
  onCloseSettings,

  showReview,
  reviewItems,
  language,
  onCloseReview,

  activeStrike,
  onDismissStrike,

  zoomed,
  onCloseZoom,
  currentQuestion,
  currentIndex,
  sessionKey = 'default',
}: TestModalsProps) {
  const tt = useT(language)
  return (
    <>
      {showResults && (
        <ResultsModal
          results={results}
          onRetry={onRetry}
          threshold={threshold}
          hideVerdict={hideVerdict}
          topicBreakdown={topicBreakdown}
          disqualifiedByCheat={disqualifiedByCheat}
          onOpenReview={onOpenReview}
          onFinish={onFinishFromModal}
          onGoToQuestion={onGoToQuestion}
          earnedXp={earnedXp}
          earnedCoins={earnedCoins}
          examPresetId={examPresetId}
          endstateChain={endstateChain}
          endstateStreak={endstateStreak}
          weeklyLeague={weeklyLeague}
          preLessonScore={preLessonScore}
          onOpenPremium={onOpenPremium}
        />
      )}

      {showSettings && <SettingsModal onClose={onCloseSettings} />}

      {showReview && (
        <ExamReviewModal
          items={reviewItems}
          language={language}
          onClose={onCloseReview}
        />
      )}

      {activeStrike !== null && (
        <AntiCheatModal
          strike={activeStrike}
          language={language}
          onDismiss={onDismissStrike}
        />
      )}

      {zoomed && currentQuestion?.image && (
        <TestImageAnnotatorModal
          src={formatImageSrc(currentQuestion.image)!}
          alt={`${tt('question')} ${currentIndex + 1}`}
          questionKey={String(currentQuestion.id)}
          sessionKey={sessionKey}
          language={language}
          onClose={onCloseZoom}
        />
      )}
    </>
  )
}
