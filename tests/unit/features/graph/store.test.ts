import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphStore } from '../../../../src/features/graph/useGraphStore'

beforeEach(() => {
  useGraphStore.getState().reset()
})

describe('grafik: store — lab nuqtalari va payload', () => {
  it('points payloadga kiradi va loadWorkspace qaytaradi', () => {
    const s = useGraphStore.getState()
    s.addPoint({ x: 1, y: 2 })
    s.addPoint({ x: 2, y: 4.1 })
    const payload = s.toPayload()
    expect(payload.points).toHaveLength(2)
    expect(payload.points?.[1]).toEqual({ x: 2, y: 4.1 })

    useGraphStore.getState().loadWorkspace(payload, { id: 'g1', title: 'Lab' })
    expect(useGraphStore.getState().points).toHaveLength(2)
  })

  it('undo/redo points o‘zgarishini qaytaradi', () => {
    const s = useGraphStore.getState()
    s.snapshot()
    s.addPoint({ x: 1, y: 1 })
    expect(useGraphStore.getState().points).toHaveLength(1)

    useGraphStore.getState().undo()
    expect(useGraphStore.getState().points).toHaveLength(0)

    useGraphStore.getState().redo()
    expect(useGraphStore.getState().points).toHaveLength(1)
  })

  it('eski payload (analysis/points yo‘q) default bilan yuklanadi', () => {
    useGraphStore.getState().loadWorkspace({
      expressions: [{ expr: 'sin(x)', colorIdx: 0, visible: true }],
      xVar: 'x',
      vars: {},
      viewport: { cx: 0, cy: 0, unitsPerPx: 0.05 },
    }, null)
    const a = useGraphStore.getState().analysis
    expect(a.secant).toBe(false)
    expect(a.h).toBe(1)
    expect(a.markers).toBe(false)
    expect(useGraphStore.getState().points).toEqual([])
  })

  it('updatePoint/removePoint/clearPoints ishlaydi', () => {
    const s = useGraphStore.getState()
    s.addPoint({ x: 0, y: 0 })
    s.addPoint({ x: 1, y: 1 })
    useGraphStore.getState().updatePoint(0, { y: 9 })
    expect(useGraphStore.getState().points[0]).toEqual({ x: 0, y: 9 })
    useGraphStore.getState().removePoint(0)
    expect(useGraphStore.getState().points).toEqual([{ x: 1, y: 1 }])
    useGraphStore.getState().clearPoints()
    expect(useGraphStore.getState().points).toEqual([])
  })
})
