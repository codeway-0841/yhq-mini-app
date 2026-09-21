/**
 * math-board public API barrel (qoida 1a: boshqa feature FAQAT shu orqali import qiladi).
 *
 * Faza 3: Page + recognition type/interface + problems + session/check hook'lar.
 * Adapterlar (Faza 4) shu barrel orqali qo'shiladi.
 */
export { default as MathBoardPage } from './MathBoardPage'
export type {
  RecognitionProvider,
  RecognitionResult,
  RecognitionAdapter,
  RecognitionInput,
  RecognitionCategory,
} from './recognition/types'
export { BOARD_PROBLEMS, boardProblemById } from './lib/problems'
export type { BoardProblem } from './lib/problems'
export { latexToAscii } from './lib/latex-to-ascii'
export { isSolvedStep, closedTruth } from './lib/solve'
export { useBoardSession } from './hooks/useBoardSession'
export type { AcceptedStep } from './hooks/useBoardSession'
export { useStepCheck, STEP_DEBOUNCE_MS } from './hooks/useStepCheck'
export type { LiveStatus } from './hooks/useStepCheck'
export { useOnline } from './hooks/useOnline'
export { useBoardBlocks } from './hooks/useBoardBlocks'
export { useBoardTurn } from './hooks/useBoardTurn'
export { default as FloatingToolbar } from './components/FloatingToolbar'
export { default as BoardActionFab } from './components/BoardActionFab'
export { default as MathBlockOverlay } from './components/MathBlockOverlay'
export { default as RecognitionReviewSheet } from './components/RecognitionReviewSheet'
export type { ReviewBlock } from './components/RecognitionReviewSheet'
export { default as SolutionSheet } from './components/SolutionSheet'
export { getAdapter, availableProviders, recognizeBlocks } from './recognition/adapters'
export type { BlockRecognitionInput, BlockRecognitionOutput } from './recognition/adapters'
export { renderStrokesToDataUrl, SNAPSHOT_SIZE } from './lib/snapshot'
export { localHintKey, shouldOfferLlmHint, FALLBACK_HINT_KEY } from './lib/hints'
export { captureContext, sameContext, strokeMarker } from './lib/request-guard'
export type { BoardRequestContext, BoardRevisions } from './lib/request-guard'
export { recognitionErrorKey } from './lib/recognize-errors'
export { segmentStrokes, segmentKey, mergeBlockShells } from './lib/block-segmentation'
export type { StrokeSegment } from './lib/block-segmentation'
export { createTypedBlock, createDrawBlock, toBlockGrading } from './lib/board-model'
export type {
  BlockSource, BlockType, RecognitionState, BoardRect, BlockRecognition,
  BlockGradingStatus, MathBlock, BoardTurn,
} from './lib/board-model'
export { createTurn, appendTurn, MAX_TURNS } from './lib/board-revisions'
