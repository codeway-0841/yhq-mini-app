import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DrawingCanvas, emptyDrawing,
  undoDrawing, redoDrawing, clearStrokes,
  type DrawingHistory, type DrawingStroke, type DrawingTool,
} from '../../test'
import { loadBoardDrawings, saveBoardDrawings } from '../lib/drawing-store'
import { haptics } from '../../../platform/haptics'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import FloatingToolbar from './FloatingToolbar'

/**
 * Math Board — chizish dosksi (Faza 3: floating toolbar + overlay slot).
 *
 * `drawing-model` reuse (test barrel orqali, qoida 1a): stroke'lar 0..1
 * normalized. P1-4: stroke payload IndexedDB'da (`drawing-store`), localStorage'da
 * faqat metadata — eski `yhq-test-drawing-v2:math-board` snapshot avtomatik
 * migrate qilinadi. Persist xatosi jim yutilmaydi — non-blocking ogohlantirish.
 * Toolbar — suzuvchi (fixed): undo/redo/pen/eraser/clear/keyboard.
 * `overlay` — blok raqamlari qatlami (MathBlockOverlay, Faza 3).
 */

const SURFACE = (problemId: string): string => `question:math-board-${problemId}`
const SESSION = 'math-board'

interface BoardCanvasProps {
  problemId: string
  onStrokes: (strokes: DrawingStroke[]) => void
  label: string
  clearLabel: string
  onKeyboard: () => void
  overlay?: ReactNode
}

export default function BoardCanvas({ problemId, onStrokes, label, clearLabel, onKeyboard, overlay }: BoardCanvasProps) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const [history, setHistory] = useState<DrawingHistory>(() => emptyDrawing())
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [persistFailed, setPersistFailed] = useState(false)
  // P1-3 (round-3): load tugamaguncha chizish YOPIQ (ready-gate) — erta
  // stroke loaded map bilan race qilmaydi; save'lar ketma-ket queue.
  const [ready, setReady] = useState(false)
  const drawingsRef = useRef<Map<string, DrawingHistory> | null>(null)
  /** persist faqat shu problem load'idan keyin (cross-problem race himoyasi) */
  const readyForRef = useRef<string | null>(null)
  /** ROUND-4: YAGONA umumiy queue — LOAD'lar ham, SAVE'lar ham ketma-ket.
   *  Problem change queue'ni OVERWRITE QILMAYDI: yangi load oldingi pending
   *  save'lardan KEYIN bajariladi (aks holda B load A'ning havodagi save'idan
   *  OLDIN o'qib, eski holatni ko'rib, keyin uni bosib yuborardi). */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  // Masala almashganda (va mount'da) shu masala chizmasi yuklanadi
  useEffect(() => {
    let cancelled = false
    readyForRef.current = null
    setReady(false)
    // Load HAM umumiy queue'da — oldingi pending save'lar tugagach o'qiydi
    const p = queueRef.current.then(() => loadBoardDrawings(SESSION))
    queueRef.current = p
    void p.then((map) => {
      if (cancelled) return
      drawingsRef.current = map
      readyForRef.current = problemId
      const h = map.get(SURFACE(problemId)) ?? emptyDrawing()
      setHistory(h)
      setTool('pen')
      setReady(true)
      onStrokes(h.strokes)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  const persist = useCallback((next: DrawingHistory) => {
    const map = drawingsRef.current
    if (!map || readyForRef.current !== problemId) return // ready-gate — double safety
    // Entry KLONLANADI — keyingi stroke commitStroke orqali history state'ini
    // in-place o'zgartiradi; map/snapshot ifloslanmasligi kerak.
    map.set(SURFACE(problemId), {
      strokes: [...next.strokes],
      undo: next.undo.map((s) => [...s]),
      redo: next.redo.map((s) => [...s]),
    })
    onStrokes(next.strokes)
    // ROUND-4: immutable SNAPSHOT aynan queue'ga beriladi — execution vaqtida
    // drawingsRef.current QAYTA O'QILMAYDI (deterministik ketma-ketlik).
    const snapshot = new Map(map)
    const p = queueRef.current.then(() => saveBoardDrawings(SESSION, snapshot))
    queueRef.current = p
    // P1-4: persist xatosi jim yutilmaydi — UI'ga non-blocking signal
    void p.then((ok) => setPersistFailed(!ok))
  }, [problemId, onStrokes])

  const mutate = useCallback((fn: (h: DrawingHistory) => void) => {
    setHistory((prev) => {
      const next: DrawingHistory = {
        strokes: [...prev.strokes],
        undo: prev.undo.map((s) => [...s]),
        redo: prev.redo.map((s) => [...s]),
      }
      fn(next)
      persist(next)
      return next
    })
  }, [persist])

  const pickTool = useCallback((t: DrawingTool) => {
    haptics.impact('light')
    setTool(t)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-64 overflow-hidden rounded-2xl bg-white shadow-xs">
        {ready ? (
          <>
            <DrawingCanvas
              drawing={history}
              tool={tool}
              color="#111827"
              width={4}
              label={label}
              className="absolute inset-0 h-full w-full touch-none"
              onCommit={() => persist(history)}
            />
            {overlay}
          </>
        ) : (
          /* P1-3: load havoda — chizish input'i yopiq (race himoyasi) */
          <div className="absolute inset-0 animate-pulse bg-[rgb(var(--p-surface-rgb)/0.4)]" aria-busy="true" aria-label={label} />
        )}
      </div>
      {persistFailed && (
        <p className="text-[13px] font-medium text-pwarning" role="alert">
          {tt('mathBoardPersistFailed')}
        </p>
      )}
      {ready && (
        <FloatingToolbar
          tool={tool}
          onTool={pickTool}
          canUndo={history.undo.length > 0}
          canRedo={history.redo.length > 0}
          canClear={history.strokes.length > 0}
          onUndo={() => mutate(undoDrawing)}
          onRedo={() => mutate(redoDrawing)}
          onClear={() => mutate(clearStrokes)}
          onKeyboard={onKeyboard}
          labels={{
            pen: tt('drawingPen'),
            eraser: tt('drawingEraser'),
            undo: tt('drawingUndo'),
            redo: tt('drawingRedo'),
            clear: clearLabel,
            keyboard: tt('mathBoardTypeTab'),
            lassoSoon: tt('mathBoardLassoSoon'),
          }}
        />
      )}
    </div>
  )
}
