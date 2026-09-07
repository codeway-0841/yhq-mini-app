import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, BookOpen, Calculator, Circle, Eraser, Eye, EyeOff, Hand,
  Highlighter, Minus, NotebookPen, PenLine, Redo2, Square, Trash2, Undo2, X,
} from 'lucide-react'
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

function ToolButton({
  selected, children, onClick, label,
}: {
  selected: boolean
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      className={`grid size-10 shrink-0 place-items-center rounded-xl transition-all active:scale-95 ${
        selected
          ? 'bg-pprimary text-ponprimary shadow-md shadow-[0_4px_14px_rgb(var(--p-primary-rgb)/0.35)] ring-2 ring-white/40 ring-inset'
          : 'bg-white/10 hover:bg-white/20 text-white hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function DrawingToolbar({
  drawing, tool, color, width, tt, visible, onToolChange, onColorChange, onWidthChange,
  onUndo, onRedo, onClear, onToggleVisibility, onScratchpad, onCalculator, onFormulas, onClose, compact = false,
}: DrawingToolbarProps) {
  return (
    <div role="toolbar" aria-label={tt('drawingTools')} className="space-y-3 text-white">
      {/* Modal Header: Sarlavha, markaziy tortish dastagi va o'ng yuqori burchakda [X] yopish tugmasi */}
      {!compact && (
        <div className="relative flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-semibold tracking-wide text-white/80">
            {tt('drawingTools')}
          </span>

          {/* Markaziy tortish dastagi (iOS sheet drag handle) */}
          <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-0.5 h-1 w-10 rounded-full bg-white/30" />

          {/* O'ng yuqori burchakdagi [X] yopish tugmasi */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={tt('drawingClose')}
              title={tt('drawingClose')}
              className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all ml-auto"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* 1-qator: Asboblar (Qalam, marker, chizg'ich, shakllar) */}
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

      {/* 2-qator: Ranglar va chiziq qalinligi */}
      <div className="flex flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
        <div role="group" aria-label={tt('drawingColors')} className="flex gap-2">
          {COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onColorChange(item.value)}
              aria-label={tt(item.key)}
              aria-pressed={color === item.value}
              className={`grid size-11 place-items-center rounded-xl bg-white/10 transition-transform active:scale-95 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${
                color === item.value ? 'ring-2 ring-pprimary ring-offset-2 ring-offset-slate-900 bg-white/20' : ''
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
              className={`grid size-11 place-items-center rounded-xl bg-white/10 text-white transition-transform active:scale-95 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary ${
                width === item.value ? 'ring-2 ring-pprimary ring-offset-2 ring-offset-slate-900 bg-white/20 text-pprimary' : 'text-white/80'
              }`}
            >
              <span className="block w-5 rounded-full bg-current" style={{ height: item.value }} />
            </button>
          ))}
        </div>
      </div>

      {/* 3-qator: Tahrirlash amallari (Bekor qilish/Qaytarish/Tozalash/Ko'z) va qo'shimchalar (Formulalar/Kalkulyator/Qoralama) */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={drawing.undo.length === 0}
            aria-label={tt('drawingUndo')}
            title={tt('drawingUndo')}
            className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-25 active:scale-95 transition-all"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={drawing.redo.length === 0}
            aria-label={tt('drawingRedo')}
            title={tt('drawingRedo')}
            className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-25 active:scale-95 transition-all"
          >
            <Redo2 size={18} />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={drawing.strokes.length === 0}
            aria-label={tt('drawingClear')}
            title={tt('drawingClear')}
            className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-red-500/25 text-red-400 disabled:opacity-25 active:scale-95 transition-all"
          >
            <Trash2 size={18} />
          </button>

          {/* Ko'z tugmasi (yashirish / ko'rsatish) */}
          {!compact && (
            <button
              type="button"
              onClick={onToggleVisibility}
              aria-label={tt(visible ? 'toolEyeHide' : 'toolEyeShow')}
              title={tt(visible ? 'toolEyeHide' : 'toolEyeShow')}
              className={`grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all ${!visible ? 'text-amber-400' : 'text-white'}`}
            >
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          )}
        </div>

        {/* O'ng taraf: Formulalar, Kalkulyator, Qoralama */}
        {!compact && (
          <div className="flex items-center gap-1.5 ml-auto">
            {onFormulas && (
              <button
                type="button"
                onClick={onFormulas}
                aria-label={tt('toolFormulas')}
                title={tt('toolFormulas')}
                className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-pprimary hover:text-white active:scale-95 transition-all"
              >
                <BookOpen size={18} />
              </button>
            )}
            {onCalculator && (
              <button
                type="button"
                onClick={onCalculator}
                aria-label={tt('toolCalculator')}
                title={tt('toolCalculator')}
                className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-pprimary hover:text-white active:scale-95 transition-all"
              >
                <Calculator size={18} />
              </button>
            )}
            {onScratchpad && (
              <button
                type="button"
                onClick={onScratchpad}
                aria-label={tt('drawingScratchpad')}
                className="flex items-center h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 px-3 active:scale-95 transition-all gap-1.5"
              >
                <NotebookPen size={18} />
                <span className="hidden min-[410px]:inline text-xs font-semibold">{tt('drawingScratchpad')}</span>
              </button>
            )}
          </div>
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
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[28px] bg-slate-900 text-white backdrop-blur-2xl px-4 pt-2.5 pb-[calc(1rem+var(--safe-bottom,0px))] shadow-[0_-16px_48px_rgba(0,0,0,0.5)] border-t border-slate-700/80 ring-1 ring-black/40 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">
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
      <Sheet open={isScratchpadOpen} onClose={() => setScratchpadOpen(false)} zIndex={70} className="max-w-2xl overflow-hidden" dragHandleOnly>
        <SheetHeader><SheetTitle>{tt('drawingScratchpadTitle')}</SheetTitle></SheetHeader>
        <SheetClose onClose={() => setScratchpadOpen(false)} label={tt('drawingScratchpadClose')} />
        <SheetBody className="space-y-3 px-3 pb-3">
          <div className="scratchpad-canvas-paper relative h-[52dvh] min-h-[300px] overflow-hidden rounded-2xl border-2 border-slate-300/90 dark:border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.07),inset_0_2px_6px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:ring-white/10">
            {/* Vizual ajratuvchi qoralama nishoni */}
            <div className="pointer-events-none absolute top-2.5 left-3 z-10 select-none flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-2xs backdrop-blur-xs">
              <span className="text-xs">📐</span>
              <span>{tt('drawingScratchpad')}</span>
            </div>
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
          <div className="rounded-2xl bg-slate-900 text-white p-3 shadow-xl border border-slate-700/80">
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
