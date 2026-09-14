/**
 * Viewport — world ↔ screen koordinata aylanishlari va "chiroyli" grid
 * qadamlari. Teng masshtab (square aspect): X va Y bir xil unitsPerPx.
 *
 * Model: viewport markazi (cx, cy) world'da, masshtab unitsPerPx.
 * Ekran X: sx = (x - cx) / upp + w/2;  Ekran Y: sy = h/2 - (y - cy) / upp.
 */
import type { GraphViewport } from '../../../../../shared/contracts/graph'

export const MIN_UNITS_PER_PX = 1e-6
export const MAX_UNITS_PER_PX = 1e6

/** Boshlang'ich ko'rinish: ~20 birlik kenglik (400px ekran uchun) */
export const DEFAULT_VIEWPORT: GraphViewport = { cx: 0, cy: 0, unitsPerPx: 0.05 }

export function clampViewport(vp: GraphViewport): GraphViewport {
  const upp = Math.min(MAX_UNITS_PER_PX, Math.max(MIN_UNITS_PER_PX, vp.unitsPerPx))
  return { cx: vp.cx, cy: vp.cy, unitsPerPx: upp }
}

export function worldWidth(vp: GraphViewport, width: number): number {
  return width * vp.unitsPerPx
}

export function worldHeight(vp: GraphViewport, height: number): number {
  return height * vp.unitsPerPx
}

export function xMinOf(vp: GraphViewport, width: number): number {
  return vp.cx - worldWidth(vp, width) / 2
}

export function yMinOf(vp: GraphViewport, height: number): number {
  return vp.cy - worldHeight(vp, height) / 2
}

export function xToScreen(vp: GraphViewport, x: number, width: number): number {
  return (x - vp.cx) / vp.unitsPerPx + width / 2
}

export function yToScreen(vp: GraphViewport, y: number, height: number): number {
  return height / 2 - (y - vp.cy) / vp.unitsPerPx
}

export function screenToWorldX(vp: GraphViewport, sx: number, width: number): number {
  return vp.cx + (sx - width / 2) * vp.unitsPerPx
}

export function screenToWorldY(vp: GraphViewport, sy: number, height: number): number {
  return vp.cy - (sy - height / 2) * vp.unitsPerPx
}

/** Pan: barmoq/harakat pikselga teskari yo'nalishda viewport markazini suradi. */
export function panViewport(vp: GraphViewport, dxPx: number, dyPx: number): GraphViewport {
  return clampViewport({
    cx: vp.cx - dxPx * vp.unitsPerPx,
    cy: vp.cy + dyPx * vp.unitsPerPx,
    unitsPerPx: vp.unitsPerPx,
  })
}

/**
 * Zoom: `anchorSx/anchorSy` ostidagi world nuqta QIMIRLAMAYDI (pinch/wheel
 * markazi saqlanadi).
 * @param scale > 1 — yaqinlashtirish (unitsPerPx kamayadi)
 */
export function zoomViewport(
  vp: GraphViewport,
  anchorSx: number,
  anchorSy: number,
  scale: number,
  width: number,
  height: number,
): GraphViewport {
  const nextUpp = Math.min(MAX_UNITS_PER_PX, Math.max(MIN_UNITS_PER_PX, vp.unitsPerPx / scale))
  const wx = screenToWorldX(vp, anchorSx, width)
  const wy = screenToWorldY(vp, anchorSy, height)
  return clampViewport({
    cx: wx - (anchorSx - width / 2) * nextUpp,
    cy: wy + (anchorSy - height / 2) * nextUpp,
    unitsPerPx: nextUpp,
  })
}

export interface Ticks {
  step: number
  values: number[]
  decimals: number
}

/**
 * "1 / 2 / 5 × 10ⁿ" qadamlari — grid chiziqlari soni targetCount atrofida
 * bo'ladigan eng yaqin qadam tanlanadi.
 */
export function niceTicks(min: number, max: number, targetCount = 6): Ticks {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { step: 1, values: [], decimals: 0 }
  }
  const raw = (max - min) / Math.max(1, targetCount)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const mult = norm >= 5 ? 5 : norm >= 2 ? 2 : 1
  const step = mult * magnitude
  const decimals = Math.max(0, Math.min(8, -Math.floor(Math.log10(step))))
  const first = Math.ceil(min / step - 1e-9) * step
  const values: number[] = []
  for (let v = first; v <= max + step * 1e-9; v += step) {
    values.push(Number(v.toFixed(decimals)))
  }
  return { step, values, decimals }
}

/** Trace label uchun: masshtabga mos aniqlikda son matni */
export function formatWorldValue(value: number, unitsPerPx: number): string {
  if (!Number.isFinite(value)) return '—'
  const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(unitsPerPx))))
  const rounded = Number(value.toFixed(decimals))
  return String(rounded)
}
