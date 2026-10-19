import { describe, expect, it } from 'vitest'
import {
  extractOutline,
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
})
