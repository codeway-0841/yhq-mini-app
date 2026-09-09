#!/usr/bin/env tsx
/**
 * Standalone Comprehensive Audit Script for Matematika Question Bank.
 * Validates all 368 topics, 11,040 questions, and 110,400 texts.
 * Exits with non-zero code on any failure (suitable for CI).
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseMathSegments, renderKaTeXToString } from '../src/shared/components/MathText'

interface BankItem {
  externalId: string
  topicExternalId: string
  questionUz: string
  questionRu: string
  optionsUz: Record<string, string>
  optionsRu: Record<string, string>
  correctAnswer: string
  source: string
  image: string | null
}

interface BankData {
  version: number
  subjectId: string
  bankId: string
  bankName: string
  topics: Array<{ externalId: string; nameUz: string; nameRu: string }>
  items: BankItem[]
}

const ROOT = process.cwd()
const args = process.argv.slice(2)
const fileArgIdx = args.indexOf('--file')
const V2_DEFAULT = path.resolve(ROOT, 'content-banks/matematika/v2/math-print.json')
const CANONICAL_DEFAULT = path.resolve(ROOT, 'content-banks/matematika/math-print.json')

const JSON_PATH = fileArgIdx !== -1 && args[fileArgIdx + 1]
  ? path.resolve(ROOT, args[fileArgIdx + 1])
  : fs.existsSync(V2_DEFAULT) ? V2_DEFAULT : CANONICAL_DEFAULT

const PUBLIC_DIR = path.resolve(ROOT, 'public')

console.log('---------------------------------------------------------')
console.log('  MATEMATIKA TEST BANK — 110,400 MATN TO\'LIQ AUDIT DASTURI ')
console.log(`  Tekshirilayotgan fayl: ${path.relative(ROOT, JSON_PATH)}`)
console.log('---------------------------------------------------------\n')

if (!fs.existsSync(JSON_PATH)) {
  console.error(`❌ Xatolik: ${JSON_PATH} fayli topilmadi!`)
  process.exit(1)
}

// Trap console.warn to detect KaTeX warnings (e.g. "No character metrics for...")
const capturedKatexWarnings: string[] = []
const originalWarn = console.warn
console.warn = (...warnArgs: unknown[]) => {
  const msg = warnArgs.join(' ')
  if (msg.includes('No character metrics') || msg.includes('KaTeX') || msg.includes('strict')) {
    capturedKatexWarnings.push(msg)
  } else {
    originalWarn(...warnArgs)
  }
}

const raw = fs.readFileSync(JSON_PATH, 'utf8')
const bank = JSON.parse(raw) as BankData

const issues: string[] = []
const warnings: string[] = []

// 1. Structure check
console.log('1. Bank strukturasi tekshirilmoqda...')
if (bank.bankId !== 'math_db') issues.push(`Noto'g'ri bankId: ${bank.bankId}`)
if (bank.subjectId !== 'matematika') issues.push(`Noto'g'ri subjectId: ${bank.subjectId}`)
if (bank.topics.length !== 368) issues.push(`Mavzular soni 368 ta bo'lishi kerak, lekin ${bank.topics.length} ta topildi`)
if (bank.items.length !== 11040) issues.push(`Savollar soni 11040 ta bo'lishi kerak, lekin ${bank.items.length} ta topildi`)

// 2. Topic and Question uniqueness & exact 30 questions per topic
console.log('2. Mavzular va savollar ketma-ketligi tekshirilmoqda...')
const topicIds = new Set<string>()
for (const t of bank.topics) {
  if (topicIds.has(t.externalId)) {
    issues.push(`Dublikat mavzu ID: ${t.externalId}`)
  }
  topicIds.add(t.externalId)
}

const questionIds = new Set<string>()
const topicQuestionsCount = new Map<string, number>()

for (const it of bank.items) {
  if (questionIds.has(it.externalId)) {
    issues.push(`Dublikat savol externalId: ${it.externalId}`)
  }
  questionIds.add(it.externalId)

  const count = topicQuestionsCount.get(it.topicExternalId) || 0
  topicQuestionsCount.set(it.topicExternalId, count + 1)
}

for (const t of bank.topics) {
  const count = topicQuestionsCount.get(t.externalId) || 0
  if (count !== 30) {
    issues.push(`Mavzu ${t.externalId} da aynan 30 ta savol bo'lishi shart, lekin ${count} ta mavjud!`)
  }
}

// 3. Options and Answer Keys check
console.log('3. Variantlar va javob kalitlari tekshirilmoqda...')
const validKeys = ['A1', 'A2', 'A3', 'A4']

let duplicateOptionCount = 0
for (const it of bank.items) {
  const keysUz = Object.keys(it.optionsUz)
  const keysRu = Object.keys(it.optionsRu)

  if (keysUz.length !== 4 || !validKeys.every(k => keysUz.includes(k))) {
    issues.push(`${it.externalId}: optionsUz noto'g'ri kalitlarga ega: ${JSON.stringify(keysUz)}`)
  }
  if (keysRu.length !== 4 || !validKeys.every(k => keysRu.includes(k))) {
    issues.push(`${it.externalId}: optionsRu noto'g'ri kalitlarga ega: ${JSON.stringify(keysRu)}`)
  }

  for (const k of validKeys) {
    if (!it.optionsUz[k] || it.optionsUz[k].trim() === '') {
      issues.push(`${it.externalId}: bo'sh optionsUz[${k}]`)
    }
    if (!it.optionsRu[k] || it.optionsRu[k].trim() === '') {
      issues.push(`${it.externalId}: bo'sh optionsRu[${k}]`)
    }
  }

  if (!validKeys.includes(it.correctAnswer)) {
    issues.push(`${it.externalId}: noto'g'ri correctAnswer ${it.correctAnswer}`)
  }
  if (!it.optionsUz[it.correctAnswer]) {
    issues.push(`${it.externalId}: correctAnswer ${it.correctAnswer} variantlar ichida yo'q`)
  }

  // Duplicate options check (warning only)
  const valuesUz = Object.values(it.optionsUz)
  const uniqueUz = new Set(valuesUz)
  if (uniqueUz.size < valuesUz.length) {
    duplicateOptionCount++
    warnings.push(`${it.externalId}: UZ variantlar ichida bir xil qiymat takrorlangan`)
  }
}

// 4. Image assets check
console.log('4. Rasm fayllari tekshirilmoqda...')
let imageCount = 0
for (const it of bank.items) {
  if (it.image) {
    imageCount++
    const cleanImgPath = it.image.replace(/^\/+/, '')
    const fullPath = path.resolve(PUBLIC_DIR, cleanImgPath)
    if (!fs.existsSync(fullPath)) {
      issues.push(`${it.externalId}: rasm fayli diskda topilmadi (${it.image})`)
    } else {
      const stats = fs.statSync(fullPath)
      if (stats.size === 0) {
        issues.push(`${it.externalId}: rasm fayli 0 bayt (${it.image})`)
      }
    }
  }
}

// 5. 110,400 texts KaTeX, Typography & Syntax check
console.log('5. Barcha 110,400 ta matn (LaTeX, tipografika, sintaksis) tekshirilmoqda...')
const leadingNumberRegex = /^\s*\d{1,2}\.\s+/
const brokenVectorRegex = /[\u20d7\u20d6⃗]/
const rawRootRegex = /(?<!\\)√/
const bareSubscriptDigitRegex = /\b([a-zA-Z])0\b(?![0-9])/
const rawSystemBracketRegex = /[⎧⎪⎨⎩⎫⎬⎭⎛⎝⎞⎠]/
const trailingOptionMarkerRegex = /(?<![\\+\-=]\s*)(?<![\w\\∩∪\(])[ABCD]\)\s*$/

function hasUnextractedOptionsInQuestion(text: string): boolean {
  const markers: number[] = []
  const matches = text.matchAll(/(?<![\w\\∩∪\(])([ABCD])\s*\)/g)
  for (const m of matches) {
    const idx = m.index ?? 0
    const prefix = text.slice(0, idx).trimEnd()
    if (prefix && /[-+−*·/=<>≤≥^_\\∩∪([,]$/.test(prefix)) continue
    if (prefix && /\\(?:cap|cup|setminus|in|notin|subset|times)\s*$/.test(prefix)) continue

    const lineStart = Math.max(0, text.lastIndexOf('\n', idx) + 1)
    const linePrefix = text.slice(lineStart, idx)
    const openParens = (linePrefix.match(/\(/g) || []).length - (linePrefix.match(/\)/g) || []).length
    if (openParens > 0) continue

    const suffix = text.slice(idx + m[0].length)
    if (/^\s*\\(?:cap|cup|setminus|times)/.test(suffix)) continue

    markers.push(idx)
  }
  return markers.length >= 2 || (markers.length === 1 && text.trim().startsWith('A)'))
}

let totalTextsAudited = 0
let katexErrorsCount = 0
let syntaxViolationsCount = 0

for (const it of bank.items) {
  const texts = [
    { field: 'questionUz', text: it.questionUz },
    { field: 'questionRu', text: it.questionRu },
    { field: 'optionsUz.A1', text: it.optionsUz.A1 },
    { field: 'optionsUz.A2', text: it.optionsUz.A2 },
    { field: 'optionsUz.A3', text: it.optionsUz.A3 },
    { field: 'optionsUz.A4', text: it.optionsUz.A4 },
    { field: 'optionsRu.A1', text: it.optionsRu.A1 },
    { field: 'optionsRu.A2', text: it.optionsRu.A2 },
    { field: 'optionsRu.A3', text: it.optionsRu.A3 },
    { field: 'optionsRu.A4', text: it.optionsRu.A4 },
  ]

  for (const { field, text } of texts) {
    totalTextsAudited++

    if (leadingNumberRegex.test(text) && field.startsWith('question')) {
      issues.push(`${it.externalId} (${field}): qolib ketgan savol raqami: "${text.slice(0, 20)}"`)
      syntaxViolationsCount++
    }

    if (field.startsWith('question')) {
      if (trailingOptionMarkerRegex.test(text)) {
        issues.push(`${it.externalId} (${field}): savol oxirida qolib ketgan variant markeri: "${text.slice(-20)}"`)
        syntaxViolationsCount++
      }
      if (hasUnextractedOptionsInQuestion(text)) {
        issues.push(`${it.externalId} (${field}): savol matnida variant markeri uchrashdi: "${text.slice(0, 40)}"`)
        syntaxViolationsCount++
      }
    }

    if (rawSystemBracketRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): xom sistema/katta qavs simvoli: "${text.slice(0, 40)}"`)
      syntaxViolationsCount++
    }

    if (brokenVectorRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): buzilgan vektor strelkasi: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (rawRootRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): xom √ belgisi: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (text.includes('∅')) {
      issues.push(`${it.externalId} (${field}): xom ∅ belgisi: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (bareSubscriptDigitRegex.test(text)) {
      warnings.push(`${it.externalId} (${field}): yalang'och harf+0 (indeks bo'lishi mumkin): "${text.slice(0, 40)}"`)
    }

    // KaTeX parsing & rendering check
    const segments = parseMathSegments(text)
    for (const seg of segments) {
      if (seg.type === 'math') {
        const warnCountBefore = capturedKatexWarnings.length
        const html = renderKaTeXToString(seg.content, seg.displayMode)
        if (!html || html.includes('class="katex-error"')) {
          issues.push(`${it.externalId} (${field}): KaTeX render xatosi: "${seg.content}"`)
          katexErrorsCount++
        } else if (capturedKatexWarnings.length > warnCountBefore) {
          const newWarns = capturedKatexWarnings.slice(warnCountBefore)
          issues.push(`${it.externalId} (${field}): KaTeX ogohlantirish (${newWarns[0]}): "${seg.content}"`)
          katexErrorsCount++
        }
      }
    }
  }
}

// 6. Golden fixtures check
console.log('6. Golden etalon savollar tekshirilmoqda...')
const { GOLDEN_FIXTURES } = await import('../tests/fixtures/math-print-golden.fixture')

for (const [extId, exp] of Object.entries(GOLDEN_FIXTURES)) {
  const item = bank.items.find(i => i.externalId === extId)
  if (!item) {
    issues.push(`Golden savol ${extId} bankda topilmadi!`)
    continue
  }
  for (const f of exp.forbiddenInQuestion) {
    if (item.questionUz.includes(f)) {
      issues.push(`Golden ${extId}: savol matnida taqiqlangan "${f}" topildi!`)
    }
  }
  for (const r of exp.requiredInQuestion) {
    if (!item.questionUz.includes(r)) {
      issues.push(`Golden ${extId}: savol matnida kutilgan "${r}" topilmadi!`)
    }
  }
  for (const optVal of Object.values(item.optionsUz)) {
    for (const f of exp.forbiddenInOptions) {
      if (optVal.includes(f)) {
        issues.push(`Golden ${extId}: variant matnida taqiqlangan "${f}" topildi!`)
      }
    }
  }
}

console.log('\n=========================================================')
console.log('                    AUDIT NATIJALARI                     ')
console.log('=========================================================')
console.log(`✅ Tekshirilgan mavzular: ${bank.topics.length}`)
console.log(`✅ Tekshirilgan savollar: ${bank.items.length}`)
console.log(`✅ Tekshirilgan matnlar soni: ${totalTextsAudited}`)
console.log(`✅ Rasmlar soni: ${imageCount}`)
console.log(`⚠️ Takrorlangan variantlar (ko'rik uchun): ${duplicateOptionCount}`)
console.log(`⚠️ Tavsiyalar (warning): ${warnings.length}`)
console.log(`❌ Sintaktik qoidabuzarliklar: ${syntaxViolationsCount}`)
console.log(`❌ KaTeX formulalar xatosi: ${katexErrorsCount}`)
console.log(`❌ Jami aniqlangan kritik nuqsonlar: ${issues.length}`)
console.log('=========================================================\n')

if (issues.length > 0) {
  console.error('DIQQAT! Audit quyidagi kritik xatoliklarni aniqladi:')
  for (let i = 0; i < Math.min(issues.length, 25); i++) {
    console.error(`  - ${issues[i]}`)
  }
  if (issues.length > 25) {
    console.error(`  ... va yana ${issues.length - 25} ta xatolik.`)
  }
  process.exit(1)
} else {
  console.log('🎉 Barcha 110,400 ta matn va 11,040 ta savol auditdan 100% MUVAFFAQIYATLI o\'tdi!')
  process.exit(0)
}
