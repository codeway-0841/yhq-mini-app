/**
 * Rus tili darsligi — mavzularni ketma-ket ochish qoidalari.
 *
 * Har bir mavzu faqat oldingi mavzu testdan o'tilgach ochiladi. Bu modul
 * React'dan mustaqil: learning path ham, o'quvchi ham, testlar ham bir xil
 * qoidadan foydalanadi.
 */
import { DARSLIK_BLOCKS, getBlockOutline } from '../../content/darslik-rustili'

export interface DarslikSectionRef {
  blockId: number
  /** Blok ichidagi mavzu indeksi (0-based) */
  idx: number
}

/** Barcha mavzularning global tartibi (bloklar va mavzular bo'yicha). */
export const DARSLIK_SECTION_ORDER: readonly DarslikSectionRef[] = DARSLIK_BLOCKS.flatMap((block) =>
  getBlockOutline(block.id).map((_, idx) => ({ blockId: block.id, idx })),
)

const SECTION_POSITION = new Map<string, number>(
  DARSLIK_SECTION_ORDER.map((ref, position) => [sectionKey(ref.blockId, ref.idx), position]),
)

export function sectionKey(blockId: number, idx: number): string {
  return blockId + ':' + idx
}

/** Progress store'idagi moduleId → blok id'iga o'tish. */
export function moduleIdForBlock(blockId: number, offset: number): number {
  return offset + blockId
}

/** Oldingi mavzu (global tartibda) yoki null (birinchi mavzu). */
export function previousSection(blockId: number, idx: number): DarslikSectionRef | null {
  const position = SECTION_POSITION.get(sectionKey(blockId, idx))
  if (position == null || position === 0) return null
  return DARSLIK_SECTION_ORDER[position - 1] ?? null
}

/** Keyingi mavzu (global tartibda) yoki null (oxirgi mavzu). */
export function nextSection(blockId: number, idx: number): DarslikSectionRef | null {
  const position = SECTION_POSITION.get(sectionKey(blockId, idx))
  if (position == null) return null
  return DARSLIK_SECTION_ORDER[position + 1] ?? null
}

/**
 * Mavzu ochiqmi?
 *
 * - birinchi mavzu har doim ochiq;
 * - oldingi BARCHA mavzular testdan o'tilgan bo'lsa — ochiq;
 * - mavzuning o'zi avval o'tilgan bo'lsa — takrorlash uchun ochiq.
 *
 * passed — sectionKey ko'rinishidagi o'tilgan mavzular to'plami.
 */
export function isSectionUnlocked(
  blockId: number,
  idx: number,
  passed: ReadonlySet<string>,
): boolean {
  const topicId = sectionKey(blockId, idx)
  if (passed.has(topicId)) return true
  const position = SECTION_POSITION.get(topicId)
  if (position == null) return false
  // Server ham xuddi shunday: oldingi BARCHA mavzular o'tilgan bo'lishi shart.
  for (let index = 0; index < position; index++) {
    const previous = DARSLIK_SECTION_ORDER[index]
    if (!passed.has(sectionKey(previous.blockId, previous.idx))) return false
  }
  return true
}

/** Blok ichidagi qulflangan mavzular indekslari. */
export function lockedSectionsInBlock(
  blockId: number,
  passed: ReadonlySet<string>,
): number[] {
  return getBlockOutline(blockId)
    .map((_, idx) => idx)
    .filter((idx) => !isSectionUnlocked(blockId, idx, passed))
}

/** Store'dagi byUser[userId] progressini global passed to'plamiga aylantiradi. */
export function passedSetFromProgress(
  progress: Record<number, number[]> | undefined,
  offset: number,
): Set<string> {
  const passed = new Set<string>()
  if (!progress) return passed
  for (const block of DARSLIK_BLOCKS) {
    const done = progress[offset + block.id] ?? []
    for (const idx of done) {
      if (Number.isInteger(idx) && idx >= 0 && idx < getBlockOutline(block.id).length) {
        passed.add(sectionKey(block.id, idx))
      }
    }
  }
  return passed
}

/** Blokning birinchi o'tilmagan mavzusi (yoki oxirgi mavzu). */
export function firstUnpassedSection(
  blockId: number,
  passed: ReadonlySet<string>,
): number {
  const outline = getBlockOutline(blockId)
  const idx = outline.findIndex((_, index) => !passed.has(sectionKey(blockId, index)))
  return idx < 0 ? Math.max(0, outline.length - 1) : idx
}
