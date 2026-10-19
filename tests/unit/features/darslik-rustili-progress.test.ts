import { describe, expect, it } from 'vitest'
import {
  DARSLIK_PROGRESS_MODULE_OFFSET,
  getBlockOutline,
} from '../../../src/content/darslik-rustili'
import {
  DARSLIK_SECTION_ORDER,
  firstUnpassedSection,
  isSectionUnlocked,
  lockedSectionsInBlock,
  moduleIdForBlock,
  nextSection,
  passedSetFromProgress,
  previousSection,
  sectionKey,
} from '../../../src/features/darslik-rustili/progress'

describe('rus tili darsligi — ketma-ket ochilish', () => {
  it('birinchi mavzu har doim ochiq, keyingisi yopiq', () => {
    expect(isSectionUnlocked(1, 0, new Set())).toBe(true)
    expect(isSectionUnlocked(1, 1, new Set())).toBe(false)
    expect(isSectionUnlocked(2, 0, new Set())).toBe(false)
  })

  it('oldingi mavzu testdan o‘tilgach keyingisi ochiladi', () => {
    const passed = new Set<string>()
    passed.add(sectionKey(1, 0))
    expect(isSectionUnlocked(1, 1, passed)).toBe(true)
    expect(isSectionUnlocked(1, 2, passed)).toBe(false)

    passed.add(sectionKey(1, 1))
    expect(isSectionUnlocked(1, 2, passed)).toBe(true)
  })

  it('bloklar orasida ham ketma-ketlik saqlanadi', () => {
    const passed = new Set<string>()
    const firstBlock = getBlockOutline(1)
    for (let idx = 0; idx < firstBlock.length; idx++) passed.add(sectionKey(1, idx))

    expect(isSectionUnlocked(2, 0, passed)).toBe(true)
    expect(isSectionUnlocked(2, 1, passed)).toBe(false)
    expect(isSectionUnlocked(3, 0, passed)).toBe(false)
  })

  it('avval o‘tilgan mavzu takrorlash uchun ochiq qoladi', () => {
    const passed = new Set<string>()
    for (const ref of DARSLIK_SECTION_ORDER) {
      if (ref.blockId < 2 || (ref.blockId === 2 && ref.idx <= 3)) passed.add(sectionKey(ref.blockId, ref.idx))
    }
    expect(isSectionUnlocked(2, 3, passed)).toBe(true)
    expect(isSectionUnlocked(2, 4, passed)).toBe(true)
    expect(isSectionUnlocked(2, 5, passed)).toBe(false)

    // Faqat shu mavzu o'tilgan bo'lsa ham takrorlash uchun ochiq, keyingisi yo'q.
    const onlyCurrent = new Set<string>([sectionKey(2, 3)])
    expect(isSectionUnlocked(2, 3, onlyCurrent)).toBe(true)
    expect(isSectionUnlocked(2, 4, onlyCurrent)).toBe(false)
  })

  it('previousSection / nextSection global tartibda ishlaydi', () => {
    expect(previousSection(1, 0)).toBeNull()
    expect(previousSection(1, 1)).toEqual({ blockId: 1, idx: 0 })
    expect(nextSection(1, getBlockOutline(1).length - 1)).toEqual({ blockId: 2, idx: 0 })
    expect(nextSection(DARSLIK_SECTION_ORDER.at(-1)!.blockId, DARSLIK_SECTION_ORDER.at(-1)!.idx)).toBeNull()
  })

  it('lockedSectionsInBlock faqat birinchi mavzuni ochiq qoldiradi', () => {
    const locked = lockedSectionsInBlock(1, new Set())
    expect(locked).toEqual(getBlockOutline(1).map((_, idx) => idx).filter((idx) => idx !== 0))
  })

  it('passedSetFromProgress moduleId ofsetini hisobga oladi va noto‘g‘ri indekslarni tashlaydi', () => {
    const passed = passedSetFromProgress({
      [moduleIdForBlock(1, DARSLIK_PROGRESS_MODULE_OFFSET)]: [0, 1, 999, -1],
      999: [0],
    }, DARSLIK_PROGRESS_MODULE_OFFSET)

    expect([...passed].sort()).toEqual(['1:0', '1:1'])
  })

  it('firstUnpassedSection birinchi o‘tilmagan mavzuni qaytaradi', () => {
    const passed = new Set<string>([sectionKey(1, 0), sectionKey(1, 2)])
    expect(firstUnpassedSection(1, passed)).toBe(1)
  })

  it('barcha mavzular o‘tilganda oxirgi mavzuni qaytaradi', () => {
    const passed = new Set<string>()
    for (const ref of DARSLIK_SECTION_ORDER) {
      if (ref.blockId === 1) passed.add(sectionKey(ref.blockId, ref.idx))
    }
    expect(firstUnpassedSection(1, passed)).toBe(getBlockOutline(1).length - 1)
  })
})
