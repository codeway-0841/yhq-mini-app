import { Info, GraduationCap } from 'lucide-react'
import type { Question, ApiSettings } from '../../../shared/api'
import ImageZoomModal from '../../../shared/components/ImageZoomModal'
import SettingsModal from '../../../shared/components/SettingsModal'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import ResultsModal, { type QuestionResult } from '../ResultsModal'
import AiTutorModal from './AiTutorModal'
import AntiCheatModal from './AntiCheatModal'
import ExamReviewModal, { type ExamReviewItem } from './ExamReviewModal'
import MarkdownExplanation from './MarkdownExplanation'
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

  // Explain Sheet
  showExplain:         boolean
  onCloseExplain:      () => void
  loadingDbExplain:    boolean
  dbExplanation:       string | null
  lessonExplanation:   { modId: number; lesson: any } | null
  onOpenModuleLesson?: (modId: number) => void
  tt:                  (key: any) => string
  settings:            ApiSettings

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

  showExplain,
  onCloseExplain,
  loadingDbExplain,
  dbExplanation,
  lessonExplanation,
  onOpenModuleLesson,
  tt,
  settings,

  showAiTutor,
  onCloseAiTutor,
  currentQuestion,
  selectedOption,
  isAnswerCorrect,

  zoomed,
  onCloseZoom,
  currentIndex,
}: TestModalsProps) {
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

      {showExplain && (
        <DialogOverlay onClose={onCloseExplain} labelId="explain-title">
          <div
            className="relative w-full max-w-lg mx-auto bg-psurface rounded-t-sheet p-5 pb-8 max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-plineStrong rounded-full mx-auto mb-4 flex-shrink-0" />
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <div className="size-9 rounded-xl bg-pwarning/15 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Info size={17} className="text-pwarning" />
              </div>
              <p id="explain-title" className="text-[15px] font-semibold text-pfg">
                {tt('whyThis')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {loadingDbExplain ? (
                <div className="flex items-center justify-center py-8 gap-2 text-pmuted">
                  <div className="w-5 h-5 rounded-full border-2 border-pprimary border-t-transparent animate-spin" />
                  <span className="text-xs">{tt('loadingDots')}</span>
                </div>
              ) : dbExplanation ? (
                <div className="bg-pcard p-3.5 rounded-2xl shadow-xs">
                  <MarkdownExplanation content={dbExplanation} />
                </div>
              ) : lessonExplanation ? (
                <div>
                  <p className="text-xs font-semibold text-pprimary mb-1.5">
                    {settings?.language === 'ru'
                      ? lessonExplanation.lesson.titleRu
                      : lessonExplanation.lesson.titleUz}
                  </p>
                  {(settings?.language === 'ru'
                    ? lessonExplanation.lesson.bodyRu
                    : lessonExplanation.lesson.bodyUz
                  )
                    .slice(0, 3)
                    .map((p: string, i: number) => (
                      <p key={i} className="text-[13px] text-pmuted leading-relaxed mb-2">
                        {p}
                      </p>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-pmuted py-4 text-center">
                  {settings?.language === 'ru'
                    ? 'Пояснение к этому вопросу скоро будет добавлено.'
                    : "Ushbu savol uchun izoh tez kunda qo'shiladi."}
                </p>
              )}
            </div>

            {lessonExplanation && onOpenModuleLesson && (
              <button
                onClick={() => {
                  onCloseExplain()
                  onOpenModuleLesson(lessonExplanation.modId)
                }}
                className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-150 w-full mt-4 py-3 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-2 flex-shrink-0 shadow-md"
              >
                <GraduationCap size={16} />
                {tt('openModule')}
              </button>
            )}
          </div>
        </DialogOverlay>
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
