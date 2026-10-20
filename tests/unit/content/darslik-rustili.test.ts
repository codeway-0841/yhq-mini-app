import { describe, expect, it } from 'vitest'
import {
  DARSLIK_BLOCKS,
  DARSLIK_BLOCK_COUNT,
  DARSLIK_BLOCK_STATS,
  DARSLIK_PROGRESS_MODULE_OFFSET,
  DARSLIK_SECTION_COUNT,
  getBlockOutline,
  getDarslikBlock,
  loadDarslikBlock,
} from '../../../src/content/darslik-rustili'
import {
  buildLessonPages,
  extractOutline,
  extractSectionBlocks,
  parseMarkdown,
} from '../../../src/features/darslik-rustili/markdown'

/**
 * Rus tili darsligi kontenti — 15 blok konspekti.
 *
 * Bu testlar kontent bilan UI o'rtasidagi shartnomani ushlaydi: blok matni
 * mavjud, markdown buzilmagan, mundarija bandlari `DARSLIK_BLOCK_STATS` bilan
 * mos (ro'yxat sahifasi matnni yuklamasdan to'g'ri raqam ko'rsatadi).
 */
describe('rus tili darsligi — meta', () => {
  it('15 blok, id 1..15 ketma-ket va takrorlanmas', () => {
    expect(DARSLIK_BLOCK_COUNT).toBe(15)
    expect(DARSLIK_BLOCKS).toHaveLength(15)
    expect(DARSLIK_BLOCKS.map((b) => b.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
  })

  it('har bir blokda UZ/RU sarlavha, tavsif va ikonka bor', () => {
    for (const block of DARSLIK_BLOCKS) {
      expect(block.titleUz.trim().length).toBeGreaterThan(3)
      expect(block.titleRu.trim().length).toBeGreaterThan(3)
      expect(block.summaryUz.trim().length).toBeGreaterThan(10)
      expect(block.summaryRu.trim().length).toBeGreaterThan(10)
      expect(block.icon.length).toBeGreaterThan(0)
    }
  })

  it('progress modul id’lari boshqa darsliklar bilan to‘qnashmaydi', () => {
    const ids = DARSLIK_BLOCKS.map((b) => DARSLIK_PROGRESS_MODULE_OFFSET + b.id)
    expect(new Set(ids).size).toBe(ids.length)
    // YHQ darsligi 1..8, interaktiv darslik 999 — ofset ular bilan kesishmasligi kerak
    for (const id of ids) {
      expect(id).toBeGreaterThan(8)
      expect(id).not.toBe(999)
    }
  })

  it('getDarslikBlock mavjud bo‘lmagan id uchun undefined qaytaradi', () => {
    expect(getDarslikBlock(1)?.id).toBe(1)
    expect(getDarslikBlock(99)).toBeUndefined()
  })
})

describe('rus tili darsligi — blok matnlari', () => {
  for (const block of DARSLIK_BLOCKS) {
    it(`${block.id}-blok: matn yuklanadi va markdown buzilmagan`, async () => {
      const source = await loadDarslikBlock(block.id)
      expect(source.length).toBeGreaterThan(1500)

      // Chat widget qoldiqlari bo'lmasligi kerak
      for (const marker of ['{@body', '{#each', '{/each', '<radio', '<button', 'DIL.']) {
        expect(source).not.toContain(marker)
      }

      const blocks = parseMarkdown(source)
      expect(blocks.length).toBeGreaterThan(20)

      const outline = extractOutline(blocks)
      expect(outline.length).toBeGreaterThan(4)
      expect(outline.length).toBe(DARSLIK_BLOCK_STATS[block.id].sections)

      // `outline.json` (learning path tugunlari) matn bilan sinxron bo'lishi shart
      expect(getBlockOutline(block.id)).toEqual(outline.map((entry) => entry.title))

      // Har bir path tuguni alohida mikro-darsga ajralishi va kamida bitta
      // o'qiladigan sahifa berishi shart.
      for (let sectionIndex = 0; sectionIndex < outline.length; sectionIndex += 1) {
        const sectionBlocks = extractSectionBlocks(blocks, sectionIndex)
        const pages = buildLessonPages(sectionBlocks)
        expect(sectionBlocks.length).toBeGreaterThan(0)
        expect(pages.length).toBeGreaterThan(0)
        expect(pages.every((page) => page.length > 0)).toBe(true)
      }

      // Inline `**` juftliklari balansda bo'lishi kerak (buzilgan belgi = noto'g'ri render)
      const paragraphs = blocks.filter((b) => b.kind === 'paragraph')
      expect(paragraphs.length).toBeGreaterThan(0)
      for (const paragraph of paragraphs) {
        const text = paragraph.lines.join(' ')
        const markers = (text.match(/\*\*/g) ?? []).length
        expect(markers % 2).toBe(0)
      }
    })
  }

  it('45 daqiqadan ortiq o‘qish vaqti yo‘q (ro‘yxat kartasi uchun oqilona)', () => {
    for (const block of DARSLIK_BLOCKS) {
      const minutes = DARSLIK_BLOCK_STATS[block.id].minutes
      expect(minutes).toBeGreaterThan(0)
      expect(minutes).toBeLessThanOrEqual(45)
    }
  })

  it('learning path tugunlari yig‘indisi DARSLIK_SECTION_COUNT bilan mos', () => {
    const sum = DARSLIK_BLOCKS.reduce((total, block) => total + getBlockOutline(block.id).length, 0)
    expect(DARSLIK_SECTION_COUNT).toBe(sum)
    expect(DARSLIK_SECTION_COUNT).toBeGreaterThan(300)
    for (const block of DARSLIK_BLOCKS) {
      expect(getBlockOutline(block.id).length).toBeGreaterThan(0)
      // Path tuguni matni bo'sh bo'lmasligi kerak
      expect(getBlockOutline(block.id).every((title) => title.trim().length > 0)).toBe(true)
    }
  })
})
