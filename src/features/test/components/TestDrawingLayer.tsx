import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, BookOpen, Calculator, Circle, Eraser, Eye, EyeOff, Hand,
  Highlighter, Minus, NotebookPen, PenLine, Redo2, Square, Trash2, Undo2, X,
} from 'lucide-react'
import { Button } from '../../../shared/components/ui/button'
import { Sheet, SheetBody, SheetClose, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import { useT, type Lang } from '../../../shared/i18n'
import DrawingCanvas from './DrawingCanvas'
import TestToolsHub from './TestToolsHub'
import {
  SCRATCHPAD_SURFACE, clearStrokes, emptyDrawing, loadDrawingSession,
  redoDrawing, saveDrawingSession, undoDrawing,
  type DrawingHistory, type DrawingTool,
} from './drawing-model'

export interface TestDrawingLayerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionKey: string
  sessionKey: string
  language: Lang
  raised?: boolean
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  onOpenCalculator?: () => void
  onOpenFormulas?: () => void
  onToggleSave?: () => void
  isSaved?: boolean
  scratchpadOpen?: boolean
  onScratchpadOpenChange?: (open: boolean) => void
}

interface DrawingToolbarProps {
  drawing: DrawingHistory
  tool: DrawingTool
  color: string
  width: number
  tt: ReturnType<typeof useT>
  visible: boolean
  onToolChange: (tool: DrawingTool) => void
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onToggleVisibility: () => void
  onScratchpad?: () => void
  onCalculator?: () => void
  onFormulas?: () => void
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
      className={`size-10 rounded-xl transition-all active:scale-95 ${
        selected
          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 ring-2 ring-purple-400 ring-inset'
          : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
      }`}
    >
      {children}
    </Button>
  )
}

function DrawingToolbar({
  drawing, tool, color, width, tt, visible, onToolChange, onColorChange, onWidthChange,
  onUndo, onRedo, onClear, onToggleVisibility, onScratchpad, onCalculator, onFormulas, onClose, compact = false,
}: DrawingToolbarProps) {
  return (
    <div role="toolbar" aria-label={tt('drawingTools')} className="space-y-2.5 text-white">
      <div className="flex gap-2 overflow-x-auto py-1 px-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`grid size-11 place-items-center rounded-xl bg-white/10 transition-transform active:scale-95 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                color === item.value ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 bg-white/20' : ''
              }`}
            >
              <span
                className={`size-5 rounded-full shadow-xs ${item.value === '#111827' ? 'border border-white/50' : ''}`}
                style={{ backgroundColor: item.value }}
              />
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
              className={`grid size-11 place-items-center rounded-xl bg-white/10 text-white transition-transform active:scale-95 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                width === item.value ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 bg-white/20 text-purple-300' : 'text-white/80'
              }`}
            >
              <span className="block w-5 rounded-full bg-current" style={{ height: item.value }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={drawing.undo.length === 0}
          aria-label={tt('drawingUndo')}
          title={tt('drawingUndo')}
          className="size-10 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white disabled:opacity-25 disabled:hover:bg-white/10"
        >
          <Undo2 size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={drawing.redo.length === 0}
          aria-label={tt('drawingRedo')}
          title={tt('drawingRedo')}
          className="size-10 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white disabled:opacity-25 disabled:hover:bg-white/10"
        >
          <Redo2 size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          disabled={drawing.strokes.length === 0}
          aria-label={tt('drawingClear')}
          title={tt('drawingClear')}
          className="size-10 rounded-xl bg-white/10 hover:bg-red-500/20 text-red-400 disabled:opacity-25 disabled:hover:bg-white/10"
        >
          <Trash2 size={18} />
        </Button>

        {/* Ko'z tugmasi (yashirish / ko'rsatish) */}
        {!compact && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleVisibility}
            aria-label={tt(visible ? 'toolEyeHide' : 'toolEyeShow')}
            title={tt(visible ? 'toolEyeHide' : 'toolEyeShow')}
            className={`size-10 rounded-xl bg-white/10 hover:bg-white/15 ${!visible ? 'text-amber-400' : 'text-white/80 hover:text-white'}`}
          >
            {visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </Button>
        )}

        {/* Formulalar */}
        {!compact && onFormulas && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onFormulas}
            aria-label={tt('toolFormulas')}
            title={tt('toolFormulas')}
            className="size-10 rounded-xl bg-white/10 hover:bg-white/15 text-purple-300 hover:text-white"
          >
            <BookOpen size={18} />
          </Button>
        )}

        {/* Kalkulyator */}
        {!compact && onCalculator && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCalculator}
            aria-label={tt('toolCalculator')}
            title={tt('toolCalculator')}
            className="size-10 rounded-xl bg-white/10 hover:bg-white/15 text-purple-300 hover:text-white"
          >
            <Calculator size={18} />
          </Button>
        )}

        <div className="flex-1 min-w-2" />

        {/* Qoralama */}
        {!compact && onScratchpad && (
          <Button
            type="button"
            variant="ghost"
            onClick={onScratchpad}
            aria-label={tt('drawingScratchpad')}
            className="h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 px-3"
          >
            <NotebookPen size={18} /> <span className="hidden min-[410px]:inline text-xs font-semibold">{tt('drawingScratchpad')}</span>
          </Button>
        )}

        {!compact && onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={tt('drawingClose')}
            title={tt('drawingClose')}
            className="size-10 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
          >
            <X size={18} />
          </Button>
        )}
      </div>
    </div>
  )
}

export default function TestDrawingLayer({
  open,
  onOpenChange,
  questionKey,
  sessionKey,
  language,
  raised = false,
  visible: controlledVisible,
  onVisibleChange,
  onOpenCalculator,
  onOpenFormulas,
  onToggleSave,
  isSaved = false,
  scratchpadOpen: controlledScratchpadOpen,
  onScratchpadOpenChange,
}: TestDrawingLayerProps) {
  const tt = useT(language)
  // Lazy init: localStorage har renderda qayta o‘qilmaydi.
  const [drawingsRef] = useState(() => ({ current: loadDrawingSession(sessionKey) }))
  const loadedSessionRef = useRef(sessionKey)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState('#111827')
  const [width, setWidth] = useState(5)

  // Ichki / Tashqi boshqariladigan holatlar
  const [internalScratchpadOpen, setInternalScratchpadOpen] = useState(false)
  const isScratchpadOpen = controlledScratchpadOpen ?? internalScratchpadOpen
  const setScratchpadOpen = (val: boolean) => {
    setInternalScratchpadOpen(val)
    onScratchpadOpenChange?.(val)
  }

  const [internalVisible, setInternalVisible] = useState(true)
  const isVisible = controlledVisible ?? internalVisible
  const toggleVisibility = () => {
    const next = !isVisible
    setInternalVisible(next)
    onVisibleChange?.(next)
  }

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
  }, [drawingsRef])

  const persistAndRefresh = useCallback(() => {
    saveDrawingSession(sessionKey, drawingsRef.current)
    setRevision((value) => value + 1)
  }, [sessionKey, drawingsRef])

  const mutate = (key: string, action: (drawing: DrawingHistory) => void) => {
    action(getDrawing(key))
    persistAndRefresh()
  }

  useEffect(() => { setRevision((value) => value + 1) }, [questionKey])

  const pageDrawing = getDrawing(surfaceKey)
  const scratchpadDrawing = getDrawing(SCRATCHPAD_SURFACE)
  const hasPageStrokes = pageDrawing.strokes.length > 0

  return (
    <>
      {/* 
        Doimiy fon qatlami: Agar panel yopiq bo'lsa ham, chizmalar mavjud bo'lsa va isVisible bo'lsa,
        variantlar ustida ko'rinib turadi, ammo pointer-events-none bo'ladi!
      */}
      {!open && isVisible && hasPageStrokes && (
        <DrawingCanvas
          drawing={pageDrawing}
          tool="hand"
          color={color}
          width={width}
          label={tt('drawingCanvas')}
          className="pointer-events-none absolute inset-0 z-[15]"
          onCommit={persistAndRefresh}
        />
      )}

      {/* Agar panel yopiq bo'lsa: Suzuvchi Asboblar Markazi (FAB Hub) */}
      {!open && (
        <TestToolsHub
          onOpenDrawing={() => onOpenChange(true)}
          onOpenScratchpad={() => setScratchpadOpen(true)}
          onOpenCalculator={() => onOpenCalculator?.()}
          onOpenFormulas={() => onOpenFormulas?.()}
          onToggleSave={() => onToggleSave?.()}
          isSaved={isSaved}
          hasStrokes={hasPageStrokes}
          drawingsVisible={isVisible}
          onToggleVisibility={toggleVisibility}
          language={language}
          raised={raised}
        />
      )}

      {/* Agar panel ochiq bo'lsa: Faol chizish qatlami va toolbar */}
      {open && !isScratchpadOpen && (
        <>
          <DrawingCanvas
            drawing={pageDrawing}
            tool={isVisible ? tool : 'hand'}
            color={color}
            width={width}
            label={tt('drawingCanvas')}
            className={`absolute inset-0 z-[35] ${!isVisible ? 'opacity-20' : ''}`}
            onCommit={persistAndRefresh}
          />
          <div className="fixed inset-x-3 bottom-[calc(0.75rem+var(--safe-bottom,0px))] z-50 mx-auto max-w-md rounded-3xl bg-slate-900/95 text-white backdrop-blur-2xl p-3.5 shadow-2xl border border-white/15 ring-1 ring-black/40">
            <DrawingToolbar
              drawing={pageDrawing}
              tool={tool}
              color={color}
              width={width}
              tt={tt}
              visible={isVisible}
              onToolChange={setTool}
              onColorChange={setColor}
              onWidthChange={setWidth}
              onUndo={() => mutate(surfaceKey, undoDrawing)}
              onRedo={() => mutate(surfaceKey, redoDrawing)}
              onClear={() => mutate(surfaceKey, clearStrokes)}
              onToggleVisibility={toggleVisibility}
              onScratchpad={() => setScratchpadOpen(true)}
              onCalculator={onOpenCalculator}
              onFormulas={onOpenFormulas}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </>
      )}

      {/* Qoralama doskasi (Sheet) */}
      <Sheet open={isScratchpadOpen} onClose={() => setScratchpadOpen(false)} zIndex={70} className="max-w-2xl overflow-hidden">
        <SheetHeader><SheetTitle>{tt('drawingScratchpadTitle')}</SheetTitle></SheetHeader>
        <SheetClose onClose={() => setScratchpadOpen(false)} label={tt('drawingScratchpadClose')} />
        <SheetBody className="space-y-3 px-3 pb-3">
          <div className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-2xl bg-white shadow-inner">
            <DrawingCanvas
              drawing={scratchpadDrawing}
              tool={tool === 'hand' ? 'pen' : tool}
              color={color}
              width={width}
              label={tt('drawingScratchpadCanvas')}
              className="absolute inset-0"
              onCommit={persistAndRefresh}
            />
          </div>
          <div className="rounded-2xl bg-slate-900/95 text-white p-3 shadow-xl border border-white/10">
            <DrawingToolbar
              drawing={scratchpadDrawing}
              tool={tool === 'hand' ? 'pen' : tool}
              color={color}
              width={width}
              tt={tt}
              visible={true}
              onToolChange={setTool}
              onColorChange={setColor}
              onWidthChange={setWidth}
              onUndo={() => mutate(SCRATCHPAD_SURFACE, undoDrawing)}
              onRedo={() => mutate(SCRATCHPAD_SURFACE, redoDrawing)}
              onClear={() => mutate(SCRATCHPAD_SURFACE, clearStrokes)}
              onToggleVisibility={() => {}}
              compact
            />
          </div>
        </SheetBody>
      </Sheet>
    </>
  )
}
