import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, Circle, Eraser, Hand, Highlighter, Minus, NotebookPen,
  PenLine, Redo2, Square, Trash2, Undo2, X,
} from 'lucide-react'
import { Button } from '../../../shared/components/ui/button'
import { Sheet, SheetBody, SheetClose, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import { useT, type Lang } from '../../../shared/i18n'
import DrawingCanvas from './DrawingCanvas'
import {
  SCRATCHPAD_SURFACE, clearStrokes, emptyDrawing, loadDrawingSession,
  redoDrawing, saveDrawingSession, undoDrawing,
  type DrawingHistory, type DrawingTool,
} from './drawing-model'

interface TestDrawingLayerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionKey: string
  sessionKey: string
  language: Lang
  raised?: boolean
}

interface DrawingToolbarProps {
  drawing: DrawingHistory
  tool: DrawingTool
  color: string
  width: number
  tt: ReturnType<typeof useT>
  onToolChange: (tool: DrawingTool) => void
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onScratchpad?: () => void
  onClose?: () => void
  compact?: boolean
}

const COLORS = [
  { value: '#111827', key: 'drawingColorBlack' as const },
  { value: '#ef4444', key: 'drawingColorRed' as const },
  { value: '#2563eb', key: 'drawingColorBlue' as const },
  { value: '#16a34a', key: 'drawingColorGreen' as const },
]

const WIDTHS = [
  { value: 3, key: 'drawingWidthThin' as const },
  { value: 5, key: 'drawingWidthMedium' as const },
  { value: 8, key: 'drawingWidthThick' as const },
]

function ToolButton({ selected, label, onClick, children }: {
  selected: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      className={selected ? 'bg-[rgb(var(--p-primary-rgb)/0.12)] text-pprimary ring-2 ring-pprimary' : 'bg-psurface text-pfg'}
    >
      {children}
    </Button>
  )
}

function DrawingToolbar({
  drawing, tool, color, width, tt, onToolChange, onColorChange, onWidthChange,
  onUndo, onRedo, onClear, onScratchpad, onClose, compact = false,
}: DrawingToolbarProps) {
  return (
    <div role="toolbar" aria-label={tt('drawingTools')} className="space-y-2.5">
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ToolButton selected={tool === 'hand'} label={tt('drawingHand')} onClick={() => onToolChange('hand')}><Hand /></ToolButton>
        <ToolButton selected={tool === 'pen'} label={tt('drawingPen')} onClick={() => onToolChange('pen')}><PenLine /></ToolButton>
        <ToolButton selected={tool === 'marker'} label={tt('drawingMarker')} onClick={() => onToolChange('marker')}><Highlighter /></ToolButton>
        <ToolButton selected={tool === 'eraser'} label={tt('drawingEraser')} onClick={() => onToolChange('eraser')}><Eraser /></ToolButton>
        <ToolButton selected={tool === 'line'} label={tt('drawingLine')} onClick={() => onToolChange('line')}><Minus /></ToolButton>
        <ToolButton selected={tool === 'arrow'} label={tt('drawingArrow')} onClick={() => onToolChange('arrow')}><ArrowUpRight /></ToolButton>
        <ToolButton selected={tool === 'rectangle'} label={tt('drawingRectangle')} onClick={() => onToolChange('rectangle')}><Square /></ToolButton>
        <ToolButton selected={tool === 'ellipse'} label={tt('drawingEllipse')} onClick={() => onToolChange('ellipse')}><Circle /></ToolButton>
      </div>

      <div className="flex flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
        <div role="group" aria-label={tt('drawingColors')} className="flex gap-2">
          {COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onColorChange(item.value)}
              aria-label={tt(item.key)}
              aria-pressed={color === item.value}
              className={`grid size-11 place-items-center rounded-xl bg-psurface transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${color === item.value ? 'ring-2 ring-pprimary' : ''}`}
            >
              <span className="size-5 rounded-full shadow-xs" style={{ backgroundColor: item.value }} />
            </button>
          ))}
        </div>
        <div role="group" aria-label={tt('drawingWidths')} className="flex gap-2">
          {WIDTHS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onWidthChange(item.value)}
              aria-label={tt(item.key)}
              aria-pressed={width === item.value}
              className={`grid size-11 place-items-center rounded-xl bg-psurface text-pfg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${width === item.value ? 'ring-2 ring-pprimary' : ''}`}
            >
              <span className="block w-5 rounded-full bg-current" style={{ height: item.value }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onUndo} disabled={drawing.undo.length === 0} aria-label={tt('drawingUndo')} title={tt('drawingUndo')} className="bg-psurface"><Undo2 /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={onRedo} disabled={drawing.redo.length === 0} aria-label={tt('drawingRedo')} title={tt('drawingRedo')} className="bg-psurface"><Redo2 /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={onClear} disabled={drawing.strokes.length === 0} aria-label={tt('drawingClear')} title={tt('drawingClear')} className="bg-psurface text-pdanger"><Trash2 /></Button>
        <div className="flex-1" />
        {!compact && onScratchpad && (
          <Button type="button" variant="secondary" onClick={onScratchpad} aria-label={tt('drawingScratchpad')}>
            <NotebookPen /> <span className="hidden min-[390px]:inline">{tt('drawingScratchpad')}</span>
          </Button>
        )}
        {!compact && onClose && <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={tt('drawingClose')} title={tt('drawingClose')} className="bg-psurface"><X /></Button>}
      </div>
    </div>
  )
}

export default function TestDrawingLayer({
  open, onOpenChange, questionKey, sessionKey, language, raised = false,
}: TestDrawingLayerProps) {
  const tt = useT(language)
  // Lazy init: localStorage har renderda qayta o‘qilmaydi.
  const [drawingsRef] = useState(() => ({ current: loadDrawingSession(sessionKey) }))
  const loadedSessionRef = useRef(sessionKey)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState('#111827')
  const [width, setWidth] = useState(5)
  const [scratchpadOpen, setScratchpadOpen] = useState(false)
  const [, setRevision] = useState(0)
  const surfaceKey = `question:${questionKey}`

  if (loadedSessionRef.current !== sessionKey) {
    loadedSessionRef.current = sessionKey
    drawingsRef.current = loadDrawingSession(sessionKey)
  }

  const getDrawing = useCallback((key: string) => {
    let drawing = drawingsRef.current.get(key)
    if (!drawing) {
      drawing = emptyDrawing()
      drawingsRef.current.set(key, drawing)
    }
    return drawing
  }, [])

  const persistAndRefresh = useCallback(() => {
    saveDrawingSession(sessionKey, drawingsRef.current)
    setRevision((value) => value + 1)
  }, [sessionKey])

  const mutate = (key: string, action: (drawing: DrawingHistory) => void) => {
    action(getDrawing(key))
    persistAndRefresh()
  }

  useEffect(() => { setRevision((value) => value + 1) }, [questionKey])

  if (!open) {
    return (
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={() => onOpenChange(true)}
        aria-label={tt('drawingOpen')}
        className={`fixed right-4 z-40 size-14 rounded-[18px] bg-pcard shadow-xl transition-[bottom,transform,background-color] ${
          raised ? 'bottom-[calc(6.5rem+var(--safe-bottom,0px))]' : 'bottom-[calc(1.5rem+var(--safe-bottom,0px))]'
        }`}
      >
        <PenLine className="size-6" />
      </Button>
    )
  }

  const pageDrawing = getDrawing(surfaceKey)
  const scratchpadDrawing = getDrawing(SCRATCHPAD_SURFACE)

  return (
    <>
      {!scratchpadOpen && (
        <>
          <DrawingCanvas drawing={pageDrawing} tool={tool} color={color} width={width} label={tt('drawingCanvas')}
            className="absolute inset-0 z-[35]" onCommit={persistAndRefresh} />
          <div className="fixed inset-x-3 bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-50 mx-auto max-w-md rounded-3xl bg-pcard p-3 shadow-2xl">
            <DrawingToolbar
              drawing={pageDrawing} tool={tool} color={color} width={width} tt={tt}
              onToolChange={setTool} onColorChange={setColor} onWidthChange={setWidth}
              onUndo={() => mutate(surfaceKey, undoDrawing)} onRedo={() => mutate(surfaceKey, redoDrawing)}
              onClear={() => mutate(surfaceKey, clearStrokes)} onScratchpad={() => setScratchpadOpen(true)}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </>
      )}

      <Sheet open={scratchpadOpen} onClose={() => setScratchpadOpen(false)} zIndex={70} className="max-w-2xl overflow-hidden">
        <SheetHeader><SheetTitle>{tt('drawingScratchpadTitle')}</SheetTitle></SheetHeader>
        <SheetClose onClose={() => setScratchpadOpen(false)} label={tt('drawingScratchpadClose')} />
        <SheetBody className="space-y-3 px-3 pb-3">
          <div className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-2xl bg-white shadow-inner">
            <DrawingCanvas drawing={scratchpadDrawing} tool={tool === 'hand' ? 'pen' : tool} color={color} width={width}
              label={tt('drawingScratchpadCanvas')} className="absolute inset-0" onCommit={persistAndRefresh} />
          </div>
          <DrawingToolbar
            drawing={scratchpadDrawing} tool={tool === 'hand' ? 'pen' : tool} color={color} width={width} tt={tt}
            onToolChange={setTool} onColorChange={setColor} onWidthChange={setWidth}
            onUndo={() => mutate(SCRATCHPAD_SURFACE, undoDrawing)} onRedo={() => mutate(SCRATCHPAD_SURFACE, redoDrawing)}
            onClear={() => mutate(SCRATCHPAD_SURFACE, clearStrokes)} compact
          />
        </SheetBody>
      </Sheet>
    </>
  )
}
