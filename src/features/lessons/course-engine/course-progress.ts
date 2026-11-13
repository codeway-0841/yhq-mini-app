import type { CourseBlockMeta } from './types'

export interface CourseSectionRef {
  blockId: number
  idx: number
}

export function courseSectionKey(blockId: number, idx: number): string {
  return `${blockId}:${idx}`
}

/** Barcha bloklar bo'ylab global ketma-ketlikni tekshirib keyingi bo'limni qaytaradi. */
export function getNextCourseSection(
  blocks: readonly CourseBlockMeta[],
  blockId: number,
  idx: number,
): CourseSectionRef | null {
  const blockIdx = blocks.findIndex((b) => b.id === blockId)
  if (blockIdx < 0) return null
  const currentBlock = blocks[blockIdx]
  if (idx + 1 < currentBlock.sections.length) {
    return { blockId: currentBlock.id, idx: idx + 1 }
  }
  for (let b = blockIdx + 1; b < blocks.length; b++) {
    if (blocks[b].sections.length > 0) {
      return { blockId: blocks[b].id, idx: 0 }
    }
  }
  return null
}

/** Blok ichidagi qulflangan bo'lim indekslari (`lockSequential=false` bo'lsa bo'sh). */
export function getLockedSectionIndices(
  blocks: readonly CourseBlockMeta[],
  blockId: number,
  passed: ReadonlySet<string>,
  lockSequential: boolean,
): number[] {
  const target = blocks.find((b) => b.id === blockId)
  if (!target) return []
  if (!lockSequential) return []

  const targetBlockIndex = blocks.findIndex((b) => b.id === blockId)
  let priorUnlocked = true
  for (let b = 0; b < targetBlockIndex; b++) {
    const block = blocks[b]
    for (let s = 0; s < block.sections.length; s++) {
      if (!passed.has(courseSectionKey(block.id, s))) {
        priorUnlocked = false
        break
      }
    }
    if (!priorUnlocked) break
  }

  const locked: number[] = []
  let chainOpen = priorUnlocked
  for (let idx = 0; idx < target.sections.length; idx++) {
    const key = courseSectionKey(blockId, idx)
    const isDone = passed.has(key)
    if (!isDone && !chainOpen) {
      locked.push(idx)
    }
    if (!isDone) {
      chainOpen = false
    }
  }
  return locked
}
