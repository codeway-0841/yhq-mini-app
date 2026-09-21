/**
 * Math Board — chizma bloklari sync hook (Faza 2).
 *
 * Stroke'lar → segmentlar → store'dagi bloklar. `changed=false` bo'lsa
 * setBlocks chaqirilmaydi (render loop yo'q). Recognition holati store'da
 * yashaydi — bu hook faqat struktura (yaratish/yangilash/o'chirish) bilan
 * shug'ullanadi. Qaytaradi: joriy masala bloklari.
 */

import { useEffect, useMemo } from 'react'
import { mergeBlockShells, segmentStrokes } from '../lib/block-segmentation'
import { useBoardSession } from './useBoardSession'
import type { DrawingStroke } from '../../test'
import type { MathBlock } from '../lib/board-model'

/** Segment imzosi (effect trigger — strukturaviy o'zgarishnigina) */
function segmentsSignature(strokes: DrawingStroke[]): string {
  return JSON.stringify(segmentStrokes(strokes).map((s) => ({
    k: s.strokeIndexes.join(','),
    r: [s.rect.x, s.rect.y, s.rect.width, s.rect.height].map((v) => v.toFixed(3)).join(','),
  })))
}

export function useBoardBlocks(problemId: string, strokes: DrawingStroke[]): MathBlock[] {
  const sessionRevision = useBoardSession((s) => s.sessionRevision)
  const stored = useBoardSession((s) => s.blocksByProblem[problemId] ?? [])
  const setBlocks = useBoardSession((s) => s.setBlocks)
  const sig = useMemo(() => segmentsSignature(strokes), [strokes])

  useEffect(() => {
    const segments = segmentStrokes(strokes)
    const prev = useBoardSession.getState().blocksByProblem[problemId] ?? []
    const { blocks, changed } = mergeBlockShells(prev, segments, sessionRevision, Date.now())
    if (changed) setBlocks(problemId, blocks)
  }, [sig, problemId, sessionRevision, setBlocks, strokes])

  return stored
}
