#!/usr/bin/env tsx
/**
 * Standalone Comprehensive Audit Script for Physics Question Bank.
 * Validates all 296 topics, 8,880 questions, and 88,800 texts.
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
const JSON_PATH = path.resolve(ROOT, 'content-banks/fizika/physics-print.json')
const PUBLIC_DIR = path.resolve(ROOT, 'public')

console.log('---------------------------------------------------------')
console.log('   FIZIKA TEST BANK — 88,800 MATN TO\'LIQ AUDIT DASTURI   ')
console.log('---------------------------------------------------------\n')

if (!fs.existsSync(JSON_PATH)) {
  console.error(`❌ Xatolik: ${JSON_PATH} fayli topilmadi!`)
  process.exit(1)
}

const raw = fs.readFileSync(JSON_PATH, 'utf8')
const bank = JSON.parse(raw) as BankData

const issues: string[] = []
const warnings: string[] = []

// 1. Structure check
console.log('1. Bank strukturasi tekshirilmoqda...')
if (bank.bankId !== 'physics_db') issues.push(`Noto'g'ri bankId: ${bank.bankId}`)
if (bank.subjectId !== 'fizika') issues.push(`Noto'g'ri subjectId: ${bank.subjectId}`)
if (bank.topics.length !== 296) issues.push(`Mavzular soni 296 ta bo'lishi kerak, lekin ${bank.topics.length} ta topildi`)
if (bank.items.length !== 8880) issues.push(`Savollar soni 8880 ta bo'lishi kerak, lekin ${bank.items.length} ta topildi`)

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

// 5. 88,800 texts KaTeX, Typography & Syntax check
console.log('5. Barcha 88,800 ta matn (LaTeX, tipografika, sintaksis) tekshirilmoqda...')
const leadingNumberRegex = /^\s*\d{1,2}\.\s+/
const brokenVectorRegex = /[\u20d7\u20d6⃗]/
const brokenUnitsRegex = /\b(m|km|cm|mm)\/s2\b|\bkg\/m3\b|\bg\/cm3\b/
const brokenSubscriptsRegex = /\b([vVaAxtTShHpPRqQkKIUlgNdcBi])0\b/
const rawRootRegex = /(?<!\\)√/

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

    if (brokenVectorRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): buzilgan vektor strelkasi: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (text.includes('υ') || text.includes('∆') || text.includes('△')) {
      issues.push(`${it.externalId} (${field}): qolib ketgan OCR belgisi (υ/∆/△): "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (brokenUnitsRegex.test(text) || brokenSubscriptsRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): buzilgan indeks/birlik: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    if (rawRootRegex.test(text)) {
      issues.push(`${it.externalId} (${field}): xom √ belgisi: "${text.slice(0, 30)}"`)
      syntaxViolationsCount++
    }

    // KaTeX parsing & rendering check
    const segments = parseMathSegments(text)
    for (const seg of segments) {
      if (seg.type === 'math') {
        const html = renderKaTeXToString(seg.content, seg.displayMode)
        if (!html || html.includes('class="katex-error"')) {
          issues.push(`${it.externalId} (${field}): KaTeX render xatosi: "${seg.content}"`)
          katexErrorsCount++
        }
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
  console.log('🎉 Barcha 88,800 ta matn va 8,880 ta savol auditdan 100% MUVAFFAQIShLI o\'tdi!')
  process.exit(0)
}
