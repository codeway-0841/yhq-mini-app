/**
 * Math Board — Faza 2 model testlari: factories, segmentatsiya, merge, turn.
 */
import { describe, it, expect } from 'vitest'
import {
  createTypedBlock, createDrawBlock, toBlockGrading,
} from '../../../src/features/math-board/lib/board-model'
import {
  segmentStrokes, segmentKey, mergeBlockShells,
} from '../../../src/features/math-board/lib/block-segmentation'
import { createTurn, appendTurn, MAX_TURNS } from '../../../src/features/math-board/lib/board-revisions'
import type { DrawingStroke } from '../../../src/features/test'

function stroke(y0: number, y1: number, x0 = 0.1, x1 = 0.5): DrawingStroke {
  return {
    tool: 'pen', color: '#111827', width: 4, opacity: 1,
    points: [{ x: x0, y: y0 }, { x: x1, y: y1 }],
  }
}

describe('board-model factories', () => {
  it('typed block: confirmed + equation + strokes[]', () => {
    const b = createTypedBlock({ id: 't1', order: 1001, latex: 'x=4', ascii: 'x=4', status: 'correct' })
    expect(b.source).toBe('user')
    expect(b.type).toBe('equation')
    expect(b.strokeIds).toEqual([])
    expect(b.recognition.state).toBe('confirmed')
    expect(b.grading.status).toBe('correct')
  })

  it('draw block: unrecognized + pending', () => {
    const b = createDrawBlock({
      id: 'b1', order: 0, strokeIds: ['s0'], rect: { x: 0, y: 0, width: 1, height: 0.2 },
    })
    expect(b.recognition.state).toBe('unrecognized')
    expect(b.grading.status).toBe('pending')
    expect(b.latex).toBeNull()
  })

  it('toBlockGrading 1:1 map', () => {
    expect(toBlockGrading('uncertain')).toBe('uncertain')
    expect(toBlockGrading('domain_error')).toBe('domain_error')
  })
})

describe('segmentStrokes', () => {
  it("bo'sh → []", () => {
    expect(segmentStrokes([])).toEqual([])
  })

  it('bitta qator → 1 blok', () => {
    const segs = segmentStrokes([stroke(0.1, 0.15), stroke(0.12, 0.18, 0.5, 0.8)])
    expect(segs).toHaveLength(1)
    expect(segs[0].strokeIndexes).toEqual([0, 1])
  })

  it('ikki qator → 2 blok (y-tartibda)', () => {
    const segs = segmentStrokes([stroke(0.5, 0.55), stroke(0.1, 0.15)])
    expect(segs).toHaveLength(2)
    // Yuqoridagi birinchi (y kichik)
    expect(segs[0].strokeIndexes).toEqual([1])
    expect(segs[1].strokeIndexes).toEqual([0])
  })

  it('rect 0..1 ichida + raqamlangan tartib', () => {
    const segs = segmentStrokes([stroke(0.1, 0.2), stroke(0.6, 0.9)])
    for (const s of segs) {
      expect(s.rect.x).toBeGreaterThanOrEqual(0)
      expect(s.rect.y).toBeGreaterThanOrEqual(0)
      expect(s.rect.width).toBeLessThanOrEqual(1)
      expect(s.rect.height).toBeLessThanOrEqual(1)
    }
  })

  it('segmentKey stabil', () => {
    expect(segmentKey([0, 1])).toBe('0,1')
  })
})

describe('mergeBlockShells', () => {
  const seg = (idx: number[]) => ({
    strokeIndexes: idx,
    rect: { x: 0, y: 0, width: 1, height: 0.2 },
  })

  it("bo'sh prev → hamma yangi (changed)", () => {
    const { blocks, changed } = mergeBlockShells([], [seg([0]), seg([1])], 0, 1000)
    expect(changed).toBe(true)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].recognition.state).toBe('unrecognized')
  })

  it('bir xil to‘plam → eski saqlanadi (recognition bilan)', () => {
    const rect = { x: 0.08, y: 0.08, width: 0.44, height: 0.09 }
    const { blocks: first } = mergeBlockShells([], [{ strokeIndexes: [0], rect }], 0, 1000)
    const reviewed = { ...first[0], recognition: { ...first[0].recognition, state: 'needs_review' as const } }
    const second = mergeBlockShells([reviewed], [{ strokeIndexes: [0], rect }], 0, 2000)
    expect(second.changed).toBe(false)
    expect(second.blocks[0]).toBe(reviewed)
  })

  it('typed bloklar teginmaydi', () => {
    const typed = createTypedBlock({ id: 't1', order: 1001, latex: 'x', ascii: 'x', status: 'correct' })
    const { blocks } = mergeBlockShells([typed], [seg([0])], 0, 1000)
    expect(blocks).toContain(typed)
    expect(blocks).toHaveLength(2)
  })

  it('yo‘qolgan segment o‘chadi', () => {
    const old = createDrawBlock({ id: 'b:0:0', order: 0, strokeIds: ['s0'], rect: { x: 0, y: 0, width: 1, height: 0.2 } })
    const { blocks, changed } = mergeBlockShells([old], [], 0, 1000)
    expect(changed).toBe(true)
    expect(blocks).toHaveLength(0)
  })
})

describe('board-revisions turns', () => {
  it('createTurn maydonlari', () => {
    const t = createTurn({
      problemId: 'log-1', sessionRevision: 1, userInkRevision: 2,
      recognitionRevision: 0, acceptedStepIds: [1], changedBlockIds: ['b:0:0'],
    })
    expect(t.problemId).toBe('log-1')
    expect(t.acceptedStepIds).toEqual([1])
    expect(t.id.length).toBeGreaterThan(0)
  })

  it(`appendTurn cap ${MAX_TURNS}`, () => {
    let log = Array.from({ length: MAX_TURNS }, (_, i) => createTurn({
      problemId: 'p', sessionRevision: 0, userInkRevision: i,
      recognitionRevision: 0, acceptedStepIds: [], changedBlockIds: [],
    }))
    log = appendTurn(log, createTurn({
      problemId: 'p', sessionRevision: 0, userInkRevision: 999,
      recognitionRevision: 0, acceptedStepIds: [], changedBlockIds: [],
    }))
    expect(log).toHaveLength(MAX_TURNS)
    expect(log[log.length - 1].userInkRevision).toBe(999)
  })
})
