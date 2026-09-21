/**
 * Math Board — doska snapshot (Faza 4).
 *
 * Gemini'ga yuboriladigan PNG: oq fonda qora chiziqlar, 512px (kichik hajm —
 * sparse chizma odatda 20–80KB). Stroke'lar 0..1 normalized (drawing-model),
 * `drawStroke` (test barrel) bir xil renderer — ekranda ko'ringan = yuborilgan.
 */

import { drawStroke } from '../../test'
import type { DrawingStroke } from '../../test'
import type { BoardRect } from './board-model'

export const SNAPSHOT_SIZE = 512

export function renderStrokesToDataUrl(strokes: DrawingStroke[], size = SNAPSHOT_SIZE): string | null {
  if (typeof document === 'undefined' || strokes.length === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  // jsdom/eski WebView'da getContext THROW qilishi mumkin — kontrakt: null
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  for (const s of strokes) {
    drawStroke(ctx, { ...s, color: '#111827', opacity: 1 }, size, size)
  }
  return canvas.toDataURL('image/png')
}

/**
 * Bitta blok crop (Faza 4): blok rect'i kvadrat snapshot'ga sig'diriladi.
 * Stroke'lar 0..1 normalized — rect nisbatida remap qilinadi.
 * Bo'sh/cheksiz rect → null.
 */
export function renderBlockToDataUrl(
  strokes: DrawingStroke[],
  rect: BoardRect,
  size = SNAPSHOT_SIZE,
): string | null {
  if (typeof document === 'undefined' || strokes.length === 0) return null
  if (!Number.isFinite(rect.x + rect.y + rect.width + rect.height)) return null
  const span = Math.max(rect.width, rect.height)
  if (span <= 0) return null
  const remapped: DrawingStroke[] = strokes.map((s) => ({
    ...s,
    color: '#111827',
    opacity: 1,
    points: s.points.map((p) => ({
      x: (p.x - rect.x) / span,
      y: (p.y - rect.y) / span,
    })),
  }))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  for (const s of remapped) {
    drawStroke(ctx, s, size, size)
  }
  return canvas.toDataURL('image/png')
}

/** Stroke indexlari bo'yicha blok stroke'larini ajratadi (`s12` → 12) */
export function strokesForBlock(strokes: DrawingStroke[], strokeIds: string[]): DrawingStroke[] {
  const out: DrawingStroke[] = []
  for (const id of strokeIds) {
    const m = /^s(\d+)$/.exec(id)
    if (m) {
      const s = strokes[Number(m[1])]
      if (s) out.push(s)
    }
  }
  return out
}
