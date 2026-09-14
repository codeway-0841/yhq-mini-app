import { describe, it, expect } from 'vitest'
import {
  DEFAULT_VIEWPORT,
  niceTicks,
  panViewport,
  screenToWorldX,
  screenToWorldY,
  worldHeight,
  worldWidth,
  xToScreen,
  yToScreen,
  zoomViewport,
  formatWorldValue,
} from '../../../../src/features/graph/lib/plot/viewport'
import { sampleCurve } from '../../../../src/features/graph/lib/plot/sample'
import { compileExpression } from '../../../../src/features/graph/lib/math'

const W = 100
const H = 100

function sample(expr: string, viewport = DEFAULT_VIEWPORT, scope: Record<string, number> = {}) {
  const { fn } = compileExpression(expr)
  return sampleCurve(fn, { width: W, height: H, viewport, xVar: 'x', scope })
}

describe('grafik: viewport', () => {
  it('world ↔ screen round-trip', () => {
    const vp = { cx: 2, cy: -1, unitsPerPx: 0.1 }
    for (const x of [-3, 0, 2, 7]) {
      expect(screenToWorldX(vp, xToScreen(vp, x, W), W)).toBeCloseTo(x, 10)
    }
    for (const y of [-4, -1, 0, 5]) {
      expect(screenToWorldY(vp, yToScreen(vp, y, H), H)).toBeCloseTo(y, 10)
    }
  })

  it('markaz ko‘rinish ortida: cx=0 ekran markazida', () => {
    expect(xToScreen(DEFAULT_VIEWPORT, 0, W)).toBe(W / 2)
    expect(yToScreen(DEFAULT_VIEWPORT, 0, H)).toBe(H / 2)
  })

  it('teng masshtab: worldWidth/height unitsPerPx ga mos', () => {
    expect(worldWidth(DEFAULT_VIEWPORT, W)).toBeCloseTo(W * DEFAULT_VIEWPORT.unitsPerPx, 10)
    expect(worldHeight(DEFAULT_VIEWPORT, H)).toBeCloseTo(H * DEFAULT_VIEWPORT.unitsPerPx, 10)
  })

  it('pan: markaz teskari yo‘nalishda siljiydi', () => {
    const vp = panViewport(DEFAULT_VIEWPORT, 10, -5)
    expect(vp.cx).toBeCloseTo(-10 * DEFAULT_VIEWPORT.unitsPerPx, 10)
    expect(vp.cy).toBeCloseTo(-5 * DEFAULT_VIEWPORT.unitsPerPx, 10)
  })

  it('zoom: anchor ostidagi world nuqta qimirlamaydi', () => {
    const vp = { cx: 1, cy: 2, unitsPerPx: 0.05 }
    const anchorX = 20
    const anchorY = 70
    const beforeX = screenToWorldX(vp, anchorX, W)
    const beforeY = screenToWorldY(vp, anchorY, H)
    const zoomed = zoomViewport(vp, anchorX, anchorY, 2.5, W, H)
    expect(screenToWorldX(zoomed, anchorX, W)).toBeCloseTo(beforeX, 8)
    expect(screenToWorldY(zoomed, anchorY, H)).toBeCloseTo(beforeY, 8)
    expect(zoomed.unitsPerPx).toBeCloseTo(vp.unitsPerPx / 2.5, 12)
  })

  it('niceTicks: 1/2/5 qadamlari', () => {
    const t = niceTicks(0, 10, 5)
    expect(t.step).toBe(2)
    expect(t.values).toEqual([0, 2, 4, 6, 8, 10])
    expect(t.decimals).toBe(0)

    const small = niceTicks(0, 1, 5)
    expect(small.step).toBeCloseTo(0.2, 10)
    expect(small.decimals).toBe(1)

    const big = niceTicks(-1000, 1000, 4)
    expect(big.step).toBe(500)
    expect(big.values[0]).toBe(-1000)
  })

  it('formatWorldValue masshtabga mos aniqlik beradi', () => {
    expect(formatWorldValue(1.23456, 0.05)).toBe('1.23')
    expect(formatWorldValue(1234.5, 10)).toBe('1235')
    expect(formatWorldValue(NaN, 0.05)).toBe('—')
  })
})

describe('grafik: sampling', () => {
  it('sin(x) — yagona uzluksiz segment', () => {
    const { segments } = sample('sin(x)')
    expect(segments).toHaveLength(1)
    expect(segments[0].points.length).toBeGreaterThanOrEqual(W)
  })

  it('1/x — asimptotada uziladi (kamida 2 segment)', () => {
    const { segments } = sample('1/x')
    expect(segments.length).toBeGreaterThanOrEqual(2)
  })

  it('tan(x) — uzilishlar segmentlarga bo‘linadi', () => {
    const { segments } = sample('tan(x)')
    expect(segments.length).toBeGreaterThanOrEqual(3)
  })

  it("sqrt(x) — x<0 da nuqta yo'q, faqat o'ng yarim", () => {
    const vp = { cx: 0, cy: 0, unitsPerPx: 0.05 }
    const { segments } = sample('sqrt(x)', vp)
    expect(segments.length).toBeGreaterThanOrEqual(1)
    for (const seg of segments) {
      for (const p of seg.points) {
        expect(p.x).toBeGreaterThanOrEqual(W / 2 - 1)
      }
    }
  })

  it('keskin funksiyada rekursiv ikkilantirish nuqtalarni qo‘shadi', () => {
    const smooth = sample('sin(x)')
    const steep = sample('1000*x')
    const smoothCount = smooth.segments.reduce((n, s) => n + s.points.length, 0)
    const steepCount = steep.segments.reduce((n, s) => n + s.points.length, 0)
    expect(steepCount).toBeGreaterThan(smoothCount)
  })

  it('slayder qiymatlari scope orqali uzatiladi', () => {
    const { segments } = sample('a*sin(x)', DEFAULT_VIEWPORT, { a: 2 })
    expect(segments).toHaveLength(1)
    const maxAbs = Math.max(...segments[0].points.map((p) => Math.abs(p.y - H / 2)))
    expect(maxAbs).toBeGreaterThan(0)
  })
})
