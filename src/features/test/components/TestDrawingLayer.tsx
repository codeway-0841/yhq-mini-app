import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Eraser, Hand, Highlighter, PenLine, Redo2, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '../../../shared/components/ui/button'
import { useT, type Lang } from '../../../shared/i18n'

type DrawingTool = 'hand' | 'pen-black' | 'pen-red' | 'marker' | 'eraser'
type StrokeTool = Exclude<DrawingTool, 'hand'>

interface Point {
  x: number
  y: number
}

interface Stroke {
  tool: StrokeTool
  points: Point[]
}

type HistoryAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'clear'; strokes: Stroke[] }

interface QuestionDrawing {
  strokes: Stroke[]
  undo: HistoryAction[]
  redo: HistoryAction[]
}

interface TestDrawingLayerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionKey: string
  language: Lang
  raised?: boolean
}

const EMPTY_DRAWING = (): QuestionDrawing => ({ strokes: [], undo: [], redo: [] })
const MAX_DEVICE_PIXEL_RATIO = 2

function strokeStyle(tool: StrokeTool) {
  switch (tool) {
    case 'pen-red': return { color: '#ef4444', width: 4, composite: 'source-over' as const }
    case 'marker': return { color: 'rgba(250, 204, 21, 0.38)', width: 18, composite: 'source-over' as const }
    case 'eraser': return { color: '#000000', width: 28, composite: 'destination-out' as const }
    default: return { color: '#111827', width: 4, composite: 'source-over' as const }
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const style = strokeStyle(stroke.tool)
  const points = stroke.points
  if (points.length === 0) return

  ctx.save()
  ctx.globalCompositeOperation = style.composite
  ctx.strokeStyle = style.color
  ctx.fillStyle = style.color
  ctx.lineWidth = style.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, style.width / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }
  ctx.restore()
}

export default function TestDrawingLayer({
  open,
  onOpenChange,
  questionKey,
  language,
  raised = false,
}: TestDrawingLayerProps) {
  const tt = useT(language)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingsRef = useRef(new Map<string, QuestionDrawing>())
  const activeStrokeRef = useRef<Stroke | null>(null)
  const sizeRef = useRef({ width: 1, height: 1, ratio: 1 })
  const [tool, setTool] = useState<DrawingTool>('pen-black')
  const [, setRevision] = useState(0)

  const currentDrawing = useCallback(() => {
    let drawing = drawingsRef.current.get(questionKey)
    if (!drawing) {
      drawing = EMPTY_DRAWING()
      drawingsRef.current.set(questionKey, drawing)
    }
    return drawing
  }, [questionKey])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { width, height, ratio } = sizeRef.current
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    for (const stroke of currentDrawing().strokes) drawStroke(ctx, stroke)
  }, [currentDrawing])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || canvas.parentElement?.clientWidth || 1))
    const height = Math.max(1, Math.round(rect.height || canvas.parentElement?.clientHeight || 1))
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    sizeRef.current = { width, height, ratio }
    redraw()
  }, [redraw])

  useLayoutEffect(() => {
    if (!open) return
    resizeCanvas()
  }, [open, questionKey, resizeCanvas])

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const resizeObserver = typeof ResizeObserver === 'undefined' || !canvas?.parentElement
      ? null
      : new ResizeObserver(resizeCanvas)
    if (canvas?.parentElement) resizeObserver?.observe(canvas.parentElement)
    window.addEventListener('resize', resizeCanvas)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [open, resizeCanvas])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onOpenChange])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'hand' || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const stroke: Stroke = { tool, points: [pointFromEvent(event)] }
    activeStrokeRef.current = stroke
    const ctx = event.currentTarget.getContext('2d')
    if (ctx) drawStroke(ctx, stroke)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    event.preventDefault()
    const nativeEvent = event.nativeEvent
    const coalesced = typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [nativeEvent]
    const rect = event.currentTarget.getBoundingClientRect()
    const previous = stroke.points[stroke.points.length - 1]
    const nextPoints = coalesced.map((point) => ({ x: point.clientX - rect.left, y: point.clientY - rect.top }))
    stroke.points.push(...nextPoints)
    const ctx = event.currentTarget.getContext('2d')
    if (ctx) drawStroke(ctx, { tool: stroke.tool, points: [previous, ...nextPoints] })
  }

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    activeStrokeRef.current = null
    const drawing = currentDrawing()
    drawing.strokes.push(stroke)
    drawing.undo.push({ type: 'add', stroke })
    drawing.redo = []
    setRevision((value) => value + 1)
  }

  const undo = () => {
    const drawing = currentDrawing()
    const action = drawing.undo.pop()
    if (!action) return
    if (action.type === 'add') drawing.strokes.pop()
    else drawing.strokes = [...action.strokes]
    drawing.redo.push(action)
    setRevision((value) => value + 1)
    redraw()
  }

  const redo = () => {
    const drawing = currentDrawing()
    const action = drawing.redo.pop()
    if (!action) return
    if (action.type === 'add') drawing.strokes.push(action.stroke)
    else drawing.strokes = []
    drawing.undo.push(action)
    setRevision((value) => value + 1)
    redraw()
  }

  const clear = () => {
    const drawing = currentDrawing()
    if (drawing.strokes.length === 0) return
    const action: HistoryAction = { type: 'clear', strokes: [...drawing.strokes] }
    drawing.strokes = []
    drawing.undo.push(action)
    drawing.redo = []
    setRevision((value) => value + 1)
    redraw()
  }

  const drawing = currentDrawing()
  const toolButton = (value: DrawingTool, label: string, icon: React.ReactNode, className = '') => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTool(value)}
      aria-label={label}
      title={label}
      aria-pressed={tool === value}
      className={`bg-pcard ${tool === value ? 'ring-2 ring-pprimary ring-offset-1 ring-offset-pcard' : ''} ${className}`}
    >
      {icon}
    </Button>
  )

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

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label={tt('drawingCanvas')}
        className={`absolute inset-0 z-[35] h-full w-full ${tool === 'hand' ? 'pointer-events-none' : 'cursor-crosshair'}`}
        style={{ touchAction: tool === 'hand' ? 'auto' : 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />

      <div
        role="toolbar"
        aria-label={tt('drawingTools')}
        className="fixed bottom-[calc(1rem+var(--safe-bottom,0px))] right-4 z-50 grid grid-cols-5 gap-2 rounded-2xl bg-pcard p-2 shadow-2xl"
      >
        {toolButton('hand', tt('drawingHand'), <Hand />)}
        {toolButton('pen-black', tt('drawingBlackPen'), <PenLine />, 'text-pfg')}
        {toolButton('pen-red', tt('drawingRedPen'), <PenLine />, 'text-pdanger')}
        {toolButton('marker', tt('drawingMarker'), <Highlighter />, 'text-pwarning')}
        {toolButton('eraser', tt('drawingEraser'), <Eraser />)}
        <Button type="button" variant="ghost" size="icon" onClick={undo} disabled={drawing.undo.length === 0} aria-label={tt('drawingUndo')} title={tt('drawingUndo')} className="bg-pcard"><Undo2 /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={redo} disabled={drawing.redo.length === 0} aria-label={tt('drawingRedo')} title={tt('drawingRedo')} className="bg-pcard"><Redo2 /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={clear} disabled={drawing.strokes.length === 0} aria-label={tt('drawingClear')} title={tt('drawingClear')} className="bg-pcard text-pdanger"><Trash2 /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label={tt('drawingClose')} title={tt('drawingClose')} className="col-start-5 bg-pcard"><X /></Button>
      </div>
    </>
  )
}
