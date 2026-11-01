import { describe, expect, it } from 'vitest'
import {
  RUSADABIYOT_BLOCKS,
  RUSADABIYOT_BLOCK_COUNT,
  RUSADABIYOT_BLOCK_STATS,
  RUSADABIYOT_PROGRESS_MODULE_OFFSET,
  getRusadabiyotBlockOutline,
  getRusadabiyotBlock,
  loadRusadabiyotBlock,
} from '../../../src/content/darslik-rusadabiyot'
import {
  extractOutline,
  parseMarkdown,
} from '../../../src/features/darslik-rustili/markdown'

describe('rus adabiyoti darsligi — meta', () => {
  it('9 ta xronologik blok, id 1..9 ketma-ket va takrorlanmas', () => {
    expect(RUSADABIYOT_BLOCK_COUNT).toBe(9)
    expect(RUSADABIYOT_BLOCKS).toHaveLength(9)
    expect(RUSADABIYOT_BLOCKS.map((b) => b.id)).toEqual(Array.from({ length: 9 }, (_, i) => i + 1))
  })

  it('har bir blokda UZ/RU sarlavha, tavsif va ikonka bor', () => {
    for (const block of RUSADABIYOT_BLOCKS) {
      expect(block.titleUz.trim().length).toBeGreaterThan(3)
      expect(block.titleRu.trim().length).toBeGreaterThan(3)
      expect(block.summaryUz.trim().length).toBeGreaterThan(10)
      expect(block.summaryRu.trim().length).toBeGreaterThan(10)
      expect(block.icon.length).toBeGreaterThan(0)
    }
  })

  it('progress modul id’lari to‘qnashmaydi', () => {
    const ids = RUSADABIYOT_BLOCKS.map((b) => RUSADABIYOT_PROGRESS_MODULE_OFFSET + b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getRusadabiyotBlock mavjud bo‘lmagan id uchun undefined qaytaradi', () => {
    expect(getRusadabiyotBlock(1)?.id).toBe(1)
    expect(getRusadabiyotBlock(99)).toBeUndefined()
  })
})

describe('rus adabiyoti darsligi — blok matnlari', () => {
  for (const block of RUSADABIYOT_BLOCKS) {
    it(`${block.id}-blok: matn yuklanadi va markdown buzilmagan`, async () => {
      const source = await loadRusadabiyotBlock(block.id)
      expect(source.length).toBeGreaterThan(1500)

      for (const marker of ['{@body', '{#each', '{/each', '<radio', '<button', 'DIL.']) {
        expect(source).not.toContain(marker)
      }

      const blocks = parseMarkdown(source)
      expect(blocks.length).toBeGreaterThan(20)

      const outline = extractOutline(blocks)
      expect(outline.length).toBe(RUSADABIYOT_BLOCK_STATS[block.id].sections)

      expect(getRusadabiyotBlockOutline(block.id)).toEqual(outline.map((entry) => entry.title))
    })
  }
})
