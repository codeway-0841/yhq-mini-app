/**
 * test feature'ining PUBLIC API — boshqa feature'lar FAQAT shu barrel orqali
 * import qiladi (import-boundary qoidasi shuni tekshiradi).
 * Ichki fayllarga (hooks/, components/, *.ts) tashqaridan murojaat TAQIQLANGAN.
 */
export { default as ResultsModal } from './ResultsModal'
export type { QuestionResult } from './ResultsModal'
export { default as CertificateModal } from './CertificateModal'
export { formatImageSrc } from './hooks/useImagePreload'
/** Server-authoritative practice engine (v2) — adaptive/speed migratsiyasi uchun public. */
export { default as ServerPracticePage } from './ServerPracticePage'
/** Chizish qatlami (math-board BoardCanvas reuse uchun public). */
export { default as DrawingCanvas, drawStroke } from './components/DrawingCanvas'
export {
  emptyDrawing, loadDrawingSession, saveDrawingSession, clearDrawingSession,
  commitStroke, undoDrawing, redoDrawing, clearStrokes,
  drawingStorageKey, parseDrawingSessionData, serializeDrawingSession, surfacesFromDrawings,
} from './components/drawing-model'
export type { DrawingHistory, DrawingStroke, DrawingPoint, DrawingTool, StrokeTool } from './components/drawing-model'
