/**
 * Math Board — snapshot helper (Faza 4).
 *
 * jsdom'da canvas 2d-context YO'Q (`canvas` paketi o'rnatilmagan) — helper
 * null qaytaradi. Brauzer/APK'da real PNG. Test muhit cheklovini hujjatlaydi.
 */
import { describe, it, expect } from 'vitest'
import {
  renderStrokesToDataUrl, renderBlockToDataUrl, strokesForBlock, SNAPSHOT_SIZE,
} from '../../../src/features/math-board/lib/snapshot'

describe('renderStrokesToDataUrl', () => {
  it("bo'sh stroke → null (yuboriladigan hech narsa yo'q)", () => {
    expect(renderStrokesToDataUrl([])).toBeNull()
  })

  it('SNAPSHOT_SIZE 512 (kichik hajm byudjeti)', () => {
    expect(SNAPSHOT_SIZE).toBe(512)
  })

  it('jsdom canvas-siz muhitda null (brauzerda PNG)', () => {
    const canvas = document.createElement('canvas')
    const hasCtx = canvas.getContext('2d') !== null
    const r = renderStrokesToDataUrl([
      { tool: 'pen', color: '#111827', width: 4, opacity: 1, points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] },
    ])
    // Muhitga qarab: ctx bo'lsa dataURL, bo'lmasa null — ikkalasi ham kontraktda
    if (hasCtx) expect(r?.startsWith('data:image/png')).toBe(true)
    else expect(r).toBeNull()
  })

  it('renderBlockToDataUrl: bo‘sh/cheksiz → null', () => {
    const rect = { x: 0, y: 0, width: 0.5, height: 0.2 }
    expect(renderBlockToDataUrl([], rect)).toBeNull()
    expect(renderBlockToDataUrl(
      [{ tool: 'pen', color: '#111', width: 4, opacity: 1, points: [{ x: 0.1, y: 0.1 }] }],
      { x: NaN, y: 0, width: 1, height: 1 },
    )).toBeNull()
  })

  it('strokesForBlock: s-prefiks indexlar', () => {
    const mk = (x: number): import('../../../src/features/test').DrawingStroke => ({
      tool: 'pen', color: '#111', width: 4, opacity: 1, points: [{ x, y: x }],
    })
    const got = strokesForBlock([mk(0), mk(1)], ['s1', 's9', 'x'])
    expect(got).toHaveLength(1)
    expect(got[0].points[0].x).toBe(1)
  })
})
