/**
 * Rus tili darsligi uchun minimal markdown parser.
 *
 * Ataylab kutubxonasiz: bloklar faqat cheklangan sintaksisdan foydalanadi
 * (sarlavhalar, paragraflar, ro'yxatlar, iqtiboslar, jadvallar, ajratgichlar,
 * **qalin** va *kursiv* matn). Parser sof funksiya — testlanadi.
 */

export type MdInline = { text: string; bold?: boolean; italic?: boolean; code?: boolean }

export type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: MdListItem[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'divider' }

export interface MdListItem {
  text: string
  /** `- [ ]` / `- [x]` belgilari */
  checked?: boolean
}

export interface MdOutlineEntry {
  /** MarkdownView'dagi sarlavha elementi id'si */
  anchor: string
  title: string
  level: 1 | 2
}

// Diqqat: `**` juftligi satrlar orasida ham davom etishi mumkin (konspektlarda
// ko'p qatorli qalin matn bor) — shuning uchun `\n` taqiqlanmaydi.
const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

/** `**qalin**`, `*kursiv*`, `` `kod` `` — oddiy inline bo'laklarga ajratadi. */
export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = []
  const push = (chunk: string, style: Omit<MdInline, 'text'>) => {
    if (!chunk) return
    out.push({ text: chunk, ...style })
  }
  let last = 0
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const token = match[0]
    const start = match.index ?? 0
    push(text.slice(last, start), {})
    if (token.startsWith('**')) push(token.slice(2, -2), { bold: true })
    else if (token.startsWith('`')) push(token.slice(1, -1), { code: true })
    else push(token.slice(1, -1), { italic: true })
    last = start + token.length
  }
  push(text.slice(last), {})
  return out
}

/** Inline belgilarni olib tashlab, sof matn qaytaradi (TOC/qidiruv uchun). */
export function plainText(text: string): string {
  return parseInline(text)
    .map((part) => part.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const BULLET_RE = /^[-•*]\s+(.*)$/
const CHECKBOX_RE = /^\[([ xX])]\s*(.*)$/
const ORDERED_RE = /^\d+[.)]\s+(.*)$/
const DIVIDER_RE = /^-{3,}\s*$|^\*{3,}\s*$|^_{3,}\s*$/
const SECTION_NUMBER_RE = /^\d{1,2}[.)]\s+/
const EMBEDDED_PRACTICE_RE = /^(?:🎯\s*)?(?:мини[-\s]?тест|mini[-\s]?test|mustahkamlash testi)/i
const TABLE_DIVIDER_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/

function isTableStart(lines: string[], i: number): boolean {
  const line = lines[i]
  const next = lines[i + 1]
  if (!line?.includes('|') || !next) return false
  return TABLE_DIVIDER_RE.test(next.trim()) && next.includes('-')
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/** Markdown matnini render qilinadigan bloklarga ajratadi. */
export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (!line) { i++; continue }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ kind: 'divider' })
      i++
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4
      blocks.push({ kind: 'heading', level, text: heading[2].trim() })
      i++
      continue
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i])
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ kind: 'quote', lines: quoteLines })
      continue
    }

    if (BULLET_RE.test(line) || ORDERED_RE.test(line)) {
      const ordered = ORDERED_RE.test(line) && !BULLET_RE.test(line)
      const items: MdListItem[] = []
      while (i < lines.length) {
        const current = lines[i].trim()
        if (!current) {
          // Ro'yxat ichidagi bo'sh qator — keyingi qator ro'yxat bo'lsa davom etamiz.
          const next = lines[i + 1]?.trim() ?? ''
          const continues = ordered ? ORDERED_RE.test(next) : BULLET_RE.test(next)
          if (!continues) break
          i++
          continue
        }
        const bullet = current.match(BULLET_RE)
        const numbered = current.match(ORDERED_RE)
        if (ordered ? !numbered : !bullet) break
        const body = ordered ? numbered![1] : bullet![1]
        const checkbox = body.match(CHECKBOX_RE)
        if (checkbox) {
          items.push({ text: checkbox[2], checked: checkbox[1].toLowerCase() === 'x' })
        } else {
          items.push({ text: body })
        }
        i++
      }
      if (items.length) blocks.push({ kind: 'list', ordered, items })
      continue
    }

    // Paragraf — bo'sh qatorgacha (satr oxiridagi ikki probel = yumshoq uzilish).
    const paragraphLines: string[] = []
    while (i < lines.length) {
      const current = lines[i]
      const trimmed = current.trim()
      if (!trimmed) break
      if (paragraphLines.length > 0) {
        if (HEADING_RE.test(trimmed) || DIVIDER_RE.test(trimmed)) break
        if (trimmed.startsWith('>')) break
        if (BULLET_RE.test(trimmed) || ORDERED_RE.test(trimmed)) break
        if (isTableStart(lines, i)) break
      }
      paragraphLines.push(current.replace(/\s+$/, (m) => (m.length >= 2 ? '  ' : '')))
      i++
    }
    if (paragraphLines.length) blocks.push({ kind: 'paragraph', lines: paragraphLines })
  }

  return blocks
}

/** O'quvchi uchun mundarija: 1–2 darajali sarlavhalar. */
function outlineCandidates(blocks: MdBlock[]) {
  const candidates: { index: number; level: 1 | 2; text: string }[] = []
  blocks.forEach((block, index) => {
    if (block.kind !== 'heading') return
    if (block.level > 2) return
    const title = plainText(block.text)
    if (!title) return
    candidates.push({ index, level: block.level as 1 | 2, text: title })
  })

  // Bloklarda sarlavha darajalari bir xil emas: ba'zilarda bo'lim `# 1. …`,
  // ba'zilarda `## 1. …`, ichki kichik sarlavhalar esa `## Гласные` kabi
  // raqamsiz bo'lishi mumkin. Mavzu = RAQAMLANGAN sarlavha; agar blokda
  // raqamlangan sarlavha umuman bo'lmasa — barcha 1–2 darajalilar olinadi.
  const numbered = candidates.filter((entry) => SECTION_NUMBER_RE.test(entry.text))
  return numbered.length > 0 ? numbered : candidates
}

export function extractOutline(blocks: MdBlock[]): MdOutlineEntry[] {
  const chosen = outlineCandidates(blocks)

  return chosen.map((entry) => ({
    anchor: `md-h-${entry.index}`,
    // Tartib raqami tugunda/TOC'da alohida ko'rsatiladi — matnda takrorlanmaydi
    title: entry.text.replace(SECTION_NUMBER_RE, '').trim(),
    level: entry.level,
  }))
}

/**
 * Bitta learning-path tuguniga tegishli bloklarni ajratadi.
 * Reader endi butun blokni emas, faqat tanlangan mikro-mavzuni ko'rsatadi.
 * Markdown ichidagi eski mini-testlar server-authoritative mashqni takrorlamasligi
 * va javob kalitini oshkor qilmasligi uchun reader'dan kesiladi.
 */
export function extractSectionBlocks(blocks: MdBlock[], sectionIndex: number): MdBlock[] {
  const sections = outlineCandidates(blocks)
  const current = sections[sectionIndex]
  if (!current) return []
  const end = sections[sectionIndex + 1]?.index ?? blocks.length
  const section = blocks.slice(current.index, end)
  const embeddedPractice = section.findIndex(
    (block) => block.kind === 'heading' && EMBEDDED_PRACTICE_RE.test(plainText(block.text)),
  )
  return embeddedPractice < 0 ? section : section.slice(0, embeddedPractice)
}

/**
 * Nazariyani mobilga mos qisqa kartalarga bo'ladi. Heading keyingi izoh bilan
 * birga qoladi; dividerlar vizual sahifa chegarasi sifatida ishlaydi.
 */
export function buildLessonPages(blocks: MdBlock[], maxBlocks = 4): MdBlock[][] {
  const content = blocks[0]?.kind === 'heading' ? blocks.slice(1) : blocks
  const pages: MdBlock[][] = []
  let page: MdBlock[] = []

  const flush = () => {
    if (!page.length) return
    pages.push(page)
    page = []
  }

  for (const block of content) {
    if (block.kind === 'divider') {
      flush()
      continue
    }
    if (block.kind === 'heading' && page.length >= 2) flush()
    if (page.length >= maxBlocks) flush()
    page.push(block)
  }
  flush()

  // Juda qisqa yoki noodatiy manba ham bo'sh lesson bermasin.
  return pages.length ? pages : [content.length ? content : blocks]
}
