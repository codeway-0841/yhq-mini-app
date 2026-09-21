/**
 * Math Board — uzoq so'rovlar stale-guard (P0-D to'liq kontekst).
 *
 * Recognition (65s) va hint (30s) paytida quyidagilarning BIRORTASI o'zgarsa
 * eski javob tashlanadi: problemId, sessionRevision, userInkRevision,
 * recognitionRevision, acceptedStepsRevision, candidate, requestId.
 * Undo, accept, problem change, clear/input — barchasi revision bump qiladi.
 */

export interface BoardRequestContext {
  problemId: string
  sessionRevision: number
  userInkRevision: number
  recognitionRevision: number
  acceptedStepsRevision: number
  candidate: string
  requestId: number
}

export interface BoardRevisions {
  problemId: string
  sessionRevision: number
  userInkRevision: number
  recognitionRevision: number
  acceptedStepsRevision: number
}

/** Store snapshot + candidate + requestId → muzlatilgan kontekst */
export function captureContext(
  rev: BoardRevisions,
  candidate: string,
  requestId: number,
): BoardRequestContext {
  return {
    problemId: rev.problemId,
    sessionRevision: rev.sessionRevision,
    userInkRevision: rev.userInkRevision,
    recognitionRevision: rev.recognitionRevision,
    acceptedStepsRevision: rev.acceptedStepsRevision,
    candidate,
    requestId,
  }
}

/** Javob shu kontekstga tegishlimi? (stale success/error ikkalasi ham) */
export function sameContext(a: BoardRequestContext, b: BoardRequestContext): boolean {
  return a.problemId === b.problemId
    && a.sessionRevision === b.sessionRevision
    && a.userInkRevision === b.userInkRevision
    && a.recognitionRevision === b.recognitionRevision
    && a.acceptedStepsRevision === b.acceptedStepsRevision
    && a.candidate === b.candidate
    && a.requestId === b.requestId
}

interface StrokePoint {
  x: number
  y: number
}

interface StrokeLike {
  points: StrokePoint[]
}

/** Chizma holat belgisi: son + oxirgi nuqta (arzon, qayta-render'siz) */
export function strokeMarker(strokes: StrokeLike[]): string {
  const last = strokes[strokes.length - 1]?.points.slice(-1)[0]
  return `${strokes.length}:${last ? `${last.x.toFixed(3)},${last.y.toFixed(3)}` : '-'}`
}
