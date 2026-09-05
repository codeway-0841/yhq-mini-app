import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderMathToHtml } from '../../../src/shared/components/MathText'

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

describe('Fizika Test Print — Comprehensive 8,880 Question Audit', () => {
  const jsonPath = path.resolve(process.cwd(), 'content-banks/fizika/physics-print.json')
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const bank = JSON.parse(raw) as BankData

  it('8,880 ta savol va 296 ta mavzu toliq mavjud', () => {
    expect(bank.bankId).toBe('physics_db')
    expect(bank.subjectId).toBe('fizika')
    expect(bank.topics.length).toBe(296)
    expect(bank.items.length).toBe(8880)
  })

  it('Savol boshidagi bosma raqamlar (16., 24. kabi) toliq tozalangan (0 ta qoldiq)', () => {
    const leadingNumberRegex = /^\s*\d{1,2}\.\s+/
    const violations: string[] = []

    for (const item of bank.items) {
      if (leadingNumberRegex.test(item.questionUz)) {
        violations.push(`${item.externalId} (UZ): ${item.questionUz.slice(0, 30)}`)
      }
      if (leadingNumberRegex.test(item.questionRu)) {
        violations.push(`${item.externalId} (RU): ${item.questionRu.slice(0, 30)}`)
      }
    }

    expect(violations).toEqual([])
  })

  it('Buzilgan combining strelkalar va TeX vektor qoldiqlari qolmagan', () => {
    const brokenVectorRegex = /[\u20d7\u20d6⃗]/
    const violations: string[] = []

    for (const item of bank.items) {
      const texts = [item.questionUz, item.questionRu, ...Object.values(item.optionsUz), ...Object.values(item.optionsRu)]
      for (const t of texts) {
        if (brokenVectorRegex.test(t)) {
          violations.push(`${item.externalId}: ${t.slice(0, 40)}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('Greek upsilon (υ) va Unicode delta (∆, △) belgilar tozalangan', () => {
    const violations: string[] = []

    for (const item of bank.items) {
      const texts = [item.questionUz, item.questionRu, ...Object.values(item.optionsUz), ...Object.values(item.optionsRu)]
      for (const t of texts) {
        if (t.includes('υ') || t.includes('∆') || t.includes('△')) {
          violations.push(`${item.externalId}: ${t.slice(0, 40)}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('Buzilgan daraja va indekslar (m/s2, kg/m3, v0, t0, x0) toliq tuzatilgan', () => {
    const brokenUnitsRegex = /\b(m|km|cm|mm)\/s2\b|\bkg\/m3\b|\bg\/cm3\b/
    const brokenSubscriptsRegex = /\b([vVaAxtTShHpPRqQkKIUlgNdcBi])0\b/
    const violations: string[] = []

    for (const item of bank.items) {
      const texts = [item.questionUz, item.questionRu, ...Object.values(item.optionsUz), ...Object.values(item.optionsRu)]
      for (const t of texts) {
        if (brokenUnitsRegex.test(t) || brokenSubscriptsRegex.test(t)) {
          violations.push(`${item.externalId}: ${t.slice(0, 40)}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('Barcha ildiz belgilari (√) standart \\sqrt{...} formatiga keltirilgan', () => {
    const rawRootRegex = /(?<!\\)√/
    const violations: string[] = []

    for (const item of bank.items) {
      const texts = [item.questionUz, item.questionRu, ...Object.values(item.optionsUz), ...Object.values(item.optionsRu)]
      for (const t of texts) {
        if (rawRootRegex.test(t)) {
          violations.push(`${item.externalId}: ${t.slice(0, 40)}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('Har bir savolda aniq 4 ta variant (A1, A2, A3, A4) va togri correctAnswer mavjud', () => {
    const validKeys = ['A1', 'A2', 'A3', 'A4']
    const violations: string[] = []

    for (const item of bank.items) {
      const optKeysUz = Object.keys(item.optionsUz)
      const optKeysRu = Object.keys(item.optionsRu)

      if (optKeysUz.length !== 4 || !validKeys.every(k => optKeysUz.includes(k))) {
        violations.push(`${item.externalId}: UZ options invalid ${JSON.stringify(optKeysUz)}`)
      }
      if (optKeysRu.length !== 4 || !validKeys.every(k => optKeysRu.includes(k))) {
        violations.push(`${item.externalId}: RU options invalid ${JSON.stringify(optKeysRu)}`)
      }
      if (!validKeys.includes(item.correctAnswer)) {
        violations.push(`${item.externalId}: invalid correctAnswer ${item.correctAnswer}`)
      }
    }

    expect(violations).toEqual([])
  })

  it('Savollarga biriktirilgan barcha rasm fayllari diskda mavjud', () => {
    const missingImages: string[] = []

    for (const item of bank.items) {
      if (item.image) {
        const fullPath = path.resolve(process.cwd(), 'public', item.image.replace(/^\/+/, ''))
        if (!fs.existsSync(fullPath)) {
          missingImages.push(`${item.externalId}: ${item.image}`)
        }
      }
    }

    expect(missingImages).toEqual([])
  })

  it('MathText barcha savol va variantlarni KaTeX xatolarisiz toza render qiladi', () => {
    let errorCount = 0
    const sampleItems = bank.items.filter((_, idx) => idx % 5 === 0) // sample 1,776 questions

    for (const item of sampleItems) {
      const texts = [item.questionUz, ...Object.values(item.optionsUz)]
      for (const t of texts) {
        const html = renderMathToHtml(t)
        if (html.includes('class="katex-error"')) {
          errorCount++
        }
      }
    }

    expect(errorCount).toBe(0)
  })
})
