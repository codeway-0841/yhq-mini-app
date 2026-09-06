import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMathSegments, renderKaTeXToString } from '../../../src/shared/components/MathText'

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

describe('Fizika Test Print — Comprehensive 88,800 Text & 8,880 Question Audit', () => {
  const jsonPath = path.resolve(process.cwd(), 'content-banks/fizika/physics-print.json')
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const bank = JSON.parse(raw) as BankData

  it('8,880 ta savol va 296 ta mavzu to\'liq mavjud', () => {
    expect(bank.bankId).toBe('physics_db')
    expect(bank.subjectId).toBe('fizika')
    expect(bank.topics.length).toBe(296)
    expect(bank.items.length).toBe(8880)
  })

  it('Mavzu ID\'lari va savol externalId\'lari to\'liq noyob, har mavzuda aynan 30 ta savol mavjud', () => {
    const topicIdSet = new Set<string>()
    for (const t of bank.topics) {
      expect(topicIdSet.has(t.externalId)).toBe(false)
      topicIdSet.add(t.externalId)
    }

    const questionIdSet = new Set<string>()
    const countPerTopic = new Map<string, number>()

    for (const item of bank.items) {
      expect(questionIdSet.has(item.externalId)).toBe(false)
      questionIdSet.add(item.externalId)
      expect(topicIdSet.has(item.topicExternalId)).toBe(true)

      const current = countPerTopic.get(item.topicExternalId) || 0
      countPerTopic.set(item.topicExternalId, current + 1)
    }

    for (const t of bank.topics) {
      expect(countPerTopic.get(t.externalId)).toBe(30)
    }
  })

  it('Savol boshidagi bosma raqamlar (16., 24. kabi) to\'liq tozalangan (0 ta qoldiq)', () => {
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

  it('Buzilgan daraja va indekslar (m/s2, kg/m3, v0, t0, x0) to\'liq tuzatilgan', () => {
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

  it('Har bir savolda aniq 4 ta bo\'sh bo\'lmagan variant va to\'g\'ri correctAnswer mavjud', () => {
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

      for (const k of validKeys) {
        if (!item.optionsUz[k]?.trim()) {
          violations.push(`${item.externalId}: empty optionUz[${k}]`)
        }
        if (!item.optionsRu[k]?.trim()) {
          violations.push(`${item.externalId}: empty optionRu[${k}]`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('Savollarga biriktirilgan barcha rasm fayllari diskda mavjud va hajmi > 0', () => {
    const missingImages: string[] = []

    for (const item of bank.items) {
      if (item.image) {
        const fullPath = path.resolve(process.cwd(), 'public', item.image.replace(/^\/+/, ''))
        if (!fs.existsSync(fullPath)) {
          missingImages.push(`${item.externalId}: ${item.image}`)
        } else {
          const stat = fs.statSync(fullPath)
          if (stat.size === 0) {
            missingImages.push(`${item.externalId}: 0-byte image ${item.image}`)
          }
        }
      }
    }

    expect(missingImages).toEqual([])
  })

  it('Barcha 88,800 ta UZ/RU savol va variant matnlari KaTeX xatolarisiz 100% toza render qilinadi', () => {
    let errorCount = 0
    const errorDetails: string[] = []

    for (const item of bank.items) {
      const texts = [
        item.questionUz,
        item.questionRu,
        ...Object.values(item.optionsUz),
        ...Object.values(item.optionsRu),
      ]

      for (const t of texts) {
        const segments = parseMathSegments(t)
        for (const seg of segments) {
          if (seg.type === 'math') {
            const html = renderKaTeXToString(seg.content, seg.displayMode)
            if (!html || html.includes('class="katex-error"')) {
              errorCount++
              if (errorDetails.length < 10) {
                errorDetails.push(`${item.externalId}: "${seg.content}"`)
              }
            }
          }
        }
      }
    }

    if (errorCount > 0) {
      console.error('KaTeX errors found in 88,800 text audit:', errorDetails)
    }

    expect(errorCount).toBe(0)
  })
})

