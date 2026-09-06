import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDrawingSession, clearStrokes, commitStroke, drawingStorageKey, emptyDrawing,
  loadDrawingSession, redoDrawing, saveDrawingSession, undoDrawing,
  type DrawingStroke,
} from '../../../src/features/test/components/drawing-model'

const stroke: DrawingStroke = {
  tool: 'pen', color: '#111827', width: 5, opacity: 1,
  points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }],
}

beforeEach(() => localStorage.clear())

describe('drawing model', () => {
  it('supports bounded snapshot undo, redo and clear', () => {
    const drawing = emptyDrawing()
    commitStroke(drawing, stroke)
    expect(drawing.strokes).toEqual([stroke])
    undoDrawing(drawing)
    expect(drawing.strokes).toEqual([])
    redoDrawing(drawing)
    expect(drawing.strokes).toEqual([stroke])
    clearStrokes(drawing)
    expect(drawing.strokes).toEqual([])
    undoDrawing(drawing)
    expect(drawing.strokes).toEqual([stroke])
  })

  it('persists only valid normalized drawing data', () => {
    const drawing = emptyDrawing()
    commitStroke(drawing, stroke)
    saveDrawingSession('abc', new Map([['question:42', drawing]]))
    expect(loadDrawingSession('abc').get('question:42')?.strokes).toEqual([stroke])
  })

  it('ignores corrupt or out-of-range local data and clears safely', () => {
    localStorage.setItem(drawingStorageKey('abc'), JSON.stringify({
      version: 2,
      surfaces: {
        'question:1': [{ ...stroke, points: [{ x: 99, y: 0.2 }] }],
        '__proto__': [stroke],
      },
    }))
    expect(loadDrawingSession('abc').size).toBe(0)
    expect(() => clearDrawingSession('abc')).not.toThrow()
    expect(localStorage.getItem(drawingStorageKey('abc'))).toBeNull()
  })
})
