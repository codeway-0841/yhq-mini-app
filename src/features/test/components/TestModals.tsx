import type { Question } from '../../../shared/api'
import { useT } from '../../../shared/i18n'
import ImageZoomModal from '../../../shared/components/ImageZoomModal'
import SettingsModal from '../../../shared/components/SettingsModal'
import ResultsModal, { type QuestionResult } from '../ResultsModal'
import AiTutorModal from './AiTutorModal'
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

  // AI Tutor
  showAiTutor:         boolean
  onCloseAiTutor:      () => void
  currentQuestion?:    Question
  selectedOption:      string | null
  isAnswerCorrect:     boolean

  // Image Zoom
  zoomed:              boolean
  onCloseZoom:         () => void
  currentIndex:        number
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

  showSettings,
  onCloseSettings,

  showReview,
  reviewItems,
  language,
  onCloseReview,

  activeStrike,
  onDismissStrike,

  showAiTutor,
  onCloseAiTutor,
  currentQuestion,
  selectedOption,
  isAnswerCorrect,

  zoomed,
  onCloseZoom,
  currentIndex,
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

      {showAiTutor && currentQuestion && selectedOption && (
        <AiTutorModal
          questionId={currentQuestion.id}
          selectedOptionId={selectedOption}
          isCorrect={isAnswerCorrect}
          onClose={onCloseAiTutor}
          language={language}
        />
      )}

      {zoomed && currentQuestion?.image && (
        <ImageZoomModal
          src={formatImageSrc(currentQuestion.image)!}
          alt={`${tt('question')} ${currentIndex + 1}`}
          onClose={onCloseZoom}
        />
      )}
    </>
  )
}
