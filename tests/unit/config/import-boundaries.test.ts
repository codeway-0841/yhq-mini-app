/**
 * Import-boundary CONSISTENCY testi — konfig desync kabi boundary buzilishlar ham
 * runtime'da emas, testda ushlanadi (ESLint kerak emas).
 *
 * Qoidalar (arxivitektura qatlamlari):
 *  1. `src/shared/**` HECH QACHON `src/features/` yoki `src/content/`ga murojaat qilmaydi
 *     (shared — pastki qatlam; yuqoriga qaram bo'lsa inverted dependency).
 *  2. `src/content/**` — sof statik ma'lumot: HECH QANDAY kod import qilmaydi
 *     (faqat o'z ichidagi .json/.ts).
 *  3. `src/platform/**` faqat `window`/brauzer API'larni o'raydi — features/shared'ga
 *     qaram bo'lmasligi kerak (pastki qatlam).
 *  4. Feature'dan BOSHQA feature'ga import FAQAT maqsad feature'ning `index.ts`
 *     (public API barrel) orqali.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) yield p
  }
}

/** Import specifier → abs path (relative YOKI `@/` alias — vite.config resolve.alias;
 *  alias'siz tekshiruv `@/features/...` buzilishlarni jim o'tkazib yuborardi) */
function resolveSpec(file: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) {
    base = path.resolve(SRC, spec.slice(2))
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(file), spec)
  } else {
    return null
  }
  for (const cand of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'])
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  return null
}

const specRe = /\b(?:from\s+|import\s*\(\s*|import\s+)(['"])((?:\.{1,2}|@)\/[^'"]+)\1/g

function importsOf(file: string): { spec: string; abs: string | null }[] {
  const code = fs.readFileSync(file, 'utf8')
  return [...code.matchAll(specRe)].map((m) => ({
    spec: m[2],
    abs: resolveSpec(file, m[2]),
  }))
}

const inDir = (p: string, seg: string) =>
  p.split(path.sep).join('/').includes(`/src/${seg}/`)

const violations: string[] = []
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/')

// 1) shared/ + platform/ — pastki qatlamlar: features/content'ga qaram bo'lmasligi shart
for (const layer of ['shared', 'platform']) {
  for (const f of walk(path.join(SRC, layer))) {
    for (const imp of importsOf(f)) {
      if (!imp.abs) continue
      if (inDir(imp.abs, 'features') || inDir(imp.abs, 'content'))
        violations.push(`[${layer}→yuqori qatlam] ${rel(f)} → ${imp.spec}`)
    }
  }
}

// 2) content/ — hech qanday kod importi yo'q (faqat ichki fayllar)
for (const f of walk(path.join(SRC, 'content'))) {
  for (const imp of importsOf(f)) {
    if (imp.abs && !inDir(imp.abs, 'content'))
      violations.push(`[content sof emas] ${rel(f)} → ${imp.spec}`)
  }
}

// 3) feature → boshqa feature: FAQAT barrel (index.ts) orqali
for (const f of walk(path.join(SRC, 'features'))) {
  const ownFeature = path.relative(path.join(SRC, 'features'), f).split(path.sep)[0]
  for (const imp of importsOf(f)) {
    if (!imp.abs || !inDir(imp.abs, 'features')) continue
    const targetFeature = path.relative(path.join(SRC, 'features'), imp.abs).split(path.sep)[0]
    if (targetFeature === ownFeature) continue
    const viaBarrel = /[\\/](index\.ts|index\.tsx)$/.test(imp.abs)
    if (!viaBarrel)
      violations.push(`[xfeature] ${rel(f)} → ${imp.spec} (faqat ../${targetFeature} barrel orqali ruxsat)`)
  }
}

describe('import-boundary qoidalari', () => {
  it('hech qanday qatlam buzilishi yo\'q', () => {
    expect(violations, violations.join('\n')).toEqual([])
  })
})
