import { describe, expect, it } from 'vitest'
import {
  buildLessonPages,
  extractDiscoveryChallenge,
  extractOutline,
  extractSectionBlocks,
  parseInline,
  parseMarkdown,
  plainText,
} from '../../../src/features/darslik-rustili/markdown'

describe('markdown parser', () => {
  it('sarlavhalarni daraja bo‘yicha ajratadi va 4 dan chuqurini kesadi', () => {
    const blocks = parseMarkdown('# Bir\n\n## Ikki\n\n### Uch\n\n##### Besh')
    expect(blocks.map((b) => (b.kind === 'heading' ? b.level : b.kind))).toEqual([1, 2, 3, 4])
  })

  it('paragrafdagi satr uzilishlarini saqlaydi (ikki probel = yumshoq uzilish)', () => {
    const blocks = parseMarkdown('Birinchi satr  \nIkkinchi satr\n\nta keyingi paragraf')
    expect(blocks).toHaveLength(2)
    const [first, second] = blocks
    expect(first.kind).toBe('paragraph')
    if (first.kind !== 'paragraph') throw new Error('unreachable')
    expect(first.lines).toEqual(['Birinchi satr  ', 'Ikkinchi satr'])
    if (second.kind !== 'paragraph') throw new Error('unreachable')
    expect(second.lines).toEqual(['ta keyingi paragraf'])
  })

  it('belgili ro‘yxatni va checkbox bandini o‘qiydi', () => {
    const blocks = parseMarkdown('- birinchi\n- [x] bajarilgan\n- [ ] bajarilmagan')
    expect(blocks).toHaveLength(1)
    const list = blocks[0]
    if (list.kind !== 'list') throw new Error('unreachable')
    expect(list.ordered).toBe(false)
    expect(list.items).toEqual([
      { text: 'birinchi' },
      { text: 'bajarilgan', checked: true },
      { text: 'bajarilmagan', checked: false },
    ])
  })

  it('raqamli ro‘yxatni alohida tur sifatida o‘qiydi', () => {
    const blocks = parseMarkdown('1. birinchi\n2. ikkinchi')
    const list = blocks[0]
    if (list.kind !== 'list') throw new Error('unreachable')
    expect(list.ordered).toBe(true)
    expect(list.items.map((i) => i.text)).toEqual(['birinchi', 'ikkinchi'])
  })

  it('iqtiboslarni birlashtiradi', () => {
    const blocks = parseMarkdown('> birinchi\n> ikkinchi\n\ntext')
    const quote = blocks[0]
    if (quote.kind !== 'quote') throw new Error('unreachable')
    expect(quote.lines).toEqual(['birinchi', 'ikkinchi'])
    expect(blocks[1].kind).toBe('paragraph')
  })

  it('jadvalni sarlavha va qatorlarga ajratadi', () => {
    const blocks = parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')
    const table = blocks[0]
    if (table.kind !== 'table') throw new Error('unreachable')
    expect(table.head).toEqual(['A', 'B'])
    expect(table.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('ajratgichni (---) divider deb biladi, ro‘yxat emas', () => {
    const blocks = parseMarkdown('matn\n\n---\n\nkeyingi')
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'divider', 'paragraph'])
  })

  it('ro‘yxatdan keyin kelgan paragrafni alohida blok qiladi', () => {
    const blocks = parseMarkdown('- band\n\nOddiy paragraf')
    expect(blocks.map((b) => b.kind)).toEqual(['list', 'paragraph'])
  })
})

describe('inline formatlash', () => {
  it('qalin, kursiv va kodni ajratadi', () => {
    const parts = parseInline('Bu **qalin** va *kursiv* va `kod` matn')
    expect(parts.filter((p) => p.bold).map((p) => p.text)).toEqual(['qalin'])
    expect(parts.filter((p) => p.italic).map((p) => p.text)).toEqual(['kursiv'])
    expect(parts.filter((p) => p.code).map((p) => p.text)).toEqual(['kod'])
    expect(parts.map((p) => p.text).join('')).toBe('Bu qalin va kursiv va kod matn')
  })

  it('plainText belgilarni olib tashlab, bo‘shliqlarni normalizatsiya qiladi', () => {
    expect(plainText('  **A**   *b*  ')).toBe('A b')
  })

  it('satrlar orasida davom etadigan qalin matnni ham taniydi', () => {
    const parts = parseInline('**birinchi qator\nikkinchi qator**')
    expect(parts).toHaveLength(1)
    expect(parts[0].bold).toBe(true)
    expect(parts[0].text).toBe('birinchi qator\nikkinchi qator')
  })
})

describe('mundarija va hajm', () => {
  it('faqat 1–2 darajali sarlavhalarni mundarijaga oladi', () => {
    const blocks = parseMarkdown('# Bir\n\n### Uch\n\n## Ikki')
    const outline = extractOutline(blocks)
    expect(outline.map((o) => o.title)).toEqual(['Bir', 'Ikki'])
    expect(outline[0].anchor).toBe('md-h-0')
    expect(outline[1].anchor).toBe('md-h-2')
  })

  it('reader uchun faqat tanlangan mavzu bloklarini ajratadi', () => {
    const blocks = parseMarkdown('# 1. Birinchi\n\nBirinchi izoh\n\n### Misol\n\nA\n\n# 2. Ikkinchi\n\nIkkinchi izoh')
    const first = extractSectionBlocks(blocks, 0)
    const second = extractSectionBlocks(blocks, 1)

    expect(first.some((block) => block.kind === 'paragraph' && block.lines.includes('Ikkinchi izoh'))).toBe(false)
    expect(second.some((block) => block.kind === 'paragraph' && block.lines.includes('Ikkinchi izoh'))).toBe(true)
  })

  it('markdown ichidagi eski mini-test va javob kalitini readerdan kesadi', () => {
    const blocks = parseMarkdown('# 1. Mavzu\n\nNazariya\n\n## 🎯 Мини-тест для закрепления\n\nSavol\n\n**Ответы:** 1 — A')
    const section = extractSectionBlocks(blocks, 0)

    expect(section.some((block) => block.kind === 'heading' && block.text.includes('Мини-тест'))).toBe(false)
    expect(section.some((block) => block.kind === 'paragraph' && block.lines.join(' ').includes('Ответы'))).toBe(false)
  })

  it('nazariyani mobil mikro-kartalarga bo‘ladi', () => {
    const blocks = parseMarkdown('# 1. Mavzu\n\n### Bir\n\nA\n\nB\n\nC\n\nD\n\n### Ikki\n\nE')
    const pages = buildLessonPages(extractSectionBlocks(blocks, 0), 3)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((page) => page.length <= 3)).toBe(true)
  })

  it('kirish satrini («Например:») keyingi misoldan ajratib yolg‘iz qoldirmaydi', () => {
    const blocks = parseMarkdown('# 1. Mavzu\n\nA\n\nB\n\nC\n\nНапример:\n\n**дом** — 3 буквы и 3 звука.')
    const pages = buildLessonPages(extractSectionBlocks(blocks, 0), 4)

    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(3)
    expect(pages[1]).toHaveLength(2)
    expect(plainText(pages[1][0].kind === 'paragraph' ? pages[1][0].lines[0] : '')).toBe('Например:')
  })

  it('dars bo‘limidan Try (Sinab ko‘r) kashfiyot savolini ajratadi', () => {
    const mismatch = parseMarkdown('# 1. Звуки\n\n- **ёлка** — 4 буквы, 5 звуков.')
    const ch = extractDiscoveryChallenge(mismatch)
    expect(ch).not.toBeNull()
    expect(ch?.options).toContain('5')
    expect(ch?.options[ch.correctIdx]).toBe('5')

    const quoteOnly = parseMarkdown('# 1. Звуки\n\n> буква ≠ звук.')
    const ch2 = extractDiscoveryChallenge(quoteOnly)
    expect(ch2?.options[ch2.correctIdx]).toBe('буква ≠ звук')

    const plainOnly = parseMarkdown('# 1. Matn\n\nOddiy ta’rif.')
    expect(extractDiscoveryChallenge(plainOnly)).toBeNull()
  })
})
