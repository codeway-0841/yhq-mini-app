/**
 * Math Board — stroke segmentatsiya (Faza 2/4).
 *
 * Y-coordinate clustering: qatorlar vertikal bo'shliq bilan ajraladi.
 * Stroke'lar drawing-model'da id'siz (0..1 normalized points) — segment
 * stroke INDEX to'plami bilan identifikatsiyalanadi (commit append, undo pop,
 * clear — prefikslar stabil). Merge paytida bir xil index-to'plam eski
 * blokni saqlaydi (recognition natijasi yo'qolmaydi).
 */

import type { BoardRect, MathBlock } from './board-model'
import { createDrawBlock } from './board-model'
import type { DrawingStroke } from '../../test'

export interface StrokeSegment {
  /** Stroke indexlari (drawing order bo'yicha) */
  strokeIndexes: number[]
  rect: BoardRect
}

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function strokeBBox(s: DrawingStroke): BBox | null {
  if (s.points.length === 0) return null
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of s.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Qator oralig'i chegarasi: median balandlikning 0.8x yoki 0.05 (kattasi) */
function gapThreshold(heights: number[]): number {
  if (heights.length === 0) return 0.05
  const sorted = [...heights].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return Math.max(0.05, median * 0.8)
}

const PAD = 0.02

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * Stroke'larni y-bo'shliq bo'yicha bloklarga ajratadi (y o'sishi tartibida).
 * Bo'sh/nuqta-siz stroke'lar tashlanadi.
 */
export function segmentStrokes(strokes: DrawingStroke[]): StrokeSegment[] {
  const indexed: { index: number; box: BBox }[] = []
  for (let i = 0; i < strokes.length; i++) {
    const box = strokeBBox(strokes[i])
    if (box) indexed.push({ index: i, box })
  }
  if (indexed.length === 0) return []

  indexed.sort((a, b) => a.box.minY - b.box.minY || a.box.minX - b.box.minX)
  const threshold = gapThreshold(indexed.map((s) => s.box.maxY - s.box.minY))

  const groups: typeof indexed[] = []
  for (const item of indexed) {
    const last = groups[groups.length - 1]
    if (!last) {
      groups.push([item])
      continue
    }
    const lastMaxY = Math.max(...last.map((s) => s.box.maxY))
    if (item.box.minY - lastMaxY > threshold) groups.push([item])
    else last.push(item)
  }

  return groups.map((g) => {
    const minX = Math.min(...g.map((s) => s.box.minX))
    const minY = Math.min(...g.map((s) => s.box.minY))
    const maxX = Math.max(...g.map((s) => s.box.maxX))
    const maxY = Math.max(...g.map((s) => s.box.maxY))
    return {
      strokeIndexes: g.map((s) => s.index).sort((a, b) => a - b),
      rect: {
        x: clamp01(minX - PAD),
        y: clamp01(minY - PAD),
        width: clamp01(maxX - minX + PAD * 2),
        height: clamp01(maxY - minY + PAD * 2),
      },
    }
  })
}

/** Index-to'plam kaliti (merge taqqoslash uchun) */
export function segmentKey(indexes: number[]): string {
  return indexes.join(',')
}

/**
 * Segmentlar → bloklar merge (sof funksiya).
 * Bir xil stroke-to'plam eski blokni SAQLAYDI (recognition/latex/gradding
 * bilan); yangi segment → yangi blok; yo'qolgan segment → o'chadi.
 * Faqat chizma bloklar (`strokeIds` bor) merge'lanadi — typed bloklar
 * teginmasdan saqlanadi.
 */
export function mergeBlockShells(
  previous: MathBlock[],
  segments: StrokeSegment[],
  sessionRevision: number,
  now: number,
): { blocks: MathBlock[]; changed: boolean } {
  const prevDraw = new Map<string, MathBlock>()
  const typed: MathBlock[] = []
  for (const b of previous) {
    if (b.strokeIds.length > 0) prevDraw.set(segmentKey(strokeIdsToIndexes(b.strokeIds)), b)
    else typed.push(b)
  }
  const next: MathBlock[] = [...typed]
  // O'chirilgan chizma blok bormi? (typed'lar strukturaga kirmaydi)
  const segKeys = new Set(segments.map((s) => segmentKey(s.strokeIndexes)))
  let changed = [...prevDraw.keys()].some((k) => !segKeys.has(k))
  segments.forEach((seg, order) => {
    const key = segmentKey(seg.strokeIndexes)
    const kept = prevDraw.get(key)
    if (kept) {
      const moved = kept.order !== order
        || kept.rect?.x !== seg.rect.x || kept.rect?.y !== seg.rect.y
        || kept.rect?.width !== seg.rect.width || kept.rect?.height !== seg.rect.height
      if (moved) {
        changed = true
        next.push({ ...kept, order, rect: seg.rect, updatedAt: now })
      } else {
        next.push(kept)
      }
    } else {
      changed = true
      // id'da order YO'Q (yuqoriga qator qo'shilsa id stabil qoladi)
      next.push(createDrawBlock({
        id: `b:${sessionRevision}:${key}`,
        order,
        strokeIds: seg.strokeIndexes.map((i) => `s${i}`),
        rect: seg.rect,
        now,
      }))
    }
  })
  next.sort((a, b) => a.order - b.order || (a.createdAt - b.createdAt))
  return { blocks: next, changed }
}

/** `s12` → 12 (merge taqqoslash uchun) */
function strokeIdsToIndexes(ids: string[]): number[] {
  const out: number[] = []
  for (const id of ids) {
    const m = /^s(\d+)$/.exec(id)
    if (m) out.push(Number(m[1]))
  }
  return out.sort((a, b) => a - b)
}