/**
 * Token + opacity modifier GUARD (2026-10-19).
 *
 * NEGA: `tailwind.config.js` dagi `--p-*` / `--theme-*` tokenlari HEX yoki
 * rgba() qiymat — Tailwind esa opacity modifier'ni faqat kanal triplet bilan
 * hisoblay oladi. Shu sababli `dark:bg-background/90` kabi klass JIMGINA
 * hech narsa qilmaydi va element OLDINGI (ko'pincha LIGHT) rangda qolib ketadi.
 *
 * Real hodisa: `/sharhlar` header'i dark rejimda `bg-[#f4f5f9]/90` (light) da
 * qolib, sahifa tepasi "oqarib" turardi.
 *
 * To'g'ri yozilish:
 *   dark:bg-[rgb(var(--p-canvas-rgb)/0.9)]
 *   bg-[rgb(var(--p-primary-rgb)/0.12)]
 *   yoki opacity'siz: bg-pcard · text-pfg · border-pline
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

/** var() ga bog'langan tokenlar — bularga `/NN` qo'shish TAQIQLANGAN */
const VAR_TOKENS = [
  'background', 'foreground', 'border', 'input', 'ring',
  'card', 'popover', 'primary', 'secondary', 'destructive',
  'canvas', 'surface', 'elevated', 'fg', 'muted', 'subtle',
  'line', 'lineStrong', 'shadow',
  'pcanvas', 'psurface', 'pcard', 'pline', 'plineStrong',
  'pfg', 'pmuted', 'psubtle', 'pdisabled', 'pprimary', 'ponprimary',
  'pwash', 'psuccess', 'pwarning', 'pdanger', 'ppurple', 'pblue',
  'pgold', 'pgolddeep', 'pongold',
]

const UTILITY = '(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|divide|decoration)'
const PATTERN = new RegExp(`\\b${UTILITY}-(?:${VAR_TOKENS.join('|')})/\\d{1,3}\\b`, 'g')

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__snapshots__' || entry.name === 'node_modules') continue
      walk(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

/** Izohlar olib tashlanadi — `button.tsx` dagi tushuntirish kabi holatlar uchun */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('design token + opacity modifier', () => {
  it('manba kodda `<token>/NN` ishlatilmaydi (opacity jimgina yo\'qoladi)', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const code = stripComments(fs.readFileSync(file, 'utf8'))
      const hits = code.match(PATTERN)
      if (hits) {
        offenders.push(`${path.relative(SRC, file)} → ${[...new Set(hits)].join(', ')}`)
      }
    }
    expect(offenders, `Token + opacity topildi:\n${offenders.join('\n')}`).toEqual([])
  })

  it('reviews header dark foni triplet orqali beriladi (regressiya)', () => {
    const page = fs.readFileSync(path.join(SRC, 'features/reviews/ReviewsPage.tsx'), 'utf8')
    expect(page).toContain('dark:bg-[rgb(var(--p-canvas-rgb)/0.9)]')
    expect(page).not.toContain('dark:bg-background/90')
  })
})
