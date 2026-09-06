import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { DrawingHistory, DrawingPoint, DrawingStroke, DrawingTool } from './drawing-model'
import { commitStroke, simplifyPoints } from './drawing-model'

interface DrawingCanvasProps {
  drawing: DrawingHistory
  tool: DrawingTool
  color: string
  width: number
  label: string
  className?: string
  onCommit: () => void
}

const MAX_DEVICE_PIXEL_RATIO = 2
const FREEHAND_TOOLS = new Set<DrawingTool>(['pen', 'marker', 'eraser'])

function canvasPoint(point: DrawingPoint, width: number, height: number) {
  return { x: point.x * width, y: point.y * height }
}

function drawArrowHead(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, width: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const length = Math.max(10, width * 3.5)
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6))
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, canvasWidth: number, canvasHeight: number) {
  if (stroke.points.length === 0) return
  const points = stroke.points.map((point) => canvasPoint(point, canvasWidth, canvasHeight))
  const first = points[0]
  const last = points[points.length - 1]

  ctx.save()
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.globalAlpha = stroke.opacity
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()

  if (stroke.tool === 'rectangle') {
    ctx.rect(first.x, first.y, last.x - first.x, last.y - first.y)
    ctx.stroke()
  } else if (stroke.tool === 'ellipse') {
    ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (stroke.tool === 'line' || stroke.tool === 'arrow') {
    ctx.moveTo(first.x, first.y)
    ctx.lineTo(last.x, last.y)
    if (stroke.tool === 'arrow') drawArrowHead(ctx, first, last, stroke.width)
    ctx.stroke()
  } else if (points.length === 1) {
    ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.moveTo(first.x, first.y)
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y)
    ctx.stroke()
  }
  ctx.restore()
}

export default function DrawingCanvas({ drawing, tool, color, width, label, className = '', onCommit }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeStrokeRef = useRef<DrawingStroke | null>(null)
  const frameRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 1, height: 1, ratio: 1 })

  const redraw = useCallback((preview?: DrawingStroke) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const size = sizeRef.current
    ctx.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    for (const stroke of drawing.strokes) drawStroke(ctx, stroke, size.width, size.height)
    if (preview) drawStroke(ctx, preview, size.width, size.height)
  }, [drawing])

  const scheduleRedraw = useCallback((preview: DrawingStroke) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      redraw(preview)
    })
  }, [redraw])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cssWidth = Math.max(1, Math.round(rect.width || canvas.parentElement?.clientWidth || 1))
    const cssHeight = Math.max(1, Math.round(rect.height || canvas.parentElement?.clientHeight || 1))
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
    sizeRef.current = { width: cssWidth, height: cssHeight, ratio }
    redraw()
  }, [redraw])

  useLayoutEffect(resize, [resize])

  useEffect(() => {
    const parent = canvasRef.current?.parentElement
    const observer = typeof ResizeObserver === 'undefined' || !parent ? null : new ResizeObserver(resize)
    if (parent) observer?.observe(parent)
    window.addEventListener('resize', resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [resize])

  useEffect(() => { redraw() }, [drawing.strokes, redraw])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'hand' || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    activeStrokeRef.current = {
      tool,
      color: tool === 'eraser' ? '#111827' : color,
      width: tool === 'eraser' ? Math.max(22, width * 4) : tool === 'marker' ? Math.max(14, width * 3) : width,
      opacity: tool === 'marker' ? 0.32 : 1,
      points: [pointFromEvent(event)],
    }
    scheduleRedraw(activeStrokeRef.current)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    event.preventDefault()
    if (FREEHAND_TOOLS.has(stroke.tool)) {
      const rect = event.currentTarget.getBoundingClientRect()
      const events = typeof event.nativeEvent.getCoalescedEvents === 'function'
        ? event.nativeEvent.getCoalescedEvents()
        : [event.nativeEvent]
      for (const point of events) {
        const next = {
          x: Math.min(1, Math.max(0, (point.clientX - rect.left) / Math.max(1, rect.width))),
          y: Math.min(1, Math.max(0, (point.clientY - rect.top) / Math.max(1, rect.height))),
        }
        const previous = stroke.points[stroke.points.length - 1]
        if (Math.hypot(next.x - previous.x, next.y - previous.y) > 0.001) stroke.points.push(next)
      }
    } else {
      stroke.points[1] = pointFromEvent(event)
    }
    scheduleRedraw(stroke)
  }

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    activeStrokeRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (stroke.points.length === 1 && !FREEHAND_TOOLS.has(stroke.tool)) stroke.points.push(stroke.points[0])
    stroke.points = simplifyPoints(stroke.points)
    commitStroke(drawing, stroke)
    redraw()
    onCommit()
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      className={`h-full w-full ${tool === 'hand' ? 'pointer-events-none' : 'cursor-crosshair'} ${className}`}
      style={{ touchAction: tool === 'hand' ? 'auto' : 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    />
  )
}
