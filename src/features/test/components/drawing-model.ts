export const DRAWING_STORAGE_PREFIX = 'yhq-test-drawing-v2:'
export const SCRATCHPAD_SURFACE = 'scratchpad'

export type DrawingTool = 'hand' | 'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'ellipse'
export type StrokeTool = Exclude<DrawingTool, 'hand'>

export interface DrawingPoint {
  /** Canvas width/height'ga nisbatan 0..1 koordinata. */
  x: number
  y: number
}

export interface DrawingStroke {
  tool: StrokeTool
  color: string
  width: number
  opacity: number
  points: DrawingPoint[]
}

export interface DrawingHistory {
  strokes: DrawingStroke[]
  undo: DrawingStroke[][]
  redo: DrawingStroke[][]
}

interface PersistedDrawingSession {
  version: 2
  surfaces: Record<string, DrawingStroke[]>
}

const MAX_SURFACES = 80
const MAX_STROKES_PER_SURFACE = 250
const MAX_POINTS_PER_STROKE = 1_200
const MAX_HISTORY = 50
const VALID_TOOLS = new Set<StrokeTool>(['pen', 'marker', 'eraser', 'line', 'arrow', 'rectangle', 'ellipse'])
const VALID_COLORS = new Set(['#111827', '#ef4444', '#2563eb', '#16a34a'])
const VALID_SURFACE = /^(scratchpad|question:[\w-]{1,80})$/

export function emptyDrawing(): DrawingHistory {
  return { strokes: [], undo: [], redo: [] }
}

export function drawingStorageKey(sessionKey: string): string {
  return `${DRAWING_STORAGE_PREFIX}${sessionKey}`
}

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validStroke(value: unknown): value is DrawingStroke {
  if (!value || typeof value !== 'object') return false
  const stroke = value as Partial<DrawingStroke>
  return VALID_TOOLS.has(stroke.tool as StrokeTool)
    && typeof stroke.color === 'string'
    && (stroke.tool === 'eraser' || VALID_COLORS.has(stroke.color))
    && finiteInRange(stroke.width, 1, 40)
    && finiteInRange(stroke.opacity, 0.05, 1)
    && Array.isArray(stroke.points)
    && stroke.points.length > 0
    && stroke.points.length <= MAX_POINTS_PER_STROKE
    && stroke.points.every((point) => finiteInRange(point?.x, 0, 1) && finiteInRange(point?.y, 0, 1))
}

/** Map → persist surfaces obyekti (validation + cap'lar bilan) */
export function surfacesFromDrawings(drawings: Map<string, DrawingHistory>): Record<string, DrawingStroke[]> {
  const surfaces: Record<string, DrawingStroke[]> = {}
  for (const [surface, drawing] of [...drawings.entries()].slice(0, MAX_SURFACES)) {
    if (VALID_SURFACE.test(surface) && drawing.strokes.length > 0) surfaces[surface] = drawing.strokes.slice(-MAX_STROKES_PER_SURFACE)
  }
  return surfaces
}

/**
 * Persist session obyektini (JSON.parse yoki IDB record) validate qilib
 * Map'ga o'giradi. Buzilgan/yaroqsiz ma'lumot jimgina tashlanadi.
 */
export function parseDrawingSessionData(parsed: unknown): Map<string, DrawingHistory> {
  const drawings = new Map<string, DrawingHistory>()
  const p = parsed as Partial<PersistedDrawingSession> | null
  if (!p || p.version !== 2 || !p.surfaces || typeof p.surfaces !== 'object') return drawings
  for (const [surface, strokes] of Object.entries(p.surfaces).slice(0, MAX_SURFACES)) {
    if (!VALID_SURFACE.test(surface) || !Array.isArray(strokes)) continue
    const valid = strokes.slice(-MAX_STROKES_PER_SURFACE).filter(validStroke)
    if (valid.length > 0) drawings.set(surface, { strokes: valid, undo: [], redo: [] })
  }
  return drawings
}

/** Map → v2 JSON string (bo'sh bo'lsa null — kalit o'chiriladi) */
export function serializeDrawingSession(drawings: Map<string, DrawingHistory>): string | null {
  const surfaces = surfacesFromDrawings(drawings)
  if (Object.keys(surfaces).length === 0) return null
  return JSON.stringify({ version: 2, surfaces } satisfies PersistedDrawingSession)
}

export function loadDrawingSession(sessionKey: string): Map<string, DrawingHistory> {
  if (typeof localStorage === 'undefined' || !sessionKey) return new Map()
  try {
    const raw = localStorage.getItem(drawingStorageKey(sessionKey))
    if (!raw) return new Map()
    return parseDrawingSessionData(JSON.parse(raw))
  } catch { /* private mode, disabled storage, or corrupt cache */ }
  return new Map()
}

export function saveDrawingSession(sessionKey: string, drawings: Map<string, DrawingHistory>): void {
  if (typeof localStorage === 'undefined' || !sessionKey) return
  try {
    const raw = serializeDrawingSession(drawings)
    if (raw === null) localStorage.removeItem(drawingStorageKey(sessionKey))
    else localStorage.setItem(drawingStorageKey(sessionKey), raw)
  } catch { /* quota/private mode: drawing continues in memory */ }
}

export function clearDrawingSession(sessionKey: string): void {
  if (typeof localStorage === 'undefined' || !sessionKey) return
  try { localStorage.removeItem(drawingStorageKey(sessionKey)) } catch { /* private mode */ }
}

export function commitStroke(history: DrawingHistory, stroke: DrawingStroke): void {
  history.undo.push(history.strokes)
  if (history.undo.length > MAX_HISTORY) history.undo.shift()
  history.strokes = [...history.strokes.slice(-(MAX_STROKES_PER_SURFACE - 1)), stroke]
  history.redo = []
}

export function clearStrokes(history: DrawingHistory): void {
  if (history.strokes.length === 0) return
  history.undo.push(history.strokes)
  if (history.undo.length > MAX_HISTORY) history.undo.shift()
  history.strokes = []
  history.redo = []
}

export function undoDrawing(history: DrawingHistory): void {
  const previous = history.undo.pop()
  if (!previous) return
  history.redo.push(history.strokes)
  history.strokes = previous
}

export function redoDrawing(history: DrawingHistory): void {
  const next = history.redo.pop()
  if (!next) return
  history.undo.push(history.strokes)
  history.strokes = next
}

export function simplifyPoints(points: DrawingPoint[]): DrawingPoint[] {
  if (points.length <= MAX_POINTS_PER_STROKE) return points
  const stride = Math.ceil(points.length / MAX_POINTS_PER_STROKE)
  const sampled = points.filter((_, index) => index % stride === 0)
  const last = points[points.length - 1]
  if (sampled[sampled.length - 1] !== last) sampled.push(last)
  return sampled
}
