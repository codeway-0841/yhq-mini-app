import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ZoomIn, ZoomOut, RotateCcw, X, PenLine, Hand, Undo2, Redo2, Trash2,
  Highlighter, Eraser, ArrowUpRight, Minus,
} from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { haptics } from '../../../platform/haptics'
import { useT, type Lang } from '../../../shared/i18n'
import DrawingCanvas from './DrawingCanvas'
import {
  emptyDrawing, loadDrawingSession, saveDrawingSession, undoDrawing,
  redoDrawing, clearStrokes, type DrawingHistory, type DrawingTool,
} from './drawing-model'

interface TestImageAnnotatorModalProps {
  src: string
  alt?: string
  questionKey: string
  sessionKey: string
  language: Lang
  onClose: () => void
}

export default function TestImageAnnotatorModal({
  src,
  alt = 'Rasm',
  questionKey,
  sessionKey,
  language,
  onClose,
}: TestImageAnnotatorModalProps) {
  const tt = useT(language)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTouchDistRef = useRef<number | null>(null)

  // Chizish rejimi
  const [mode, setMode] = useState<'pan' | 'draw'>('pan')
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color] = useState('#ef4444') // Rasm ustiga qizil qalam ko'proq ko'rinadi
  const [width] = useState(4)

  const surfaceKey = `question-img:${questionKey}`
  const [drawingsRef] = useState(() => ({ current: loadDrawingSession(sessionKey) }))
  const [, setRevision] = useState(0)

  const getDrawing = useCallback((key: string) => {
    let drawing = drawingsRef.current.get(key)
    if (!drawing) {
      drawing = emptyDrawing()
      drawingsRef.current.set(key, drawing)
    }
    return drawing
  }, [drawingsRef])

  const persistAndRefresh = useCallback(() => {
    saveDrawingSession(sessionKey, drawingsRef.current)
    setRevision((v) => v + 1)
  }, [sessionKey, drawingsRef])

  const mutate = (action: (d: DrawingHistory) => void) => {
    action(getDrawing(surfaceKey))
    persistAndRefresh()
  }

  // Reset transform on src change
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [src])

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const next = Math.min(prev + 0.5, 4)
      haptics.impact('light')
      return next
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1)
      if (next === 1) setPosition({ x: 0, y: 0 })
      haptics.impact('light')
      return next
    })
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    haptics.impact('light')
  }, [])

  // Pan hodisalari (faqat mode === 'pan' bo'lganda)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'pan' || scale <= 1) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'pan' || !isDragging || scale <= 1) return
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handleMouseUp = () => {
    if (mode === 'pan') setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'pan') return
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastTouchDistRef.current = dist
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (mode !== 'pan') return
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      })
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const diff = dist - lastTouchDistRef.current
      if (Math.abs(diff) > 5) {
        setScale((prev) => Math.min(Math.max(prev + diff * 0.01, 1), 4))
        lastTouchDistRef.current = dist
      }
    }
  }

  const handleTouchEnd = () => {
    if (mode !== 'pan') return
    setIsDragging(false)
    lastTouchDistRef.current = null
    if (scale <= 1) setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (mode !== 'pan') return
    e.preventDefault()
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4))
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1)
        if (next === 1) setPosition({ x: 0, y: 0 })
        return next
      })
    }
  }

  const drawing = getDrawing(surfaceKey)

  return (
    <DialogOverlay
      onClose={onClose}
      position="center"
      zIndex={60}
      labelId="image-annotator-title"
      className="select-none touch-none animate-fadeIn !p-0"
      backdropClassName="bg-black/95 backdrop-blur-md"
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-between p-4 safe-top pb-[calc(1rem+var(--safe-bottom,0px))]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Yuqori panel: Sarlavha, Rejim almashtirgich va Yopish */}
        <span id="image-annotator-title" className="sr-only">{alt}</span>
        <div className="w-full flex items-center justify-between text-white z-20" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-xs">
              🔍 {Math.round(scale * 100)}%
            </span>

            {/* Rejim almashtirgich (Pan vs Draw) */}
            <div className="flex items-center rounded-full bg-white/15 p-0.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  haptics.impact('light')
                  setMode('pan')
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  mode === 'pan' ? 'bg-white text-black shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <Hand size={14} />
                <span className="hidden sm:inline">Surish</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.impact('light')
                  setMode('draw')
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  mode === 'draw' ? 'bg-pprimary text-white shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <PenLine size={14} />
                <span className="hidden sm:inline">{tt('imageAnnotate')}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-all shadow-lg"
            aria-label={tt('drawingClose')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Asosiy Rasm va Chizish qatlami */}
        <div
          className={`relative flex-1 w-full flex items-center justify-center overflow-hidden ${
            mode === 'pan' ? (scale > 1 ? 'cursor-grab active:cursor-grabbing' : '') : 'cursor-crosshair'
          }`}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
            }}
            className="relative flex items-center justify-center max-w-full max-h-full transition-transform will-change-transform"
          >
            <img
              src={src}
              alt={alt}
              className="max-w-[85vw] max-h-[70vh] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
              draggable={false}
            />

            {/* Chizish maydoni (Aynan rasmning ustiga yopishadi) */}
            <div className={`absolute inset-0 rounded-xl overflow-hidden ${mode === 'draw' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
              <DrawingCanvas
                drawing={drawing}
                tool={mode === 'draw' ? tool : 'hand'}
                color={color}
                width={width}
                label={tt('drawingCanvas')}
                className="absolute inset-0"
                onCommit={persistAndRefresh}
              />
            </div>
          </div>
        </div>

        {/* Pastki boshqaruv paneli */}
        <div
          className="flex items-center gap-2 bg-black/70 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl z-20 mb-2"
          onClick={(e) => e.stopPropagation()}
        >
          {mode === 'pan' ? (
            <>
              <button
                type="button"
                onClick={zoomOut}
                disabled={scale <= 1}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
                title="Kichraytirish"
              >
                <ZoomOut size={18} />
              </button>

              <button
                type="button"
                onClick={resetZoom}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold active:scale-90 transition-all flex items-center gap-1.5"
                title="Asliga qaytarish"
              >
                <RotateCcw size={14} />
                <span>100%</span>
              </button>

              <button
                type="button"
                onClick={zoomIn}
                disabled={scale >= 4}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
                title="Kattalashtirish"
              >
                <ZoomIn size={18} />
              </button>
            </>
          ) : (
            <>
              {/* Chizish asboblari */}
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-pprimary text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={tt('drawingPen')}
              >
                <PenLine size={18} />
              </button>
              <button
                type="button"
                onClick={() => setTool('marker')}
                className={`p-2 rounded-xl transition-all ${tool === 'marker' ? 'bg-pprimary text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={tt('drawingMarker')}
              >
                <Highlighter size={18} />
              </button>
              <button
                type="button"
                onClick={() => setTool('line')}
                className={`p-2 rounded-xl transition-all ${tool === 'line' ? 'bg-pprimary text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={tt('drawingLine')}
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                onClick={() => setTool('arrow')}
                className={`p-2 rounded-xl transition-all ${tool === 'arrow' ? 'bg-pprimary text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={tt('drawingArrow')}
              >
                <ArrowUpRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-xl transition-all ${tool === 'eraser' ? 'bg-pprimary text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={tt('drawingEraser')}
              >
                <Eraser size={18} />
              </button>

              <div className="w-px h-5 bg-white/20 mx-1" />

              <button
                type="button"
                onClick={() => mutate(undoDrawing)}
                disabled={drawing.undo.length === 0}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
                title={tt('drawingUndo')}
              >
                <Undo2 size={18} />
              </button>
              <button
                type="button"
                onClick={() => mutate(redoDrawing)}
                disabled={drawing.redo.length === 0}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 active:scale-90 transition-all"
                title={tt('drawingRedo')}
              >
                <Redo2 size={18} />
              </button>
              <button
                type="button"
                onClick={() => mutate(clearStrokes)}
                disabled={drawing.strokes.length === 0}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-pdanger disabled:opacity-30 active:scale-90 transition-all"
                title={tt('drawingClear')}
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </DialogOverlay>
  )
}
